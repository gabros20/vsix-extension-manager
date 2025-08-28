import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import { downloadFile } from "./downloader";
import {
  parseExtensionUrl,
  constructDownloadUrl,
  getDisplayNameFromUrl,
  constructOpenVsxDownloadUrl,
  inferSourceFromUrl,
} from "./urlParser";
import {
  createDownloadDirectory,
  FileExistsAction,
  handleFileExists,
  resolveOutputDirectory,
} from "./fileManager";
import { resolveVersion } from "./extensionRegistry";
import { generateFilename, DEFAULT_FILENAME_TEMPLATE, validateTemplate } from "./filenameTemplate";
import { generateSHA256, isValidSHA256, verifySHA256 } from "./checksum";
import { ProgressInfo, formatSpeed } from "./progressTracker";

interface SpinnerInstance {
  start: (message: string) => void;
  message: (text: string) => void;
  stop: (message?: string, code?: number) => void;
}

interface BulkExtensionItem {
  url: string;
  version: string;
  source?: "marketplace" | "open-vsx";
}

export interface BulkOptions {
  parallel?: number;
  retry?: number;
  retryDelay?: number; // in ms
  quiet?: boolean;
  json?: boolean;
  summaryPath?: string;
  source?: "marketplace" | "open-vsx";
  filenameTemplate?: string;
  cacheDir?: string;
  skipExisting?: boolean;
  overwrite?: boolean;
  checksum?: boolean;
  verifyChecksum?: string;
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
      // Validate URL format by attempting to parse either Marketplace or OpenVSX
      try {
        parseExtensionUrl(item.url);
      } catch (e) {
        itemErrors.push(
          `Item ${index + 1}: URL must be a valid Marketplace or OpenVSX URL (${e instanceof Error ? e.message : "invalid"})`,
        );
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

  // Validate filename template if provided
  const filenameTemplate = options.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;
  const templateValidation = validateTemplate(filenameTemplate);
  if (!templateValidation.isValid) {
    throw new Error(`Invalid filename template: ${templateValidation.error}`);
  }

  // Determine effective output directory (cache-dir takes precedence)
  const effectiveOutputDir = resolveOutputDirectory(options.cacheDir, outputDir);

  // Create output directory
  await createDownloadDirectory(effectiveOutputDir);

  // Retry settings (sequential downloads for clean progress)
  const maxRetries = Math.max(0, Math.floor(options.retry ?? 2));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelay ?? 1000));

  // File existence handling
  let fileExistsAction: FileExistsAction;
  if (options.skipExisting) {
    fileExistsAction = FileExistsAction.SKIP;
  } else if (options.overwrite) {
    fileExistsAction = FileExistsAction.OVERWRITE;
  } else {
    fileExistsAction = FileExistsAction.OVERWRITE; // Default for bulk mode (non-interactive)
  }

  // Result aggregation
  let successCount = 0;
  let failureCount = 0;
  const failedDownloads: string[] = [];
  // Validate checksum format if provided
  if (options.verifyChecksum && !isValidSHA256(options.verifyChecksum)) {
    throw new Error("Invalid SHA256 hash format. Expected 64 hexadecimal characters.");
  }

  const results: Array<{
    index: number;
    url: string;
    version: string;
    status: "success" | "failure";
    filePath?: string;
    filename?: string;
    sizeBytes?: number;
    checksum?: string;
    verificationPassed?: boolean;
    error?: string;
    elapsedMs: number;
  }> = [];

  // Single spinner for clean bulk progress display
  let bulkSpinner: SpinnerInstance | null = null;
  let completedCount = 0;

  if (!options.quiet) {
    bulkSpinner = p.spinner();
    bulkSpinner.start("Starting bulk download...");
  }

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function downloadSingleExtension(ext: BulkExtensionItem, index: number) {
    const displayName = getDisplayNameFromUrl(ext.url);
    const startMs = Date.now();

    // Update spinner message
    if (bulkSpinner) {
      bulkSpinner.message(`[${index + 1}/${extensions.length}] Preparing ${displayName}...`);
    }

    const extensionInfo = parseExtensionUrl(ext.url);
    const resolvedSource = (ext.source || options.source || inferSourceFromUrl(ext.url)) as
      | "marketplace"
      | "open-vsx";
    const versionToUse =
      (ext.version || "").trim().toLowerCase() === "latest"
        ? await resolveVersion(extensionInfo.itemName, "latest", false, resolvedSource)
        : ext.version;
    const downloadUrl =
      resolvedSource === "open-vsx"
        ? constructOpenVsxDownloadUrl(extensionInfo, versionToUse)
        : constructDownloadUrl(extensionInfo, versionToUse);

    const filename = generateFilename(filenameTemplate, {
      name: extensionInfo.itemName,
      version: versionToUse,
      source: resolvedSource,
      publisher: extensionInfo.itemName.split(".")[0],
    });

    const filePath = path.join(effectiveOutputDir, filename);

    // Check if file exists and handle accordingly
    const shouldProceedWithDownload = await handleFileExists(filePath, fileExistsAction);

    if (!shouldProceedWithDownload) {
      const elapsedMs = Date.now() - startMs;
      completedCount++;
      if (bulkSpinner) {
        bulkSpinner.message(
          `[${completedCount}/${extensions.length}] Skipped ${displayName} (file exists)`,
        );
      }
      successCount++;
      results.push({
        index,
        url: ext.url,
        version: ext.version,
        status: "success", // Treat skip as success for stats
        filePath,
        filename,
        sizeBytes: 0,
        elapsedMs,
      });
      return;
    }

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (bulkSpinner) {
          bulkSpinner.message(`[${index + 1}/${extensions.length}] Downloading ${displayName}...`);
        }

        const progressCallback = (progress: ProgressInfo) => {
          if (bulkSpinner) {
            const progressPercent = progress.percentage.toFixed(1);
            const speed = formatSpeed(progress.speed);
            bulkSpinner.message(
              `[${index + 1}/${extensions.length}] ${displayName} - ${progressPercent}% @ ${speed}`,
            );
          }
        };

        const pathOnDisk = await downloadFile(
          downloadUrl,
          effectiveOutputDir,
          filename,
          progressCallback,
        );
        const stats = await fs.stat(pathOnDisk);
        const elapsedMs = Date.now() - startMs;

        let checksum: string | undefined;
        let verificationStatus = "";

        // Generate checksum if requested
        if (options.checksum) {
          try {
            checksum = await generateSHA256(pathOnDisk);
          } catch {
            // Continue without checksum rather than failing the download
          }
        }

        // Verify checksum if provided
        if (options.verifyChecksum) {
          try {
            const isValid = await verifySHA256(pathOnDisk, options.verifyChecksum);
            if (isValid) {
              verificationStatus = " ✅";
            } else {
              verificationStatus = " ❌";
              completedCount++;
              if (bulkSpinner) {
                bulkSpinner.message(
                  `[${completedCount}/${extensions.length}] ❌ ${displayName} - Checksum verification failed`,
                );
              }
              failureCount++;
              failedDownloads.push(`${displayName}: Checksum verification failed`);
              results.push({
                index,
                url: ext.url,
                version: ext.version,
                status: "failure",
                error: "Checksum verification failed",
                elapsedMs,
              });
              throw new Error("Checksum verification failed");
            }
          } catch {
            verificationStatus = " ⚠️";
            // Continue with warning but don't fail the download
          }
        }

        // Complete successfully
        completedCount++;
        const sizeInKB = Math.round(stats.size / 1024);
        const checksumInfo = checksum ? ` - SHA256: ${checksum.slice(0, 8)}...` : "";
        if (bulkSpinner) {
          bulkSpinner.message(
            `[${completedCount}/${extensions.length}] ✅ ${displayName} (${sizeInKB} KB)${checksumInfo}${verificationStatus}`,
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
          checksum,
          verificationPassed: options.verifyChecksum ? verificationStatus === " ✅" : undefined,
          elapsedMs,
        });
        return;
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        if (attempt <= maxRetries) {
          const backoff = retryDelayMs * Math.pow(2, attempt - 1);
          await delay(backoff);
          continue;
        } else {
          const elapsedMs = Date.now() - startMs;
          completedCount++;
          if (bulkSpinner) {
            bulkSpinner.message(
              `[${completedCount}/${extensions.length}] ❌ ${displayName} - Failed: ${errorMsg}`,
            );
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
          throw new Error(errorMsg);
        }
      }
    }
  }

  // Execute downloads sequentially for clean progress display
  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    try {
      await downloadSingleExtension(ext, i);
    } catch {
      // Error already handled in downloadSingleExtension
    }
  }

  // Stop the spinner
  if (bulkSpinner) {
    bulkSpinner.stop(
      `Bulk download completed! ${successCount} successful, ${failureCount} failed.`,
    );
  }

  // Show final summary
  const summaryLines = [
    `Total extensions: ${extensions.length}`,
    `✅ Successful: ${successCount}`,
    `❌ Failed: ${failureCount}`,
    `📁 Output directory: ${effectiveOutputDir}`,
  ];

  if (failedDownloads.length > 0) {
    summaryLines.push("", "Failed downloads:");
    failedDownloads.forEach((failure) => {
      summaryLines.push(`  • ${failure}`);
    });
  }

  if (!options.quiet) {
    p.note(summaryLines.join("\n"), "Download Summary");

    if (successCount > 0) {
      p.outro(`🎉 Bulk download completed! ${successCount} extension(s) downloaded successfully.`);
    } else {
      p.outro("❌ No extensions were downloaded successfully.");
    }
  }

  // Write summary JSON if requested
  if (options.summaryPath) {
    const summary = {
      total: extensions.length,
      success: successCount,
      failed: failureCount,
      outputDir: effectiveOutputDir,
      results,
    };
    await fs.outputFile(options.summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  }
}
