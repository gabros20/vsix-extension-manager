import { getEditorService, InstallResult } from "./editorCliService";
import { VsixFile } from "./vsixScannerService";

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

        return {
          task,
          success: result.success,
          installResult: result,
          error: result.error,
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
   * Validate installation prerequisites
   */
  async validatePrerequisites(binaryPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // If binaryPath is an absolute/path-like string, check on disk
      const isPathLike = /[\\/]/.test(binaryPath);
      if (isPathLike) {
        const fs = await import("fs-extra");
        if (!(await fs.pathExists(binaryPath))) {
          errors.push(`Editor binary not found: ${binaryPath}`);
        }
      }

      // Try to get version to verify it's working (works for PATH commands too)
      await this.editorService.getEditorVersion(binaryPath);
    } catch (error) {
      errors.push(
        `Editor binary not accessible: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
