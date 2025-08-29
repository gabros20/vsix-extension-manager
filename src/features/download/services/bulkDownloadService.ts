import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import { downloadFile } from "../../../core/http/downloader";
import {
  parseExtensionUrl,
  constructDownloadUrl,
  getDisplayNameFromUrl,
  constructOpenVsxDownloadUrl,
  inferSourceFromUrl,
  resolveVersion,
} from "../../../core/registry";
import {
  createDownloadDirectory,
  FileExistsAction,
  handleFileExists,
  resolveOutputDirectory,
  generateFilename,
  DEFAULT_FILENAME_TEMPLATE,
  validateTemplate,
  generateSHA256,
  isValidSHA256,
  verifySHA256,
} from "../../../core/filesystem";
import { ProgressInfo, formatBytes, createProgressBar } from "../../../core/ui/progress";
import { truncateText } from "../../../core/helpers";
import type { BulkOptions } from "../../../core/types";

interface SpinnerInstance {
  start: (message: string) => void;
  message: (text: string) => void;
  stop: (message?: string, code?: number) => void;
}

export interface BulkExtensionItem {
  url: string;
  version: string;
  source?: "marketplace" | "open-vsx";
}

export interface BulkValidationResult {
  isValid: boolean;
  errors: string[];
  validItems: BulkExtensionItem[];
}

export interface BulkDownloadResult {
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
}

/**
 * Validate JSON structure and content for bulk downloads
 */
export function validateBulkJson(data: unknown): BulkValidationResult {
  const errors: string[] = [];
  const validItems: BulkExtensionItem[] = [];

  if (!Array.isArray(data)) {
    return {
      isValid: false,
      errors: ["JSON must be an array of extension objects"],
      validItems: [],
    };
  }
  if (data.length === 0) {
    return { isValid: false, errors: ["JSON array cannot be empty"], validItems: [] };
  }

  data.forEach((item, index) => {
    const itemErrors: string[] = [];
    if (!item.url || typeof item.url !== "string") {
      itemErrors.push(`Item ${index + 1}: Missing or invalid 'url' field`);
    } else {
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
    } else if (item.version.trim().length === 0) {
      itemErrors.push(`Item ${index + 1}: Version cannot be empty`);
    }

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
    } else {
      validItems.push(item);
    }
  });

  return { isValid: errors.length === 0, errors, validItems };
}

/**
 * Read and validate JSON file for bulk downloads
 */
export async function readBulkJsonFile(filePath: string): Promise<BulkValidationResult> {
  try {
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return { isValid: false, errors: [`File not found: ${filePath}`], validItems: [] };
    }
    const content = await fs.readFile(filePath, "utf-8");
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
  const validation = await readBulkJsonFile(filePath);
  if (!validation.isValid) {
    p.log.error("❌ JSON Validation Failed:");
    validation.errors.forEach((error) => p.log.error(`  • ${error}`));
    throw new Error("Invalid JSON file");
  }

  const extensions = validation.validItems;
  if (!options.quiet) {
    p.log.success(
      `✅ JSON validation passed! Found ${extensions.length} extension(s) to download.`,
    );
  }

  const filenameTemplate = options.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;
  const templateValidation = validateTemplate(filenameTemplate);
  if (!templateValidation.isValid) {
    throw new Error(`Invalid filename template: ${templateValidation.error}`);
  }

  const effectiveOutputDir = resolveOutputDirectory(options.cacheDir, outputDir);
  await createDownloadDirectory(effectiveOutputDir);

  const maxRetries = Math.max(0, Math.floor(options.retry ?? 2));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelay ?? 1000));

  let fileExistsAction: FileExistsAction;
  if (options.skipExisting) fileExistsAction = FileExistsAction.SKIP;
  else if (options.overwrite) fileExistsAction = FileExistsAction.OVERWRITE;
  else fileExistsAction = FileExistsAction.OVERWRITE;

  let successCount = 0;
  let failureCount = 0;
  const failedDownloads: string[] = [];
  if (options.verifyChecksum && !isValidSHA256(options.verifyChecksum)) {
    throw new Error("Invalid SHA256 hash format. Expected 64 hexadecimal characters.");
  }

  const results: BulkDownloadResult[] = [];

  let bulkSpinner: SpinnerInstance | null = null;
  let completedCount = 0;
  if (!options.quiet) {
    bulkSpinner = p.spinner();
    bulkSpinner.start("Starting bulk download...");
  }

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function downloadSingle(ext: BulkExtensionItem, index: number) {
    const displayName = truncateText(getDisplayNameFromUrl(ext.url));
    const startMs = Date.now();

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
        status: "success",
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

        let lastProgressUpdate = Date.now();
        const progressCallback = (progress: ProgressInfo) => {
          if (bulkSpinner) {
            const now = Date.now();
            if (now - lastProgressUpdate >= 100) {
              const progressBar = createProgressBar(progress.percentage, 10);
              const downloaded = formatBytes(progress.downloaded);
              const total = formatBytes(progress.total);
              bulkSpinner.message(
                `[${index + 1}/${extensions.length}] ${displayName} - ${progressBar} ${downloaded}/${total}`,
              );
              lastProgressUpdate = now;
            }
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
        if (options.checksum) {
          try {
            checksum = await generateSHA256(pathOnDisk);
          } catch {}
        }
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
          }
        }

        completedCount++;
        const formattedSize = formatBytes(stats.size);
        const checksumInfo = checksum ? ` - SHA256: ${checksum.slice(0, 8)}...` : "";
        if (bulkSpinner) {
          bulkSpinner.message(
            `[${completedCount}/${extensions.length}] ✅ ${displayName} (${formattedSize})${checksumInfo}${verificationStatus}`,
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

  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    try {
      await downloadSingle(ext, i);
    } catch {}
  }

  if (bulkSpinner) {
    bulkSpinner.stop(
      `Bulk download completed! ${successCount} successful, ${failureCount} failed.`,
    );
  }

  if (!options.quiet) {
    let summaryContent = `Total: ${extensions.length} extensions\nSuccessful: ${successCount}\nFailed: ${failureCount}\nOutput: ${effectiveOutputDir}`;
    if (failedDownloads.length > 0) {
      summaryContent += "\n\nFailed downloads:\n";
      failedDownloads.forEach((failure) => {
        summaryContent += `• ${failure}\n`;
      });
      summaryContent = summaryContent.slice(0, -1);
    }
    p.note(summaryContent, "Download Complete");
    if (successCount > 0)
      p.outro(
        `🎉 VSIX Extension Manager: Bulk download completed! ${successCount} extension(s) downloaded successfully.`,
      );
    else p.outro("❌ No extensions were downloaded successfully.");
  }

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
