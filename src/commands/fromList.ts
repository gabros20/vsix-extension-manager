import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import { parseExtensionsList } from "../features/import";
import { downloadBulkExtensions } from "../features/download";
import type { BulkOptions } from "../core/types";
import { buildBulkOptionsFromCli } from "../core/helpers";
import { DEFAULT_OUTPUT_DIR } from "../config/constants";

interface FromListOptions {
  file?: string;
  output?: string;
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;
  skipExisting?: boolean;
  overwrite?: boolean;
  quiet?: boolean;
  json?: boolean;
  summary?: string;
  preRelease?: boolean;
  source?: string;
  filenameTemplate?: string;
  cacheDir?: string;
  checksum?: boolean;
  format?: string;
}

export async function fromList(options: FromListOptions) {
  try {
    p.intro("📥 Download from Extension List");

    // Get input file
    let filePath = options.file;
    if (!filePath) {
      filePath = (await p.text({
        message: "Enter path to extensions list file:",
        validate: (input: string) => {
          if (!input.trim()) return "Please enter a file path";
          if (!fs.existsSync(input.trim())) return "File does not exist";
          return undefined;
        },
      })) as string;

      if (p.isCancel(filePath)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
    }

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      p.log.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    // Read file content
    const content = fs.readFileSync(filePath, "utf-8");

    // Determine format from file extension if not specified
    let format = options.format;
    if (!format) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".json") {
        // Only accept VS Code extensions.json
        try {
          const parsed = JSON.parse(content);
          format = parsed.recommendations ? "extensions.json" : undefined;
        } catch {
          format = undefined;
        }
      } else {
        format = "txt";
      }
    }

    if (format === "json") {
      p.log.error(
        "❌ JSON arrays of IDs are no longer supported. Use txt (one ID per line) or VS Code extensions.json.",
      );
      process.exit(1);
    }

    // Parse extensions list
    let extensionIds: string[];
    try {
      extensionIds = parseExtensionsList(content, format as "txt" | "extensions.json", filePath);
    } catch (error) {
      p.log.error(
        `❌ Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }

    if (extensionIds.length === 0) {
      p.log.warn("⚠️ No extensions found in the file");
      return;
    }

    p.log.info(`📦 Found ${extensionIds.length} extension(s) to download`);

    // Convert extension IDs to bulk download format
    const bulkItems = extensionIds.map((id) => {
      // Parse publisher.name format
      const parts = id.split(".");
      if (parts.length < 2) {
        throw new Error(`Invalid extension ID format: ${id}. Expected format: publisher.name`);
      }

      const publisher = parts[0];
      const name = parts.slice(1).join(".");

      // Construct marketplace URL
      const url = `https://marketplace.visualstudio.com/items?itemName=${id}`;

      return {
        name: `${publisher}.${name}`,
        url,
        version: "latest", // Use latest by default
      };
    });

    // Create temporary JSON file for bulk download
    const tempJsonPath = path.join(process.cwd(), `.temp-extensions-${Date.now()}.json`);

    try {
      // Write temporary JSON file
      fs.writeFileSync(tempJsonPath, JSON.stringify(bulkItems, null, 2));

      // Prepare bulk download options
      const bulkOptions: BulkOptions = buildBulkOptionsFromCli(options, {
        parallel: 3,
        retry: 3,
        retryDelay: 1000,
      });

      // Determine output directory (cache-dir takes precedence, then output, then prompt)
      let outputDir: string;
      if (options.cacheDir) {
        outputDir = options.cacheDir;
      } else if (options.output) {
        outputDir = options.output;
      } else {
        const outputInput = await p.text({
          message: "Enter output directory:",
          placeholder: "./downloads",
          initialValue: DEFAULT_OUTPUT_DIR,
        });

        if (p.isCancel(outputInput)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }

        outputDir = (outputInput as string).trim() || DEFAULT_OUTPUT_DIR;
      }

      // Show preview in interactive mode
      if (!options.quiet && !options.json) {
        p.note(
          extensionIds.slice(0, 10).join("\n") +
            (extensionIds.length > 10 ? `\n... and ${extensionIds.length - 10} more` : ""),
          "Extensions to download",
        );

        const proceed = await p.confirm({
          message: "Proceed with download?",
        });

        if (p.isCancel(proceed) || !proceed) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
      }

      // Perform bulk download using temporary file
      await downloadBulkExtensions(tempJsonPath, outputDir, bulkOptions);
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempJsonPath)) {
        fs.unlinkSync(tempJsonPath);
      }
    }

    if (!options.quiet) {
      p.outro("✨ Download completed!");
    }
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
