/**
 * Update Orchestrator Service
 * Coordinates version checking, planning, and execution
 * Replaces the monolithic updateInstalledService
 */

import os from "os";
import path from "path";
import fs from "fs-extra";
import { getEditorService, getInstallService } from "../../install";
import { getUpdatePlanService } from "./updatePlanService";
import { getUpdateExecutorService } from "./updateExecutorService";
import type { BackupMetadata } from "../../../core/backup";
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
  selectedExtensions?: string[];
  skipBackup?: boolean;
  backupDir?: string;
}

export interface UpdateItemResult {
  id: string;
  currentVersion: string;
  targetVersion: string;
  status: "updated" | "up-to-date" | "skipped" | "failed";
  error?: string;
  filePath?: string;
  elapsedMs: number;
  backupId?: string;
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
  backups: BackupMetadata[];
}

type MessageCallback = (message: string) => void;
type ProgressCallback = (id: string, progress: ProgressInfo) => void;

/**
 * Orchestrator for update operations
 * Coordinates services and manages overall update flow
 */
export class UpdateOrchestratorService {
  private editorService = getEditorService();
  private installService = getInstallService();
  private planService = getUpdatePlanService();
  private executorService = getUpdateExecutorService();

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
    const preRelease = Boolean(options.preRelease);
    const sourcePref = (options.source || "auto") as "marketplace" | "open-vsx" | "auto";

    // Initialize summary
    const summary: UpdateSummary = {
      tempDir: "",
      totalDetected: 0,
      upToDate: 0,
      toUpdate: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      elapsedMs: 0,
      items: [],
      backups: [],
    };

    // Detect editor and resolve binary
    const available = await this.editorService.getAvailableEditors();
    if (available.length === 0) {
      throw new Error("No editors found. Please install VS Code or Cursor.");
    }

    const chosenEditor =
      editorPref === "auto"
        ? (available.find((e) => e.name === "cursor") || available[0]).name
        : editorPref;

    const explicitBin = chosenEditor === "vscode" ? options.codeBin : options.cursorBin;
    const binPath = await this.editorService.resolveEditorBinary(
      chosenEditor,
      explicitBin,
      Boolean(options.allowMismatchedBinary),
    );

    // Preflight validation
    const preflight = await this.installService.validatePrerequisites(binPath);
    if (!preflight.valid) {
      throw new Error(`Preflight checks failed: ${preflight.errors.join(", ")}`);
    }

    // Create update plan
    onMessage?.("Scanning installed extensions...");
    const planResult = await this.planService.createUpdatePlan({
      editor: chosenEditor,
      selectedExtensions: options.selectedExtensions,
      preRelease,
      source: sourcePref,
      retry,
      retryDelay,
      onProgress: (completed, total, extensionId) => {
        onMessage?.(
          `Checking versions: ${completed}/${total}${extensionId ? ` - ${extensionId}` : ""}`,
        );
      },
    });

    summary.totalDetected = planResult.totalScanned;
    summary.upToDate = planResult.upToDate.length;
    summary.toUpdate = planResult.plans.length;

    // Add up-to-date extensions to results
    planResult.upToDate.forEach((result) => {
      summary.items.push({
        id: result.id,
        currentVersion: result.currentVersion,
        targetVersion: result.latestVersion!,
        status: "up-to-date",
        elapsedMs: 0,
      });
    });

    // Add failed version checks to results
    planResult.failed.forEach((result) => {
      summary.items.push({
        id: result.id,
        currentVersion: result.currentVersion,
        targetVersion: result.currentVersion,
        status: "failed",
        error: result.error,
        elapsedMs: 0,
      });
    });
    summary.failed = planResult.failed.length;

    onMessage?.(
      `Found ${summary.upToDate} up-to-date, ${summary.failed} failed, ${planResult.plans.length} to update`,
    );

    // Early return if nothing to update
    if (planResult.plans.length === 0) {
      summary.elapsedMs = Date.now() - startAll;
      onMessage?.("All extensions are up-to-date!");
      return summary;
    }

    // Create temp directory
    const tempDirName = `vsix-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.join(os.tmpdir(), tempDirName);
    await fs.ensureDir(tempDir);
    summary.tempDir = tempDir;

    // Write extensions.json with recommended updates
    try {
      await fs.writeJson(
        path.join(tempDir, "extensions.json"),
        { recommendations: planResult.plans.map((p) => p.id) },
        { spaces: 2 },
      );
    } catch {}

    // Execute updates
    const executionResults = await this.executorService.executeUpdates(planResult.plans, {
      editor: chosenEditor,
      binaryPath: binPath,
      tempDir,
      parallel,
      retry,
      retryDelay,
      preRelease,
      source: sourcePref,
      dryRun: options.dryRun,
      quiet: options.quiet,
      skipBackup: options.skipBackup,
      backupDir: options.backupDir,
      backups: summary.backups, // Track backups in summary
      onProgress: (completed, total, extensionId) => {
        onMessage?.(`Updating: ${completed}/${total}${extensionId ? ` - ${extensionId}` : ""}`);
      },
      onDownloadProgress: onProgress,
    });

    // Process execution results
    for (const result of executionResults) {
      summary.items.push(result);
      if (result.status === "updated") {
        summary.updated++;
        if (result.backupId) {
          // Backup metadata already added during execution
        }
      } else if (result.status === "skipped") {
        summary.skipped++;
      } else if (result.status === "failed") {
        summary.failed++;
      }
    }

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
          },
          { spaces: 2 },
        );
      } catch {}
    }

    // Cleanup temp dir
    try {
      await fs.remove(tempDir);
    } catch {}

    summary.elapsedMs = Date.now() - startAll;
    return summary;
  }
}

// Global instance
let globalUpdateOrchestratorService: UpdateOrchestratorService | null = null;

export function getUpdateOrchestratorService(): UpdateOrchestratorService {
  if (!globalUpdateOrchestratorService) {
    globalUpdateOrchestratorService = new UpdateOrchestratorService();
  }
  return globalUpdateOrchestratorService;
}
