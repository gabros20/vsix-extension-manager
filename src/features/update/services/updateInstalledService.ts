import os from "os";
import path from "path";
import fs from "fs-extra";
import { getEditorService, getInstallService } from "../../install";
import { getInstalledExtensions as getInstalledFromFs } from "../../export";
import { resolveVersion } from "../../../core/registry";
import { downloadWithFallback } from "../../download";
import { getBackupService, type BackupMetadata } from "../../../core/backup";
import type { ProgressInfo } from "../../../core/ui/progress";

export interface UpdateOptions {
  editor?: "vscode" | "cursor" | "auto";
  preRelease?: boolean;
  source?: "marketplace" | "open-vsx" | "auto";
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;
  quiet?: boolean;
  json?: boolean;
  dryRun?: boolean;
  summary?: string;
  codeBin?: string;
  cursorBin?: string;
  allowMismatchedBinary?: boolean;
  selectedExtensions?: string[]; // Filter to only update these extension IDs
  skipBackup?: boolean; // Skip creating backups before update
  backupDir?: string; // Custom backup directory
}

export interface UpdateItemPlan {
  id: string;
  currentVersion: string;
  targetVersion: string;
}

export interface UpdateItemResult extends UpdateItemPlan {
  status: "updated" | "up-to-date" | "skipped" | "failed";
  error?: string;
  filePath?: string;
  elapsedMs: number;
  backupId?: string; // ID of the backup created before update
}

export interface UpdateSummary {
  tempDir: string;
  totalDetected: number;
  upToDate: number;
  toUpdate: number;
  updated: number;
  skipped: number;
  failed: number;
  elapsedMs: number;
  items: UpdateItemResult[];
  backups: BackupMetadata[]; // List of backups created during update
}

type MessageCallback = (message: string) => void;
type ProgressCallback = (id: string, progress: ProgressInfo) => void;

export class UpdateInstalledService {
  async updateInstalled(
    options: UpdateOptions = {},
    onMessage?: MessageCallback,
    onProgress?: ProgressCallback,
  ): Promise<UpdateSummary> {
    const startAll = Date.now();
    const editorPref = options.editor || "auto";
    const retry = Number(options.retry ?? 2);
    const retryDelay = Number(options.retryDelay ?? 1000);
    const parallel = Math.max(1, Number(options.parallel ?? 1));
    const quiet = Boolean(options.quiet);
    const dryRun = Boolean(options.dryRun);
    const preRelease = Boolean(options.preRelease);
    const sourcePref = (options.source || "auto") as "marketplace" | "open-vsx" | "auto";

    const editorService = getEditorService();
    const installService = getInstallService();

    // Detect editor and resolve binary
    const available = await editorService.getAvailableEditors();
    if (available.length === 0) {
      throw new Error("No editors found. Please install VS Code or Cursor.");
    }
    const chosenEditor =
      editorPref === "auto"
        ? (available.find((e) => e.name === "cursor") || available[0]).name
        : editorPref;
    const explicitBin = chosenEditor === "vscode" ? options.codeBin : options.cursorBin;
    const binPath = await editorService.resolveEditorBinary(
      chosenEditor,
      explicitBin,
      Boolean(options.allowMismatchedBinary),
    );

    // Preflight validation
    const preflight = await installService.validatePrerequisites(binPath);
    if (!preflight.valid) {
      throw new Error(`Preflight checks failed: ${preflight.errors.join(", ")}`);
    }

    // Collect installed extensions
    onMessage?.("Scanning installed extensions...");
    const installed = await getInstalledFromFs(chosenEditor);

    const summary: UpdateSummary = {
      tempDir: "",
      totalDetected: installed.length,
      upToDate: 0,
      toUpdate: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      elapsedMs: 0,
      items: [],
      backups: [],
    };

    if (installed.length === 0) {
      summary.elapsedMs = Date.now() - startAll;
      return summary;
    }

    // Filter extensions if specific ones are selected
    const extensionsToCheck = options.selectedExtensions
      ? installed.filter((ext) => options.selectedExtensions!.includes(ext.id))
      : installed;

    // Deduplicate extensions by ID, keeping the one with newer version
    const deduplicatedExtensions = this.deduplicateExtensions(extensionsToCheck);

    // Plan updates by resolving latest versions
    onMessage?.("Resolving latest versions...");
    const plans: UpdateItemPlan[] = [];
    for (const ext of deduplicatedExtensions) {
      const id = ext.id;
      const current = ext.version;
      try {
        const latest = await this.withRetry(
          async () => {
            return resolveVersion(id, "latest", preRelease, sourcePref);
          },
          retry,
          retryDelay,
        );

        if (!latest) {
          summary.failed++;
          summary.items.push({
            id,
            currentVersion: current,
            targetVersion: current,
            status: "failed",
            error: "Could not resolve latest version",
            elapsedMs: 0,
          });
          continue;
        }

        // Compare versions semantically
        // If selectedExtensions is provided, the user has already chosen to update these,
        // so we should trust that decision and always consider them as needing updates
        const needsUpdate = options.selectedExtensions
          ? options.selectedExtensions.includes(id)
          : this.isVersionNewer(latest, current);

        if (!needsUpdate) {
          summary.upToDate++;
          summary.items.push({
            id,
            currentVersion: current,
            targetVersion: latest,
            status: "up-to-date",
            elapsedMs: 0,
          });
          continue;
        }
        plans.push({ id, currentVersion: current, targetVersion: latest });
      } catch (error) {
        // Could not resolve versions – mark failed and continue
        summary.failed++;
        summary.items.push({
          id,
          currentVersion: current,
          targetVersion: current,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: 0,
        });
        continue;
      }
    }

    summary.toUpdate = plans.length;
    if (plans.length === 0) {
      summary.elapsedMs = Date.now() - startAll;
      return summary;
    }

    // Validate update plan
    const planValidation = this.validateUpdatePlan(plans);
    if (!planValidation.valid) {
      throw new Error(`Update plan validation failed: ${planValidation.errors.join(", ")}`);
    }

    // Create temp directory
    const tempDirName = `vsix-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.join(os.tmpdir(), tempDirName);
    await fs.ensureDir(tempDir);
    summary.tempDir = tempDir;

    // Write extensions.json with recommended updates
    const extensionsJson = {
      recommendations: plans.map((p) => p.id),
    };
    try {
      await fs.writeJson(path.join(tempDir, "extensions.json"), extensionsJson, { spaces: 2 });
    } catch {}

    // Initialize backup service if backups are enabled
    const backupService = options.skipBackup ? null : getBackupService(options.backupDir);

    // Perform updates with bounded concurrency
    let index = 0;
    const results: UpdateItemResult[] = [];
    const workers: Promise<void>[] = [];
    for (let w = 0; w < parallel; w++) {
      workers.push(
        (async () => {
          while (true) {
            const myIndex = index++;
            if (myIndex >= plans.length) break;
            const plan = plans[myIndex];
            const startItem = Date.now();
            try {
              if (dryRun) {
                results.push({ ...plan, status: "skipped", elapsedMs: Date.now() - startItem });
                continue;
              }

              // Create backup before updating (if enabled)
              let backupMetadata: BackupMetadata | undefined;
              if (backupService && !options.skipBackup) {
                try {
                  // Get the extension's current installation path
                  const extensionsPath =
                    chosenEditor === "cursor"
                      ? path.join(os.homedir(), ".cursor", "extensions")
                      : path.join(os.homedir(), ".vscode", "extensions");

                  // Find the extension directory (format: publisher.name-version)
                  const extensionDirs = await fs.readdir(extensionsPath);
                  const extensionDir = extensionDirs.find((dir) =>
                    dir.startsWith(plan.id.replace(".", ".") + "-"),
                  );

                  if (extensionDir) {
                    const extensionPath = path.join(extensionsPath, extensionDir);
                    backupMetadata = await backupService.backupExtension(
                      extensionPath,
                      plan.id,
                      plan.currentVersion,
                      chosenEditor,
                      `Auto-backup before update to ${plan.targetVersion}`,
                    );
                    summary.backups.push(backupMetadata);
                  }
                } catch (backupError) {
                  // Log backup error but continue with update
                  if (!quiet) {
                    onMessage?.(`Warning: Failed to backup ${plan.id}: ${backupError}`);
                  }
                }
              }

              // Download from preferred source with fallback
              const filePath = await this.downloadExtensionWithFallback(
                plan.id,
                plan.targetVersion,
                tempDir,
                {
                  preRelease,
                  sourcePref,
                  quiet,
                  retry,
                  retryDelay,
                  progressCallback: onProgress ? (p) => onProgress(plan.id, p) : undefined,
                },
              );

              // Install with force reinstall (since we're updating to a newer version)
              const installRes = await this.withRetry(
                async () => {
                  return installService.installSingleVsix(binPath, filePath, {
                    dryRun: false,
                    forceReinstall: true, // Force reinstall for updates
                    timeout: 30000,
                  });
                },
                retry,
                retryDelay,
              );

              if (installRes.success) {
                results.push({
                  ...plan,
                  status: "updated",
                  filePath,
                  elapsedMs: Date.now() - startItem,
                  backupId: backupMetadata?.id,
                });
              } else {
                // Provide detailed error information for troubleshooting
                const errorParts = [installRes.error, installRes.stderr, installRes.stdout].filter(
                  Boolean,
                );
                const detailedError =
                  errorParts.length > 0 ? errorParts.join("; ") : "Install failed";
                const exitCode = installRes.exitCode;

                // Check for compatibility issues and provide cleaner error messages
                const isCompatibilityIssue =
                  detailedError.includes("not compatible with") ||
                  detailedError.includes("requires a newer version");

                let finalError = detailedError;
                if (isCompatibilityIssue) {
                  // Extract just the compatibility message, skip the stack trace
                  const compatMatch = detailedError.match(/Error: (.+?) at /);
                  finalError = compatMatch
                    ? compatMatch[1]
                    : "Extension not compatible with current editor version";
                } else if (typeof exitCode === "number") {
                  finalError = `${detailedError} (exit code: ${exitCode})`;
                }

                results.push({
                  ...plan,
                  status: "failed",
                  error: finalError,
                  filePath,
                  elapsedMs: Date.now() - startItem,
                  backupId: backupMetadata?.id,
                });
              }
            } catch (error) {
              results.push({
                ...plan,
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
                elapsedMs: Date.now() - startItem,
              });
            }
          }
        })(),
      );
    }
    await Promise.all(workers);

    // Aggregate results
    for (const r of results) {
      if (r.status === "updated") summary.updated++;
      else if (r.status === "skipped") summary.skipped++;
      else if (r.status === "failed") summary.failed++;
    }
    summary.items.push(...results);

    // Write JSON summary if requested
    if (options.summary) {
      try {
        await fs.writeJson(
          options.summary,
          {
            timestamp: new Date().toISOString(),
            editor: chosenEditor,
            binary: binPath,
            tempDir,
            totalDetected: summary.totalDetected,
            upToDate: summary.upToDate,
            toUpdate: summary.toUpdate,
            updated: summary.updated,
            skipped: summary.skipped,
            failed: summary.failed,
            items: summary.items,
            backups: summary.backups,
            extensionsJsonPath: path.join(tempDir, "extensions.json"),
          },
          { spaces: 2 },
        );
      } catch {}
    }

    // Cleanup temp dir (best-effort)
    try {
      await fs.remove(tempDir);
    } catch {}

    summary.elapsedMs = Date.now() - startAll;
    return summary;
  }

  private async withRetry<T>(fn: () => Promise<T>, retry: number, delayMs: number): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (attempt < retry) {
          await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  /**
   * Deduplicate extensions by ID, keeping the one with the newer version
   */
  private deduplicateExtensions(
    extensions: Array<{ id: string; version: string; displayName?: string }>,
  ): Array<{ id: string; version: string; displayName?: string }> {
    const extensionMap = new Map<string, { id: string; version: string; displayName?: string }>();

    for (const ext of extensions) {
      const existing = extensionMap.get(ext.id);
      if (!existing) {
        extensionMap.set(ext.id, ext);
      } else {
        // Keep the extension with the newer version
        if (this.isVersionNewer(ext.version, existing.version)) {
          extensionMap.set(ext.id, ext);
        }
        // If versions are the same or existing is newer, keep existing
      }
    }

    return Array.from(extensionMap.values());
  }

  /**
   * Validate update plan before execution
   */
  private validateUpdatePlan(plans: UpdateItemPlan[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (plans.length === 0) {
      return { valid: true, errors: [] };
    }

    // Validate extension ID formats
    const invalidIds = plans.filter(
      (p) => !/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-.]*$/.test(p.id),
    );
    if (invalidIds.length > 0) {
      errors.push(`Invalid extension IDs: ${invalidIds.map((p) => p.id).join(", ")}`);
    }

    // Validate version formats
    const invalidVersions = plans.filter((p) => !p.targetVersion || p.targetVersion.trim() === "");
    if (invalidVersions.length > 0) {
      errors.push(`Missing target versions: ${invalidVersions.map((p) => p.id).join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Download extension with intelligent source fallback
   */
  private async downloadExtensionWithFallback(
    extensionId: string,
    version: string,
    outputDir: string,
    options: {
      preRelease: boolean;
      sourcePref: "marketplace" | "open-vsx" | "auto";
      quiet: boolean;
      retry: number;
      retryDelay: number;
      progressCallback?: (progress: ProgressInfo) => void;
    },
  ): Promise<string> {
    return downloadWithFallback(extensionId, version, outputDir, options);
  }

  /**
   * Compare versions semantically - returns true if newVersion > currentVersion
   */
  private isVersionNewer(newVersion: string, currentVersion: string): boolean {
    // If versions are identical, no update needed
    if (newVersion === currentVersion) {
      return false;
    }

    // Parse semantic versions
    const parseVersion = (v: string) => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
      if (!match) return null;
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4] || null,
      };
    };

    const newParsed = parseVersion(newVersion);
    const currentParsed = parseVersion(currentVersion);

    // If either version can't be parsed, fall back to string comparison
    if (!newParsed || !currentParsed) {
      return newVersion !== currentVersion;
    }

    // Compare major.minor.patch
    if (newParsed.major !== currentParsed.major) {
      return newParsed.major > currentParsed.major;
    }
    if (newParsed.minor !== currentParsed.minor) {
      return newParsed.minor > currentParsed.minor;
    }
    if (newParsed.patch !== currentParsed.patch) {
      return newParsed.patch > currentParsed.patch;
    }

    // Same major.minor.patch - check prerelease
    // Stable (no prerelease) > prerelease
    if (!newParsed.prerelease && currentParsed.prerelease) {
      return true; // new stable > current prerelease
    }
    if (newParsed.prerelease && !currentParsed.prerelease) {
      return false; // new prerelease < current stable
    }

    // Both prerelease or both stable - compare prerelease strings
    if (newParsed.prerelease && currentParsed.prerelease) {
      return newParsed.prerelease > currentParsed.prerelease;
    }

    // Same version
    return false;
  }
}

// Global instance accessor
let globalUpdateService: UpdateInstalledService | null = null;
export function getUpdateInstalledService(): UpdateInstalledService {
  if (!globalUpdateService) {
    globalUpdateService = new UpdateInstalledService();
  }
  return globalUpdateService;
}
