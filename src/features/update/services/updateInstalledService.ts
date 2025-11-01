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
    // Use parallel resolution with concurrency limit to avoid rate limiting
    const plans: UpdateItemPlan[] = [];
    const concurrency = Math.min(5, deduplicatedExtensions.length); // Max 5 parallel version checks
    let versionCheckIndex = 0;
    let versionCheckCompleted = 0;
    const versionResults: Array<{
      id: string;
      current: string;
      latest?: string;
      error?: string;
    }> = [];

    const totalToCheck = deduplicatedExtensions.length;

    if (totalToCheck === 0) {
      summary.elapsedMs = Date.now() - startAll;
      onMessage?.("No extensions to check");
      return summary;
    }

    onMessage?.(`Checking versions: 0/${totalToCheck}`);

    // Process version checks in parallel with bounded concurrency
    const versionWorkers: Promise<void>[] = [];
    for (let w = 0; w < concurrency; w++) {
      versionWorkers.push(
        (async () => {
          while (true) {
            const myIndex = versionCheckIndex++;
            if (myIndex >= deduplicatedExtensions.length) break;

            const ext = deduplicatedExtensions[myIndex];
            const id = ext.id;
            const current = ext.version;

            // Report which extension we're checking
            onMessage?.(`Checking versions: ${versionCheckCompleted}/${totalToCheck} - ${id}`);

            try {
              const latest = await this.withRetry(
                async () => {
                  return resolveVersion(id, "latest", preRelease, sourcePref);
                },
                retry,
                retryDelay,
              );

              if (!latest) {
                versionResults.push({
                  id,
                  current,
                  error: "Could not resolve latest version",
                });
              } else {
                versionResults.push({
                  id,
                  current,
                  latest,
                });
              }
            } catch (error) {
              versionResults.push({
                id,
                current,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            versionCheckCompleted++;
            onMessage?.(`Checking versions: ${versionCheckCompleted}/${totalToCheck}`);

            // Add small delay between requests to avoid rate limiting (100ms)
            await new Promise((r) => setTimeout(r, 100));
          }
        })(),
      );
    }

    await Promise.all(versionWorkers);

    onMessage?.(`Version check complete. Processing ${versionResults.length} results...`);

    // Process version check results and build update plan
    for (const result of versionResults) {
      if (result.error) {
        summary.failed++;
        summary.items.push({
          id: result.id,
          currentVersion: result.current,
          targetVersion: result.current,
          status: "failed",
          error: result.error,
          elapsedMs: 0,
        });
        continue;
      }

      if (!result.latest) {
        summary.failed++;
        summary.items.push({
          id: result.id,
          currentVersion: result.current,
          targetVersion: result.current,
          status: "failed",
          error: "Could not resolve latest version",
          elapsedMs: 0,
        });
        continue;
      }

      // Compare versions semantically
      // Always check if the latest version is newer than current version
      const needsUpdate = this.isVersionNewer(result.latest, result.current);

      if (!needsUpdate) {
        summary.upToDate++;
        summary.items.push({
          id: result.id,
          currentVersion: result.current,
          targetVersion: result.latest,
          status: "up-to-date",
          elapsedMs: 0,
        });
        continue;
      }

      plans.push({ id: result.id, currentVersion: result.current, targetVersion: result.latest });
    }

    summary.toUpdate = plans.length;

    onMessage?.(
      `Found ${summary.upToDate} up-to-date, ${summary.failed} failed, ${plans.length} to update`,
    );

    if (plans.length === 0) {
      summary.elapsedMs = Date.now() - startAll;
      onMessage?.("All extensions are up-to-date!");
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
    let updateCompleted = 0;
    const totalToUpdate = plans.length;
    const results: UpdateItemResult[] = [];
    const workers: Promise<void>[] = [];

    if (totalToUpdate > 0) {
      onMessage?.(`Updating: 0/${totalToUpdate}`);
    }

    for (let w = 0; w < parallel; w++) {
      workers.push(
        (async () => {
          while (true) {
            const myIndex = index++;
            if (myIndex >= plans.length) break;
            const plan = plans[myIndex];
            const startItem = Date.now();

            // Report which extension we're updating
            onMessage?.(`Updating: ${updateCompleted}/${totalToUpdate} - ${plan.id}`);

            try {
              if (dryRun) {
                results.push({ ...plan, status: "skipped", elapsedMs: Date.now() - startItem });
                updateCompleted++;
                onMessage?.(`Updating: ${updateCompleted}/${totalToUpdate}`);
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
                updateCompleted++;
                onMessage?.(`Updating: ${updateCompleted}/${totalToUpdate}`);
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
                updateCompleted++;
                onMessage?.(`Updating: ${updateCompleted}/${totalToUpdate}`);
              }
            } catch (error) {
              results.push({
                ...plan,
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
                elapsedMs: Date.now() - startItem,
              });
              updateCompleted++;
              onMessage?.(`Updating: ${updateCompleted}/${totalToUpdate}`);
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
   * Supports both 3-part (X.Y.Z) and 4-part (X.Y.Z.W) version formats with optional prerelease
   */
  private isVersionNewer(newVersion: string, currentVersion: string): boolean {
    // If versions are identical, no update needed
    if (newVersion === currentVersion) {
      return false;
    }

    // Parse semantic versions (supports both X.Y.Z and X.Y.Z.W formats)
    const parseVersion = (v: string) => {
      // Match X.Y.Z or X.Y.Z.W with optional prerelease tag
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
      if (!match) return null;
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        build: match[4] ? parseInt(match[4], 10) : 0, // 4th part defaults to 0
        prerelease: match[5] || null,
      };
    };

    const newParsed = parseVersion(newVersion);
    const currentParsed = parseVersion(currentVersion);

    // If either version can't be parsed, fall back to string comparison
    if (!newParsed || !currentParsed) {
      return newVersion !== currentVersion;
    }

    // Compare major.minor.patch.build
    if (newParsed.major !== currentParsed.major) {
      return newParsed.major > currentParsed.major;
    }
    if (newParsed.minor !== currentParsed.minor) {
      return newParsed.minor > currentParsed.minor;
    }
    if (newParsed.patch !== currentParsed.patch) {
      return newParsed.patch > currentParsed.patch;
    }
    if (newParsed.build !== currentParsed.build) {
      return newParsed.build > currentParsed.build;
    }

    // Same major.minor.patch.build - check prerelease
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
