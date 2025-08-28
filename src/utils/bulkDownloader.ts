import * as p from "@clack/prompts";
import fs from "fs-extra";
import { downloadFile } from "./downloader";
import { parseMarketplaceUrl, constructDownloadUrl, getDisplayNameFromUrl } from "./urlParser";
import { createDownloadDirectory } from "./fileManager";

interface BulkExtensionItem {
  url: string;
  version: string;
}

export interface BulkOptions {
  parallel?: number;
  retry?: number;
  retryDelay?: number; // in ms
  quiet?: boolean;
  json?: boolean;
  summaryPath?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validItems: BulkExtensionItem[];
}

// display name extraction is provided by getDisplayNameFromUrl in urlParser

/**
 * Validate JSON structure and content
 */
export function validateBulkJson(data: unknown): ValidationResult {
  const errors: string[] = [];
  const validItems: BulkExtensionItem[] = [];

  // Check if data is an array
  if (!Array.isArray(data)) {
    return {
      isValid: false,
      errors: ["JSON must be an array of extension objects"],
      validItems: [],
    };
  }

  // Check if array is not empty
  if (data.length === 0) {
    return {
      isValid: false,
      errors: ["JSON array cannot be empty"],
      validItems: [],
    };
  }

  // Validate each item
  data.forEach((item, index) => {
    const itemErrors: string[] = [];

    // Check required fields
    if (!item.url || typeof item.url !== "string") {
      itemErrors.push(`Item ${index + 1}: Missing or invalid 'url' field`);
    } else {
      // Validate URL format
      if (!item.url.includes("marketplace.visualstudio.com")) {
        itemErrors.push(`Item ${index + 1}: URL must be a valid Visual Studio Marketplace URL`);
      }
    }

    if (!item.version || typeof item.version !== "string") {
      itemErrors.push(`Item ${index + 1}: Missing or invalid 'version' field`);
    } else {
      // Basic version validation (allow flexible versioning)
      if (item.version.trim().length === 0) {
        itemErrors.push(`Item ${index + 1}: Version cannot be empty`);
      }
    }

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
    } else {
      validItems.push(item);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validItems,
  };
}

/**
 * Read and validate JSON file
 */
export async function readBulkJsonFile(filePath: string): Promise<ValidationResult> {
  try {
    // Check if file exists
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return {
        isValid: false,
        errors: [`File not found: ${filePath}`],
        validItems: [],
      };
    }

    // Read file content
    const content = await fs.readFile(filePath, "utf-8");

    // Parse JSON
    let data;
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      return {
        isValid: false,
        errors: [
          `Invalid JSON format: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
        ],
        validItems: [],
      };
    }

    // Validate structure and content
    return validateBulkJson(data);
  } catch (error) {
    return {
      isValid: false,
      errors: [`Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`],
      validItems: [],
    };
  }
}

/**
 * Download multiple extensions from JSON file
 */
export async function downloadBulkExtensions(
  filePath: string,
  outputDir: string = "./downloads",
  options: BulkOptions = {},
): Promise<void> {
  // Read and validate JSON
  const validation = await readBulkJsonFile(filePath);

  if (!validation.isValid) {
    p.log.error("❌ JSON Validation Failed:");
    validation.errors.forEach((error) => {
      p.log.error(`  • ${error}`);
    });
    throw new Error("Invalid JSON file");
  }

  const extensions = validation.validItems;

  if (!options.quiet) {
    p.log.success(
      `✅ JSON validation passed! Found ${extensions.length} extension(s) to download.`,
    );
  }

  // Create output directory
  await createDownloadDirectory(outputDir);

  // Concurrency and retry settings
  const parallel = Math.max(1, Math.floor(options.parallel ?? 4));
  const maxRetries = Math.max(0, Math.floor(options.retry ?? 2));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelay ?? 1000));

  // Result aggregation
  let successCount = 0;
  let failureCount = 0;
  const failedDownloads: string[] = [];
  const results: Array<{
    index: number;
    url: string;
    version: string;
    status: "success" | "failure";
    filePath?: string;
    filename?: string;
    sizeBytes?: number;
    error?: string;
    elapsedMs: number;
  }> = [];

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function downloadWithRetry(ext: BulkExtensionItem, index: number) {
    const displayName = getDisplayNameFromUrl(ext.url);
    const spinner = options.quiet ? null : p.spinner();
    const startMs = Date.now();

    const extensionInfo = parseMarketplaceUrl(ext.url);
    const downloadUrl = constructDownloadUrl(extensionInfo, ext.version);
    const filename = `${extensionInfo.itemName}-${ext.version}.vsix`;

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (spinner) {
          spinner.start(
            `[${index + 1}/${extensions.length}] Downloading ${displayName} (attempt ${attempt})...`,
          );
        }
        const pathOnDisk = await downloadFile(downloadUrl, outputDir, filename);
        const stats = await fs.stat(pathOnDisk);
        const elapsedMs = Date.now() - startMs;
        if (spinner) {
          const sizeInKB = Math.round(stats.size / 1024);
          spinner.stop(
            `[${index + 1}/${extensions.length}] ✅ Downloaded ${filename} (${sizeInKB} KB)`,
          );
        }
        successCount++;
        results.push({
          index,
          url: ext.url,
          version: ext.version,
          status: "success",
          filePath: pathOnDisk,
          filename,
          sizeBytes: stats.size,
          elapsedMs,
        });
        return;
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        if (attempt <= maxRetries) {
          if (spinner) {
            spinner.stop(
              `[${index + 1}/${extensions.length}] ⚠️  ${displayName} failed (attempt ${attempt}). Retrying...`,
              1,
            );
          }
          const backoff = retryDelayMs * Math.pow(2, attempt - 1);
          await delay(backoff);
          continue;
        } else {
          const elapsedMs = Date.now() - startMs;
          if (spinner) {
            spinner.stop(`[${index + 1}/${extensions.length}] ❌ Failed: ${displayName}`, 1);
          }
          failureCount++;
          failedDownloads.push(`${displayName}: ${errorMsg}`);
          results.push({
            index,
            url: ext.url,
            version: ext.version,
            status: "failure",
            error: errorMsg,
            elapsedMs,
          });
          return;
        }
      }
    }
  }

  // Simple concurrency limiter
  let current = 0;
  async function worker() {
    while (true) {
      const i = current++;
      if (i >= extensions.length) return;
      const ext = extensions[i];
      await downloadWithRetry(ext, i);
    }
  }

  const workers = Array.from({ length: parallel }, () => worker());
  await Promise.all(workers);

  // Show final summary
  const summaryLines = [
    `Total extensions: ${extensions.length}`,
    `✅ Successful: ${successCount}`,
    `❌ Failed: ${failureCount}`,
    `📁 Output directory: ${outputDir}`,
  ];

  if (failedDownloads.length > 0) {
    summaryLines.push("", "Failed downloads:");
    failedDownloads.forEach((failure) => {
      summaryLines.push(`  • ${failure}`);
    });
  }

  if (!options.quiet) {
    p.note(summaryLines.join("\n"), "Download Summary");
  }

  if (successCount > 0) {
    if (!options.quiet) {
      p.outro(`🎉 Bulk download completed! ${successCount} extension(s) downloaded successfully.`);
    }
  } else {
    if (!options.quiet) {
      p.outro("❌ No extensions were downloaded successfully.");
    }
  }

  // Write summary JSON if requested
  if (options.summaryPath) {
    const summary = {
      total: extensions.length,
      success: successCount,
      failed: failureCount,
      outputDir,
      results,
    };
    await fs.outputFile(options.summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  }
}
