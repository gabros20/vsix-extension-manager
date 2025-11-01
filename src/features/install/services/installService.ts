import path from "node:path";
import fs from "fs-extra";
import { getEditorService, InstallResult } from "./editorCliService";
import { VsixFile } from "./vsixScannerService";
import { getInstallPreflightService } from "./installPreflightService";
import { getDirectInstallService } from "./directInstallService";
import { robustInstallService } from "./robustInstallService";
import { getEnhancedBulkInstallService } from "./enhancedBulkInstallService";
import {
  FS_SETTLE_DELAY_MS,
  FS_SETTLE_CHECK_DELAY_MS,
  RETRY_DELAY_MS,
} from "../../../config/constants";

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
  private directInstallService = getDirectInstallService();

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
   * Install a single VSIX file using direct installation
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

      // Determine extensions directory
      const isCursor = binaryPath.toLowerCase().includes("cursor");
      const extensionsDir = isCursor
        ? path.join(process.env.HOME || "~", ".cursor", "extensions")
        : path.join(process.env.HOME || "~", ".vscode", "extensions");

      // Ensure extensions directory exists
      await fs.ensureDir(extensionsDir);

      // Use robust installation service with advanced race condition handling
      return await robustInstallService.installVsix(vsixPath, extensionsDir, {
        force: options.forceReinstall,
        maxRetries: 3,
        retryDelay: 1000,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Ensure extensions folder file state is valid before each installation
   * This is a workaround for VS Code's buggy file management
   * Uses atomic operations to prevent race conditions
   */
  private async ensureValidFileState(binaryPath: string): Promise<void> {
    try {
      const isCursor = binaryPath.toLowerCase().includes("cursor");
      const extensionsDir = isCursor
        ? path.join(process.env.HOME || "~", ".cursor", "extensions")
        : path.join(process.env.HOME || "~", ".vscode", "extensions");

      const extensionsJsonPath = path.join(extensionsDir, "extensions.json");
      const obsoletePath = path.join(extensionsDir, ".obsolete");

      // VS Code bug workaround: Wait for file locks to clear
      await this.waitForFileSystemSettle(extensionsDir);

      // VS Code bug workaround: Always ensure .obsolete exists
      // VS Code deletes this file during installation and fails to recreate it
      // Use atomic write to prevent race conditions
      await this.ensureFileExistsAtomic(obsoletePath, JSON.stringify({}, null, 2));

      // VS Code bug workaround: Ensure extensions.json is valid
      // VS Code sometimes creates corrupted JSON during bulk operations
      await this.ensureValidJsonFile(extensionsJsonPath, []);
    } catch {
      // Silently ignore file state errors - this is VS Code's problem
    }
  }

  /**
   * Atomically ensure a file exists with given content (no race condition)
   */
  private async ensureFileExistsAtomic(filePath: string, defaultContent: string): Promise<void> {
    try {
      // Try to create file exclusively (fails if exists)
      await fs.writeFile(filePath, defaultContent, { flag: "wx" });
    } catch {
      // File already exists or write failed - both are acceptable
      // We don't need to do anything
    }
  }

  /**
   * Ensure a valid JSON file exists with atomic operations
   */
  private async ensureValidJsonFile(filePath: string, defaultValue: unknown): Promise<void> {
    try {
      // Try to read and parse existing file
      const content = await fs.readFile(filePath, "utf-8");
      JSON.parse(content); // Validate JSON
      // File exists and is valid, nothing to do
    } catch {
      // File doesn't exist or is corrupted, recreate it atomically
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      try {
        // Write to temp file first
        await fs.writeFile(tempPath, JSON.stringify(defaultValue, null, 2));
        // Atomic rename (overwrites if exists)
        await fs.rename(tempPath, filePath);
      } catch {
        // Cleanup temp file if rename failed
        await fs.remove(tempPath).catch(() => {
          /* ignore */
        });
      }
    }
  }

  /**
   * Wait for VS Code file system operations to settle
   * VS Code has race conditions during rapid file operations
   */
  private async waitForFileSystemSettle(extensionsDir: string): Promise<void> {
    try {
      // Check if there are any temporary files that indicate ongoing operations
      const tempFiles = await fs.readdir(extensionsDir).catch(() => []);
      const hasTempFiles = tempFiles.some(
        (file) => file.includes(".tmp") || file.includes(".temp") || file.includes(".vsctmp"),
      );

      if (hasTempFiles) {
        // Wait for temporary files to be cleaned up
        await this.delay(FS_SETTLE_DELAY_MS);
      }

      // Additional small delay to ensure file system is ready
      await this.delay(FS_SETTLE_CHECK_DELAY_MS);
    } catch {
      // Silently ignore - this is just a best-effort optimization
    }
  }

  /**
   * Check if an installation error is retryable
   * VS Code file system errors are often transient
   */
  private isRetryableError(result: InstallResult): boolean {
    const errorText = [result.error, result.stderr, result.stdout].join(" ").toLowerCase();

    return (
      errorText.includes("missing .obsolete") ||
      errorText.includes("entrynotfound") ||
      errorText.includes("directory conflict") ||
      errorText.includes("scanningextension") ||
      errorText.includes("unable to write file")
    );
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
   * Install multiple VSIX files with enhanced error handling and recovery
   */
  async installBulkVsix(
    binaryPath: string,
    tasks: InstallTask[],
    options: InstallOptions = {},
    progressCallback?: (result: InstallTaskResult) => void,
  ): Promise<BulkInstallResult> {
    // Use enhanced bulk installation service for better error handling
    const enhancedService = getEnhancedBulkInstallService();

    const enhancedOptions = {
      dryRun: options.dryRun,
      forceReinstall: options.forceReinstall,
      skipInstalled: options.skipInstalled,
      parallel: options.parallel || 1,
      retry: options.retry || 3,
      retryDelay: options.retryDelay || 1000,
      timeout: options.timeout,
      quiet: options.quiet,
      maxConcurrent: 3,
      batchSize: 10,
    };

    const result = await enhancedService.installBulkVsix(
      binaryPath,
      tasks,
      enhancedOptions,
      progressCallback,
    );

    // Convert enhanced result to standard format
    return {
      total: result.total,
      successful: result.successful,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
      elapsedMs: result.elapsedMs,
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
          // Wait before retry with exponential backoff
          const delay = (retryDelay || RETRY_DELAY_MS) * Math.pow(2, attempt);
          await this.delay(delay);
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
    // Use enhanced bulk installation service for retry
    const enhancedService = getEnhancedBulkInstallService();

    const retryOptions = {
      dryRun: options.dryRun,
      forceReinstall: options.forceReinstall,
      skipInstalled: options.skipInstalled,
      parallel: 1, // Sequential for retries
      retry: options.retry ?? 2,
      retryDelay: options.retryDelay || 2000,
      timeout: options.timeout || 60000, // Longer timeout (60s)
      quiet: options.quiet,
      maxConcurrent: 1,
      batchSize: 5,
    };

    const result = await enhancedService.retryFailedInstallations(
      binaryPath,
      failedTasks,
      retryOptions,
      progressCallback,
    );

    // Convert enhanced result to standard format
    return {
      total: result.total,
      successful: result.successful,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
      elapsedMs: result.elapsedMs,
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
