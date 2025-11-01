import path from "path";
import fs from "fs-extra";
import { parseExtensionsList } from "../../import";
import { downloadWithFallback } from "../../download";
import { resolveVersion } from "../../../core/registry";
import { getInstallService, InstallTask, BulkInstallResult } from "./installService";
import { getVsixScanner, VsixFile } from "./vsixScannerService";
import { InstallError } from "../../../core/errors";

export interface InstallFromListOptions {
  downloadMissing?: boolean;
  downloadOptions?: {
    outputDir?: string;
    cacheDir?: string;
    source?: "marketplace" | "open-vsx" | "auto";
    preRelease?: boolean;
    quiet?: boolean;
    parallel?: number | string;
    retry?: number | string;
    retryDelay?: number | string;
  };
  installOptions?: {
    dryRun?: boolean;
    forceReinstall?: boolean;
    skipInstalled?: boolean;
    parallel?: number;
    retry?: number;
    retryDelay?: number;
    timeout?: number;
    quiet?: boolean;
  };
}

export interface InstallFromListResult {
  totalExtensions: number;
  foundVsixFiles: number;
  downloadedExtensions: number;
  installedExtensions: number;
  skippedExtensions: number;
  failedExtensions: number;
  downloadResult?: {
    total: number;
    successful: number;
    failed: number;
  };
  installResult: BulkInstallResult;
  errors: string[];
}

/**
 * Service for installing extensions from lists (with optional download)
 */
export class InstallFromListService {
  private installService = getInstallService();
  private vsixScanner = getVsixScanner();

  /**
   * Install extensions from a list file
   */
  async installFromList(
    binaryPath: string,
    listPath: string,
    vsixSearchDirs: string[],
    options: InstallFromListOptions = {},
    progressCallback?: (message: string) => void,
  ): Promise<InstallFromListResult> {
    // const startTime = Date.now(); // currently unused; kept for future duration metrics
    const result: InstallFromListResult = {
      totalExtensions: 0,
      foundVsixFiles: 0,
      downloadedExtensions: 0,
      installedExtensions: 0,
      skippedExtensions: 0,
      failedExtensions: 0,
      installResult: {
        total: 0,
        successful: 0,
        skipped: 0,
        failed: 0,
        results: [],
        elapsedMs: 0,
      },
      errors: [],
    };

    try {
      // Parse the extension list
      progressCallback?.("Parsing extension list...");
      const content = await fs.readFile(listPath, "utf-8");
      const format = this.detectListFormat(listPath, content);
      const extensionIds = parseExtensionsList(content, format, listPath);

      result.totalExtensions = extensionIds.length;

      if (extensionIds.length === 0) {
        return result;
      }

      // Scan for existing VSIX files
      progressCallback?.("Scanning for existing VSIX files...");
      const existingVsixFiles = await this.scanForVsixFiles(vsixSearchDirs);
      result.foundVsixFiles = existingVsixFiles.length;

      // Create install tasks
      const installTasks = await this.createInstallTasks(
        extensionIds,
        existingVsixFiles,
        options.downloadMissing || false,
        options.installOptions?.dryRun || false,
      );

      // Download missing extensions if requested
      if (options.downloadMissing) {
        progressCallback?.("Downloading missing extensions...");
        const downloadResult = await this.downloadMissingExtensions(
          installTasks.missing,
          options.downloadOptions || {},
        );

        result.downloadedExtensions = downloadResult.successful;
        result.downloadResult = {
          total: downloadResult.total,
          successful: downloadResult.successful,
          failed: downloadResult.failed,
        };

        if (downloadResult.failed > 0) {
          result.errors.push(`${downloadResult.failed} extensions failed to download`);
        }

        // Re-scan for newly downloaded VSIX files
        const updatedVsixFiles = await this.scanForVsixFiles(vsixSearchDirs);
        const updatedTasks = await this.createInstallTasks(
          extensionIds,
          updatedVsixFiles,
          false, // Don't download again
          options.installOptions?.dryRun || false,
        );
        installTasks.found = updatedTasks.found;
      }

      // Install found extensions
      progressCallback?.("Installing extensions...");
      const installResult = await this.installService.installBulkVsix(
        binaryPath,
        installTasks.found,
        options.installOptions || {},
      );

      result.installResult = installResult;
      result.installedExtensions = installResult.successful;
      result.skippedExtensions = installResult.skipped;
      result.failedExtensions = installResult.failed;
    } catch (error) {
      result.errors.push(
        `Install from list failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Detect the format of the list file
   */
  private detectListFormat(
    filePath: string,
    content: string,
  ): "txt" | "extensions.json" | "yaml" | undefined {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".json") {
      try {
        const parsed = JSON.parse(content);
        return parsed.recommendations ? "extensions.json" : "txt";
      } catch {
        return "txt";
      }
    }

    if (ext === ".yaml" || ext === ".yml") {
      return "yaml";
    }

    return "txt";
  }

  /**
   * Scan directories for VSIX files
   */
  private async scanForVsixFiles(searchDirs: string[]): Promise<VsixFile[]> {
    const allVsixFiles: VsixFile[] = [];

    for (const dir of searchDirs) {
      if (await fs.pathExists(dir)) {
        try {
          const scanResult = await this.vsixScanner.scanDirectory(dir);
          allVsixFiles.push(...scanResult.validVsixFiles);
        } catch (error) {
          // Continue with other directories if one fails
          console.warn(
            `Warning: Failed to scan directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return allVsixFiles;
  }

  /**
   * Create install tasks by matching extension IDs to VSIX files
   */
  private async createInstallTasks(
    extensionIds: string[],
    vsixFiles: VsixFile[],
    shouldDownloadMissing: boolean,
    dryRun: boolean = false,
  ): Promise<{ found: InstallTask[]; missing: string[] }> {
    const found: InstallTask[] = [];
    const missing: string[] = [];

    // Group VSIX files by extension ID for efficient lookup
    const vsixGroups = this.vsixScanner.groupByExtensionId(vsixFiles);

    for (const extensionId of extensionIds) {
      const availableVsixFiles = vsixGroups.get(extensionId) || [];

      if (availableVsixFiles.length > 0) {
        // Find the best match (latest version, most recent file)
        const bestMatch = availableVsixFiles.sort((a, b) => {
          // Prefer files with version info
          if (a.version && !b.version) return -1;
          if (!a.version && b.version) return 1;

          // Then by modification time (newer first)
          return b.modified.getTime() - a.modified.getTime();
        })[0];

        found.push({
          vsixFile: bestMatch,
          extensionId,
          targetVersion: bestMatch.version,
        });
      } else if (shouldDownloadMissing) {
        missing.push(extensionId);
      } else {
        if (dryRun) {
          // Tolerate missing in dry-run, report via caller
          missing.push(extensionId);
        } else {
          // No VSIX found and not downloading - this is an error
          throw new InstallError(
            `No VSIX file found for extension: ${extensionId}`,
            "INSTALL_NO_VSIX_FOUND",
            [
              {
                action: "Check directories",
                description: "Ensure VSIX files are in the search directories",
              },
              {
                action: "Use --download-missing",
                description: "Use --download-missing to download missing extensions",
              },
              {
                action: "Specify directories",
                description: "Use --vsix-dir to specify additional search directories",
              },
            ],
            { extensionId },
          );
        }
      }
    }

    return { found, missing };
  }

  /**
   * Download missing extensions with automatic fallback
   */
  private async downloadMissingExtensions(
    missingIds: string[],
    downloadOptions: InstallFromListOptions["downloadOptions"],
  ): Promise<{ total: number; successful: number; failed: number; failedIds: string[] }> {
    if (missingIds.length === 0) {
      return { total: 0, successful: 0, failed: 0, failedIds: [] };
    }

    const outputDir = downloadOptions?.cacheDir || downloadOptions?.outputDir || "./downloads";
    await fs.ensureDir(outputDir);

    const sourcePref = (downloadOptions?.source || "auto") as "marketplace" | "open-vsx" | "auto";
    const retry = Number(downloadOptions?.retry ?? 2);
    const retryDelay = Number(downloadOptions?.retryDelay ?? 1000);
    const preRelease = Boolean(downloadOptions?.preRelease);
    const quiet = Boolean(downloadOptions?.quiet);

    let successCount = 0;
    let failCount = 0;
    const failedIds: string[] = [];

    // Download with fallback for each extension
    for (const id of missingIds) {
      try {
        // Resolve version first
        const version = await this.resolveVersionWithRetry(
          id,
          preRelease,
          sourcePref,
          retry,
          retryDelay,
        );

        // Download with automatic fallback to alternate source
        await downloadWithFallback(id, version, outputDir, {
          preRelease,
          sourcePref,
          quiet,
          retry,
          retryDelay,
        });

        successCount++;
      } catch (error) {
        failCount++;
        failedIds.push(id);
        if (!quiet) {
          console.warn(
            `Warning: Failed to download ${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return {
      total: missingIds.length,
      successful: successCount,
      failed: failCount,
      failedIds,
    };
  }

  /**
   * Resolve version with retry logic
   */
  private async resolveVersionWithRetry(
    extensionId: string,
    preRelease: boolean,
    source: "marketplace" | "open-vsx" | "auto",
    retry: number,
    retryDelay: number,
  ): Promise<string> {
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        return await resolveVersion(extensionId, "latest", preRelease, source);
      } catch {
        if (attempt < retry) {
          await new Promise((r) => setTimeout(r, retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    // If all retries failed, return "latest" as fallback
    console.warn(`Warning: Could not resolve version for ${extensionId}, using "latest"`);
    return "latest";
  }
}

// Global instance
let globalInstallFromListService: InstallFromListService | null = null;

export function getInstallFromListService(): InstallFromListService {
  if (!globalInstallFromListService) {
    globalInstallFromListService = new InstallFromListService();
  }
  return globalInstallFromListService;
}
