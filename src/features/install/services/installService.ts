import { getEditorService, InstallResult } from "./editorCliService";
import { VsixFile } from "./vsixScannerService";
import { getInstallPreflightService } from "./installPreflightService";

export interface InstallOptions {
  dryRun?: boolean;
  forceReinstall?: boolean;
  skipInstalled?: boolean;
  parallel?: number;
  retry?: number;
  retryDelay?: number;
  timeout?: number;
  quiet?: boolean;
}

export interface InstallTask {
  vsixFile: VsixFile;
  extensionId?: string;
  targetVersion?: string;
}

export interface InstallTaskResult {
  task: InstallTask;
  success: boolean;
  skipped?: boolean;
  error?: string;
  installResult?: InstallResult;
  elapsedMs: number;
  startTime: number;
}

export interface BulkInstallResult {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  results: InstallTaskResult[];
  elapsedMs: number;
}

/**
 * Service for managing VSIX installation operations
 */
export class InstallService {
  private editorService = getEditorService();
  private preflightService = getInstallPreflightService();

  /**
   * Run preflight checks before installation
   */
  async validatePrerequisites(binaryPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const editor = binaryPath.toLowerCase().includes("cursor") ? "cursor" : "vscode";
    const preflightResult = await this.preflightService.runPreflightChecks(editor);

    return {
      valid: preflightResult.valid,
      errors: preflightResult.errors,
    };
  }

  /**
   * Install a single VSIX file
   */
  async installSingleVsix(
    binaryPath: string,
    vsixPath: string,
    options: InstallOptions = {},
  ): Promise<InstallResult> {
    try {
      if (options.dryRun) {
        return {
          success: true,
          exitCode: 0,
          stdout: `[DRY RUN] Would install ${vsixPath}`,
        };
      }

      const result = await this.editorService.installVsix(binaryPath, vsixPath, {
        force: options.forceReinstall,
        timeout: options.timeout,
      });

      // Enhance error message if installation failed
      if (!result.success) {
        result.error = this.extractErrorMessage(result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Extract meaningful error message from install result
   */
  private extractErrorMessage(result: InstallResult): string {
    // Try to get the most informative error message
    const parts = [result.error, result.stderr, result.stdout].filter(Boolean);

    if (parts.length === 0) {
      return result.exitCode !== 0
        ? `Installation failed with exit code ${result.exitCode}`
        : "Unknown error";
    }

    const combined = parts.join("; ");

    // Check for common error patterns
    if (combined.includes("not compatible")) {
      return "Extension not compatible with current editor version";
    }
    if (combined.includes("requires a newer version")) {
      return "Extension requires a newer editor version";
    }
    if (combined.includes("ENOENT") || combined.includes("not found")) {
      return "VSIX file not found or inaccessible";
    }
    if (combined.includes("EACCES") || combined.includes("permission")) {
      return "Permission denied - check file/directory permissions";
    }
    if (combined.includes("corrupted") || combined.includes("invalid")) {
      return "VSIX file appears to be corrupted";
    }
    if (combined.includes("UnsetRemoved") || combined.includes(".obsolete")) {
      return "Missing .obsolete file - try running preflight checks";
    }
    if (combined.includes("ENOTEMPTY") || combined.includes("directory not empty")) {
      return "Directory conflict - try cleaning up temporary files";
    }
    if (combined.includes("Rename") && combined.includes("directory not empty")) {
      return "Extension directory conflict - temporary files may be blocking installation";
    }

    // Return first non-empty part with exit code if available
    const firstPart = parts[0] || "Installation failed";
    return result.exitCode !== 0 ? `${firstPart} (exit code: ${result.exitCode})` : firstPart;
  }

  /**
   * Install multiple VSIX files with retry logic and progress tracking
   */
  async installBulkVsix(
    binaryPath: string,
    tasks: InstallTask[],
    options: InstallOptions = {},
    progressCallback?: (result: InstallTaskResult) => void,
  ): Promise<BulkInstallResult> {
    const startTime = Date.now();
    const results: InstallTaskResult[] = [];
    let successful = 0;
    let skipped = 0;
    let failed = 0;

    const { skipInstalled = false, parallel = 1, dryRun = false } = options;

    // Get currently installed extensions for skip logic
    let installedExtensions: Map<string, string> | null = null;
    if (skipInstalled && !dryRun) {
      try {
        const installed = await this.editorService.listInstalledExtensions(binaryPath);
        installedExtensions = new Map(installed.map((ext) => [ext.id, ext.version]));
      } catch {
        // If we can't get installed extensions, continue without skip logic
        console.warn("Warning: Could not retrieve installed extensions for skip logic");
      }
    }

    // Process tasks
    if (parallel <= 1) {
      // Sequential processing
      for (const task of tasks) {
        const result = await this.processInstallTask(
          binaryPath,
          task,
          options,
          installedExtensions,
        );
        results.push(result);

        if (result.success) successful++;
        else if (result.skipped) skipped++;
        else failed++;

        if (progressCallback) {
          progressCallback(result);
        }
      }
    } else {
      // Parallel processing with concurrency limit
      const batches = this.chunkArray(tasks, parallel);

      for (const batch of batches) {
        const batchPromises = batch.map((task) =>
          this.processInstallTask(binaryPath, task, options, installedExtensions),
        );

        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          results.push(result);

          if (result.success) successful++;
          else if (result.skipped) skipped++;
          else failed++;

          if (progressCallback) {
            progressCallback(result);
          }
        }
      }
    }

    return {
      total: tasks.length,
      successful,
      skipped,
      failed,
      results,
      elapsedMs: Date.now() - startTime,
    };
  }

  /**
   * Process a single install task with retry logic
   */
  private async processInstallTask(
    binaryPath: string,
    task: InstallTask,
    options: InstallOptions,
    installedExtensions?: Map<string, string> | null,
  ): Promise<InstallTaskResult> {
    const startTime = Date.now();
    const {
      skipInstalled = false,
      forceReinstall = false,
      retry = 2,
      retryDelay = 1000,
      dryRun = false,
      timeout,
    } = options;

    // Check if extension is already installed (skip logic)
    if (skipInstalled && installedExtensions && task.extensionId) {
      const installedVersion = installedExtensions.get(task.extensionId);
      if (installedVersion && !forceReinstall) {
        // Check if versions match (if we know the target version)
        if (!task.targetVersion || installedVersion === task.targetVersion) {
          return {
            task,
            success: true,
            skipped: true,
            elapsedMs: Date.now() - startTime,
            startTime,
          };
        }
      }
    }

    // Attempt installation with retries
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const result = await this.installSingleVsix(binaryPath, task.vsixFile.path, {
          dryRun,
          forceReinstall,
          timeout,
        });

        // Check if this was an "already installed" scenario
        const output = ((result.stdout || "") + (result.stderr || "")).toLowerCase();
        const isAlreadyInstalled =
          output.includes("already installed") ||
          output.includes("is already installed") ||
          output.includes("please restart") ||
          output.includes("reinstalling");

        return {
          task,
          success: result.success || isAlreadyInstalled,
          skipped: isAlreadyInstalled,
          installResult: result,
          error: result.success || isAlreadyInstalled ? undefined : result.error,
          elapsedMs: Date.now() - startTime,
          startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < retry) {
          // Wait before retry
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    // All retries failed
    return {
      task,
      success: false,
      error: lastError,
      elapsedMs: Date.now() - startTime,
      startTime,
    };
  }

  /**
   * Check if an extension is already installed
   */
  async isExtensionInstalled(
    binaryPath: string,
    extensionId: string,
  ): Promise<{ installed: boolean; version?: string }> {
    try {
      const installed = await this.editorService.listInstalledExtensions(binaryPath);
      const extension = installed.find((ext) => ext.id === extensionId);

      return {
        installed: !!extension,
        version: extension?.version,
      };
    } catch {
      // If we can't check, assume not installed to be safe
      return { installed: false };
    }
  }

  /**
   * Get installed extensions map
   */
  async getInstalledExtensions(binaryPath: string): Promise<Map<string, string>> {
    try {
      const installed = await this.editorService.listInstalledExtensions(binaryPath);
      return new Map(installed.map((ext) => [ext.id, ext.version]));
    } catch {
      return new Map();
    }
  }

  /**
   * Uninstall an extension
   */
  async uninstallExtension(binaryPath: string, extensionId: string): Promise<InstallResult> {
    return this.editorService.uninstallExtension(binaryPath, extensionId);
  }

  /**
   * Retry failed installations with more conservative settings
   */
  async retryFailedInstallations(
    binaryPath: string,
    failedTasks: InstallTask[],
    options: InstallOptions = {},
    progressCallback?: (result: InstallTaskResult) => void,
  ): Promise<BulkInstallResult> {
    // Use more conservative settings for retry
    const retryOptions: InstallOptions = {
      ...options,
      parallel: 1, // Sequential for retries
      timeout: options.timeout || 60000, // Longer timeout (60s)
      retry: options.retry ?? 1, // One retry per task
    };

    return this.installBulkVsix(binaryPath, failedTasks, retryOptions, progressCallback);
  }

  /**
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility: Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global instance
let globalInstallService: InstallService | null = null;

export function getInstallService(): InstallService {
  if (!globalInstallService) {
    globalInstallService = new InstallService();
  }
  return globalInstallService;
}
