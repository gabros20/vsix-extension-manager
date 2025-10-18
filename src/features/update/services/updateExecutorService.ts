/**
 * Update Executor Service
 * Executes update plans with backup and progress tracking
 */

import os from "os";
import path from "path";
import fs from "fs-extra";
import { getInstallService } from "../../install";
import { downloadWithFallback } from "../../download";
import { getBackupService, type BackupMetadata } from "../../../core/backup";
import type { ProgressInfo } from "../../../core/ui/progress";
import type { UpdatePlan } from "./updatePlanService";

export interface UpdateExecutionOptions {
  editor: "vscode" | "cursor";
  binaryPath: string;
  tempDir: string;
  parallel?: number;
  retry?: number;
  retryDelay?: number;
  preRelease?: boolean;
  source?: "marketplace" | "open-vsx" | "auto";
  dryRun?: boolean;
  quiet?: boolean;
  skipBackup?: boolean;
  backupDir?: string;
  backups?: BackupMetadata[]; // Track backups created
  onProgress?: (completed: number, total: number, extensionId?: string) => void;
  onDownloadProgress?: (id: string, progress: ProgressInfo) => void;
}

export interface UpdateExecutionResult {
  id: string;
  currentVersion: string;
  targetVersion: string;
  status: "updated" | "skipped" | "failed";
  error?: string;
  filePath?: string;
  elapsedMs: number;
  backupId?: string;
}

/**
 * Service for executing updates
 */
export class UpdateExecutorService {
  private installService = getInstallService();

  /**
   * Execute update plans
   */
  async executeUpdates(
    plans: UpdatePlan[],
    options: UpdateExecutionOptions,
  ): Promise<UpdateExecutionResult[]> {
    if (plans.length === 0) {
      return [];
    }

    const {
      parallel = 1,
      retry = 2,
      retryDelay = 1000,
      dryRun = false,
      skipBackup = false,
      backupDir,
      onProgress,
      onDownloadProgress,
    } = options;

    const results: UpdateExecutionResult[] = [];
    const backupService = skipBackup ? null : getBackupService(backupDir);

    let updateIndex = 0;
    let updateCompleted = 0;
    const total = plans.length;

    onProgress?.(0, total);

    // Execute updates in parallel with bounded concurrency
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(parallel, plans.length); w++) {
      workers.push(
        (async () => {
          while (true) {
            const myIndex = updateIndex++;
            if (myIndex >= plans.length) break;

            const plan = plans[myIndex];
            onProgress?.(updateCompleted, total, plan.id);

            const result = await this.executeSingleUpdate(plan, {
              ...options,
              backupService,
              retry,
              retryDelay,
              dryRun,
              onDownloadProgress,
            });

            results.push(result);
            updateCompleted++;
            onProgress?.(updateCompleted, total);
          }
        })(),
      );
    }

    await Promise.all(workers);
    return results;
  }

  /**
   * Execute a single update
   */
  private async executeSingleUpdate(
    plan: UpdatePlan,
    options: UpdateExecutionOptions & {
      backupService: ReturnType<typeof getBackupService> | null;
      retry: number;
      retryDelay: number;
      onDownloadProgress?: (id: string, progress: ProgressInfo) => void;
    },
  ): Promise<UpdateExecutionResult> {
    const startTime = Date.now();

    try {
      if (options.dryRun) {
        return {
          ...plan,
          status: "skipped",
          elapsedMs: Date.now() - startTime,
        };
      }

      // Create backup if enabled
      let backupMetadata: BackupMetadata | undefined;
      if (options.backupService) {
        backupMetadata = await this.createBackup(plan, options);
        if (backupMetadata && options.backups) {
          options.backups.push(backupMetadata);
        }
      }

      // Download extension
      const filePath = await this.downloadExtension(plan, options);

      // Install extension
      const installRes = await this.installExtension(filePath, options);

      if (installRes.success) {
        return {
          ...plan,
          status: "updated",
          filePath,
          elapsedMs: Date.now() - startTime,
          backupId: backupMetadata?.id,
        };
      } else {
        return {
          ...plan,
          status: "failed",
          error: this.extractErrorMessage(installRes),
          filePath,
          elapsedMs: Date.now() - startTime,
          backupId: backupMetadata?.id,
        };
      }
    } catch (error) {
      return {
        ...plan,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Create backup before update
   */
  private async createBackup(
    plan: UpdatePlan,
    options: UpdateExecutionOptions & { backupService: ReturnType<typeof getBackupService> | null },
  ): Promise<BackupMetadata | undefined> {
    if (!options.backupService) {
      return undefined;
    }
    try {
      const extensionsPath =
        options.editor === "cursor"
          ? path.join(os.homedir(), ".cursor", "extensions")
          : path.join(os.homedir(), ".vscode", "extensions");

      const extensionDirs = await fs.readdir(extensionsPath);
      const extensionDir = extensionDirs.find((dir) => dir.startsWith(plan.id + "-"));

      if (extensionDir && options.backupService) {
        const extensionPath = path.join(extensionsPath, extensionDir);
        return await options.backupService.backupExtension(
          extensionPath,
          plan.id,
          plan.currentVersion,
          options.editor,
          `Auto-backup before update to ${plan.targetVersion}`,
        );
      }
    } catch (error) {
      if (!options.quiet) {
        console.warn(`Warning: Failed to backup ${plan.id}: ${error}`);
      }
    }
    return undefined;
  }

  /**
   * Download extension with fallback
   */
  private async downloadExtension(
    plan: UpdatePlan,
    options: UpdateExecutionOptions & { retry: number; retryDelay: number },
  ): Promise<string> {
    const filePath = await downloadWithFallback(plan.id, plan.targetVersion, options.tempDir, {
      preRelease: options.preRelease || false,
      sourcePref: options.source || "auto",
      quiet: options.quiet || false,
      retry: options.retry,
      retryDelay: options.retryDelay,
      progressCallback: options.onDownloadProgress
        ? (p) => options.onDownloadProgress!(plan.id, p)
        : undefined,
    });

    return filePath;
  }

  /**
   * Install extension with retry
   */
  private async installExtension(
    filePath: string,
    options: UpdateExecutionOptions & { retry: number; retryDelay: number },
  ): Promise<{
    success: boolean;
    error?: string;
    stderr?: string;
    stdout?: string;
    exitCode: number;
  }> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= options.retry; attempt++) {
      try {
        return await this.installService.installSingleVsix(options.binaryPath, filePath, {
          dryRun: false,
          forceReinstall: true,
          timeout: 30000,
        });
      } catch (e) {
        lastErr = e;
        if (attempt < options.retry) {
          await new Promise((r) => setTimeout(r, options.retryDelay * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  /**
   * Extract error message from install result
   */
  private extractErrorMessage(installRes: {
    success: boolean;
    error?: string;
    stderr?: string;
    stdout?: string;
    exitCode: number;
  }): string {
    const errorParts = [installRes.error, installRes.stderr, installRes.stdout].filter(Boolean);
    const detailedError = errorParts.length > 0 ? errorParts.join("; ") : "Install failed";

    // Check for compatibility issues
    const isCompatibilityIssue =
      detailedError.includes("not compatible with") ||
      detailedError.includes("requires a newer version");

    if (isCompatibilityIssue) {
      const compatMatch = detailedError.match(/Error: (.+?) at /);
      return compatMatch ? compatMatch[1] : "Extension not compatible with current editor version";
    }

    if (typeof installRes.exitCode === "number") {
      return `${detailedError} (exit code: ${installRes.exitCode})`;
    }

    return detailedError;
  }

  /**
   * Deduplicate extensions by ID
   */
  private deduplicateExtensions(
    extensions: Array<{ id: string; version: string }>,
  ): Array<{ id: string; version: string }> {
    const map = new Map<string, { id: string; version: string }>();
    for (const ext of extensions) {
      map.set(ext.id, ext);
    }
    return Array.from(map.values());
  }
}

// Global instance
let globalUpdateExecutorService: UpdateExecutorService | null = null;

export function getUpdateExecutorService(): UpdateExecutorService {
  if (!globalUpdateExecutorService) {
    globalUpdateExecutorService = new UpdateExecutorService();
  }
  return globalUpdateExecutorService;
}
