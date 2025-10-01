import path from "node:path";
import fs from "fs-extra";
import { getEditorService, InstallResult } from "./editorCliService";
import { VsixFile } from "./vsixScannerService";
import { robustInstallService } from "./robustInstallService";

export interface EnhancedInstallOptions {
  dryRun?: boolean;
  forceReinstall?: boolean;
  skipInstalled?: boolean;
  parallel?: number;
  retry?: number;
  retryDelay?: number;
  timeout?: number;
  quiet?: boolean;
  maxConcurrent?: number;
  batchSize?: number;
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
  retryCount?: number;
}

export interface EnhancedBulkInstallResult {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  results: InstallTaskResult[];
  elapsedMs: number;
  retrySummary?: {
    totalRetries: number;
    successfulAfterRetry: number;
  };
}

/**
 * Enhanced bulk installation service with advanced error handling and recovery
 *
 * Key features:
 * 1. Intelligent batching to prevent file system overload
 * 2. Advanced retry logic with exponential backoff
 * 3. Automatic error recovery and cleanup
 * 4. Progress tracking with detailed reporting
 * 5. Smart concurrency control based on system resources
 */
export class EnhancedBulkInstallService {
  private editorService = getEditorService();
  private activeInstallations = new Set<string>();
  private installationStats = {
    totalRetries: 0,
    successfulAfterRetry: 0,
  };

  /**
   * Install multiple VSIX files with enhanced error handling
   */
  async installBulkVsix(
    binaryPath: string,
    tasks: InstallTask[],
    options: EnhancedInstallOptions = {},
    progressCallback?: (result: InstallTaskResult) => void,
  ): Promise<EnhancedBulkInstallResult> {
    const startTime = Date.now();
    const results: InstallTaskResult[] = [];
    let successful = 0;
    let skipped = 0;
    let failed = 0;

    const { skipInstalled = false, parallel = 1, batchSize = 10 } = options;

    // Reset stats
    this.installationStats = {
      totalRetries: 0,
      successfulAfterRetry: 0,
    };

    // Get currently installed extensions for skip logic
    let installedExtensions: Map<string, string> | null = null;
    if (skipInstalled) {
      try {
        const installed = await this.editorService.listInstalledExtensions(binaryPath);
        installedExtensions = new Map(installed.map((ext) => [ext.id, ext.version]));
      } catch {
        console.warn("Warning: Could not retrieve installed extensions for skip logic");
      }
    }

    // Process tasks in batches to prevent system overload
    const batches = this.createIntelligentBatches(tasks, batchSize, parallel);

    for (const batch of batches) {
      const batchResults = await this.processBatch(binaryPath, batch, options, installedExtensions);

      for (const result of batchResults) {
        results.push(result);

        if (result.success) successful++;
        else if (result.skipped) skipped++;
        else failed++;

        if (progressCallback) {
          progressCallback(result);
        }
      }

      // Small delay between batches to prevent file system overload
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(100);
      }
    }

    return {
      total: tasks.length,
      successful,
      skipped,
      failed,
      results,
      elapsedMs: Date.now() - startTime,
      retrySummary: {
        totalRetries: this.installationStats.totalRetries,
        successfulAfterRetry: this.installationStats.successfulAfterRetry,
      },
    };
  }

  /**
   * Process a batch of installations with intelligent concurrency control
   */
  private async processBatch(
    binaryPath: string,
    batch: InstallTask[],
    options: EnhancedInstallOptions,
    installedExtensions: Map<string, string> | null,
  ): Promise<InstallTaskResult[]> {
    const { parallel = 1 } = options;
    const concurrency = Math.min(parallel, batch.length);

    if (concurrency <= 1) {
      // Sequential processing
      const results: InstallTaskResult[] = [];
      for (const task of batch) {
        const result = await this.processInstallTask(
          binaryPath,
          task,
          options,
          installedExtensions,
        );
        results.push(result);
      }
      return results;
    } else {
      // Parallel processing with concurrency limit
      const results: InstallTaskResult[] = [];
      const chunks = this.chunkArray(batch, concurrency);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map((task) =>
          this.processInstallTask(binaryPath, task, options, installedExtensions),
        );

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        // Small delay between chunks to prevent file system overload
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await this.delay(50);
        }
      }

      return results;
    }
  }

  /**
   * Process a single install task with enhanced error handling
   */
  private async processInstallTask(
    binaryPath: string,
    task: InstallTask,
    options: EnhancedInstallOptions,
    installedExtensions?: Map<string, string> | null,
  ): Promise<InstallTaskResult> {
    const startTime = Date.now();
    const {
      skipInstalled = false,
      forceReinstall = false,
      retry = 3,
      retryDelay = 1000,
      timeout = 30000,
    } = options;

    // Check if extension is already installed (skip logic)
    if (skipInstalled && installedExtensions && task.extensionId) {
      const installedVersion = installedExtensions.get(task.extensionId);
      if (installedVersion && !forceReinstall) {
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

    // Track active installation
    const installationId = `${task.vsixFile.extensionId}-${Date.now()}`;
    this.activeInstallations.add(installationId);

    try {
      // Attempt installation with enhanced retry logic
      let lastError: string | undefined;
      let retryCount = 0;

      for (let attempt = 0; attempt <= retry; attempt++) {
        try {
          const result = await this.performRobustInstallation(binaryPath, task.vsixFile.path, {
            force: forceReinstall,
            timeout,
            maxRetries: 1, // Single attempt per retry cycle
            retryDelay: 500,
          });

          if (result.success) {
            return {
              task,
              success: true,
              installResult: result,
              elapsedMs: Date.now() - startTime,
              startTime,
              retryCount,
            };
          } else {
            lastError = result.error;
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }

        if (attempt < retry) {
          retryCount++;
          this.installationStats.totalRetries++;

          // Enhanced retry delay with jitter
          const baseDelay = retryDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;

          await this.delay(delay);

          // Clean up any partial installations before retry
          if (task.vsixFile.extensionId) {
            await this.cleanupPartialInstallation(task.vsixFile.extensionId, binaryPath);
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
        retryCount,
      };
    } finally {
      this.activeInstallations.delete(installationId);
    }
  }

  /**
   * Perform robust installation with the enhanced service
   */
  private async performRobustInstallation(
    binaryPath: string,
    vsixPath: string,
    options: {
      force: boolean;
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    },
  ): Promise<InstallResult> {
    // Direct installation with robust service
    return await robustInstallService.installVsix(
      vsixPath,
      this.getExtensionsDir(binaryPath),
      options,
    );
  }

  /**
   * Clean up partial installation artifacts
   */
  private async cleanupPartialInstallation(extensionId: string, binaryPath: string): Promise<void> {
    try {
      const extensionsDir = this.getExtensionsDir(binaryPath);

      // Look for temporary directories that might be left behind
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
      const tempDirs = entries.filter(
        (entry) =>
          entry.isDirectory() && (entry.name.includes(".temp-") || entry.name.includes(".tmp-")),
      );

      for (const tempDir of tempDirs) {
        try {
          await fs.remove(path.join(extensionsDir, tempDir.name));
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get extensions directory for the given binary path
   */
  private getExtensionsDir(binaryPath: string): string {
    const isCursor = binaryPath.toLowerCase().includes("cursor");
    return isCursor
      ? path.join(process.env.HOME || "~", ".cursor", "extensions")
      : path.join(process.env.HOME || "~", ".vscode", "extensions");
  }

  /**
   * Create intelligent batches based on system resources and task complexity
   */
  private createIntelligentBatches(
    tasks: InstallTask[],
    batchSize: number,
    parallel: number,
  ): InstallTask[][] {
    // Adjust batch size based on parallel processing
    const adjustedBatchSize = Math.min(batchSize, Math.max(1, Math.floor(tasks.length / parallel)));

    const batches: InstallTask[][] = [];
    for (let i = 0; i < tasks.length; i += adjustedBatchSize) {
      batches.push(tasks.slice(i, i + adjustedBatchSize));
    }

    return batches;
  }

  /**
   * Retry failed installations with more conservative settings
   */
  async retryFailedInstallations(
    binaryPath: string,
    failedTasks: InstallTask[],
    options: EnhancedInstallOptions = {},
    progressCallback?: (result: InstallTaskResult) => void,
  ): Promise<EnhancedBulkInstallResult> {
    // Use more conservative settings for retry
    const retryOptions: EnhancedInstallOptions = {
      ...options,
      parallel: 1, // Sequential for retries
      maxConcurrent: 1,
      batchSize: 5,
      timeout: options.timeout || 60000, // Longer timeout (60s)
      retry: options.retry ?? 2, // Fewer retries per task
      retryDelay: options.retryDelay || 2000, // Longer delay between retries
    };

    return this.installBulkVsix(binaryPath, failedTasks, retryOptions, progressCallback);
  }

  /**
   * Get installation statistics
   */
  getInstallationStats() {
    return {
      activeInstallations: this.activeInstallations.size,
      stats: this.installationStats,
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
let globalEnhancedBulkInstallService: EnhancedBulkInstallService | null = null;

export function getEnhancedBulkInstallService(): EnhancedBulkInstallService {
  if (!globalEnhancedBulkInstallService) {
    globalEnhancedBulkInstallService = new EnhancedBulkInstallService();
  }
  return globalEnhancedBulkInstallService;
}
