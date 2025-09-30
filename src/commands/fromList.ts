import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import { parseExtensionsListDetailed } from "../features/import";
import { downloadBulkExtensions } from "../features/download";
import type { BulkOptions } from "../core/types";
import { buildBulkOptionsFromCli } from "../core/helpers";
import { DEFAULT_OUTPUT_DIR } from "../config/constants";
import { isInteractive, getSafeIntro } from "../core/helpers/tty";
import { getExtensionCompatibilityService } from "../features/install/services/extensionCompatibilityService";
import { getEditorService } from "../features/install/services/editorCliService";

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
  install?: boolean;
  downloadOnly?: boolean;
  checkCompatibility?: boolean;
  editor?: string;
}

export async function fromList(options: FromListOptions) {
  try {
    // Check if we're in a TTY environment and adjust options accordingly
    if (!isInteractive() && !options.quiet && !options.json) {
      p.log.warn("⚠️ Non-interactive environment detected. Using quiet mode.");
      options.quiet = true;
    }

    getSafeIntro("📥 Download from Extension List", options);

    // Get input file
    let filePath = options.file;
    if (!filePath) {
      if (options.quiet || options.json) {
        p.log.error("❌ File path is required when using --quiet or --json mode");
        process.exit(1);
      }

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

    // Parse extensions list with detailed reporting
    let parseResult;
    try {
      parseResult = parseExtensionsListDetailed(
        content,
        format as "txt" | "extensions.json",
        filePath,
      );
    } catch (error) {
      p.log.error(
        `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }

    const extensionIds = parseResult.validIds;

    if (extensionIds.length === 0) {
      p.log.warn("No valid extensions found in the file");

      if (parseResult.invalidIds.length > 0) {
        p.log.error(`Invalid IDs: ${parseResult.invalidIds.length}`);
        parseResult.invalidIds.slice(0, 5).forEach((id) => p.log.error(`  ${id}`));
        if (parseResult.invalidIds.length > 5) {
          p.log.error(`  ... and ${parseResult.invalidIds.length - 5} more`);
        }
      }
      return;
    }

    // Show parsing summary if there were normalizations or issues
    if (
      !options.quiet &&
      (parseResult.skippedIds.length > 0 ||
        parseResult.duplicates.length > 0 ||
        parseResult.invalidIds.length > 0)
    ) {
      const summaryLines = [
        `Total IDs in file: ${parseResult.validIds.length + parseResult.invalidIds.length + parseResult.duplicates.length}`,
        `Valid: ${parseResult.validIds.length}`,
      ];

      if (parseResult.skippedIds.length > 0) {
        summaryLines.push(
          `Normalized: ${parseResult.skippedIds.length} (version/platform stripped)`,
        );
      }
      if (parseResult.duplicates.length > 0) {
        summaryLines.push(`Duplicates: ${parseResult.duplicates.length} (after normalization)`);
      }
      if (parseResult.invalidIds.length > 0) {
        summaryLines.push(`Invalid: ${parseResult.invalidIds.length}`);
      }

      p.note(summaryLines.join("\n"), "Parse Summary");
    }

    p.log.info(`Found ${extensionIds.length} extension(s) to download`);

    // Check compatibility if requested
    if (options.checkCompatibility) {
      if (!options.quiet) {
        p.log.info("🔍 Checking extension compatibility...");
      }

      try {
        const editorService = getEditorService();
        const compatibilityService = getExtensionCompatibilityService();

        // Resolve editor binary
        const editor = (options.editor as "vscode" | "cursor" | "auto") || "auto";
        const binaryPath = await editorService.resolveEditorBinary(editor);

        // Check compatibility for all extensions
        const compatibilityResults = await compatibilityService.checkBulkCompatibility(
          extensionIds.map((id) => ({ id, version: "latest" })),
          binaryPath,
        );

        // Report results
        const incompatible = compatibilityResults.filter((r) => !r.compatible);
        const warnings = compatibilityResults.filter((r) => r.result.severity === "warning");

        if (incompatible.length > 0) {
          p.log.warn(`⚠️ Found ${incompatible.length} incompatible extension(s):`);
          incompatible.forEach((result) => {
            p.log.warn(`  • ${result.extensionId}: ${result.result.reason}`);
          });

          if (!options.quiet) {
            const proceed = await p.confirm({
              message: "Continue downloading despite compatibility issues?",
            });

            if (p.isCancel(proceed) || !proceed) {
              p.cancel("Operation cancelled due to compatibility issues.");
              process.exit(0);
            }
          }
        }

        if (warnings.length > 0 && !options.quiet) {
          p.log.warn(`⚠️ ${warnings.length} extension(s) have compatibility warnings:`);
          warnings.forEach((result) => {
            p.log.warn(`  • ${result.extensionId}: ${result.result.reason}`);
          });
        }

        if (incompatible.length === 0 && warnings.length === 0 && !options.quiet) {
          p.log.success("✅ All extensions are compatible with your editor version!");
        }
      } catch (error) {
        p.log.warn(
          `⚠️ Compatibility check failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (!options.quiet) {
          const proceed = await p.confirm({
            message: "Continue downloading without compatibility check?",
          });

          if (p.isCancel(proceed) || !proceed) {
            p.cancel("Operation cancelled.");
            process.exit(0);
          }
        }
      }
    }

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

      // Install after download if requested
      if (options.install && !options.downloadOnly) {
        if (!options.quiet) {
          p.log.info("🔧 Installing downloaded extensions...");
        }

        const { getInstallFromListService } = await import("../features/install");
        const installService = getInstallFromListService();

        // Resolve editor for installation
        const { getEditorService } = await import("../features/install");
        const editorService = getEditorService();
        const availableEditors = await editorService.getAvailableEditors();

        if (availableEditors.length === 0) {
          p.log.warn(
            "⚠️ No editors found for installation. Extensions downloaded but not installed.",
          );
          return;
        }

        // Auto-select editor (prefer Cursor)
        const editor = availableEditors.find((e) => e.name === "cursor") || availableEditors[0];
        const binPath = editor.binaryPath;

        // Use the same list file for installation
        const installResult = await installService.installFromList(
          binPath,
          filePath,
          [outputDir], // Search in the download directory
          {
            downloadMissing: false, // Already downloaded
            installOptions: {
              dryRun: false,
              skipInstalled: true, // Skip already installed by default
              parallel: 1, // Conservative for post-download install
              retry: Number(options.retry) || 2,
              retryDelay: Number(options.retryDelay) || 1000,
              quiet: options.quiet,
            },
          },
          (message) => {
            if (!options.quiet) {
              p.log.info(`🔧 ${message}`);
            }
          },
        );

        if (!options.quiet) {
          p.note(
            `Downloaded: ${extensionIds.length}\nInstalled: ${installResult.installedExtensions}\nSkipped: ${installResult.skippedExtensions}\nFailed: ${installResult.failedExtensions}`,
            "Download & Install Summary",
          );
        }
      }
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempJsonPath)) {
        fs.unlinkSync(tempJsonPath);
      }
    }

    if (!options.quiet) {
      if (options.install && !options.downloadOnly) {
        p.outro("✨ Download and install completed!");
      } else {
        p.outro("✨ Download completed!");
      }
    }
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
