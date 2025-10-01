import fs from "fs-extra";
import path from "path";
import os from "os";
import { z } from "zod";

/**
 * Metadata for a single backup
 */
export const BackupMetadataSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  extensionVersion: z.string(),
  editor: z.enum(["vscode", "cursor"]),
  backupPath: z.string(),
  originalPath: z.string(),
  timestamp: z.string(),
  reason: z.string().optional(),
});

export type BackupMetadata = z.infer<typeof BackupMetadataSchema>;

/**
 * Backup history file schema
 */
export const BackupHistorySchema = z.object({
  version: z.literal("1.0"),
  backups: z.array(BackupMetadataSchema),
});

export type BackupHistory = z.infer<typeof BackupHistorySchema>;

export class BackupService {
  private backupRootDir: string;
  private historyFile: string;

  constructor(backupDir?: string) {
    this.backupRootDir = backupDir || path.join(os.homedir(), ".vsix-backups");
    this.historyFile = path.join(this.backupRootDir, "backup-history.json");
  }

  /**
   * Initialize backup directory and history file
   */
  private async ensureBackupDir(): Promise<void> {
    await fs.ensureDir(this.backupRootDir);

    // Initialize history file if it doesn't exist
    if (!(await fs.pathExists(this.historyFile))) {
      const initialHistory: BackupHistory = {
        version: "1.0",
        backups: [],
      };
      await fs.writeJson(this.historyFile, initialHistory, { spaces: 2 });
    }
  }

  /**
   * Load backup history
   */
  private async loadHistory(): Promise<BackupHistory> {
    await this.ensureBackupDir();
    try {
      const data = await fs.readJson(this.historyFile);
      return BackupHistorySchema.parse(data);
    } catch {
      // If history is corrupted, start fresh
      const freshHistory: BackupHistory = {
        version: "1.0",
        backups: [],
      };
      await fs.writeJson(this.historyFile, freshHistory, { spaces: 2 });
      return freshHistory;
    }
  }

  /**
   * Save backup history
   */
  private async saveHistory(history: BackupHistory): Promise<void> {
    await fs.writeJson(this.historyFile, history, { spaces: 2 });
  }

  /**
   * Create a backup of an extension
   */
  async backupExtension(
    extensionPath: string,
    extensionId: string,
    extensionVersion: string,
    editor: "vscode" | "cursor",
    reason?: string,
  ): Promise<BackupMetadata> {
    await this.ensureBackupDir();

    // Check disk space before creating backup
    const extensionSize = await this.getDirectorySize(extensionPath);
    const requiredSpace = extensionSize * 1.2; // 20% buffer for safety

    try {
      // Import check-disk-space dynamically to avoid bundling issues
      const checkDiskSpace = await import("check-disk-space").then((m) => m.default);
      const diskSpace = await checkDiskSpace(this.backupRootDir);

      if (diskSpace.free < requiredSpace) {
        const requiredMB = (requiredSpace / (1024 * 1024)).toFixed(2);
        const availableMB = (diskSpace.free / (1024 * 1024)).toFixed(2);
        throw new Error(
          `Insufficient disk space for backup. Required: ${requiredMB}MB, Available: ${availableMB}MB`,
        );
      }
    } catch (error) {
      // If check-disk-space fails or is not available, log warning but continue
      // This ensures backup functionality doesn't break on unsupported platforms
      if (error instanceof Error && error.message.includes("Insufficient disk space")) {
        throw error; // Re-throw disk space errors
      }
      console.warn(
        `[Backup] Could not verify disk space: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Generate unique backup ID
    const backupId = `${extensionId}-${extensionVersion}-${Date.now()}`;
    const backupPath = path.join(this.backupRootDir, editor, backupId);

    // Create backup (with cleanup on failure)
    try {
      await fs.copy(extensionPath, backupPath, {
        overwrite: false,
        errorOnExist: true,
      });
    } catch (error) {
      // Clean up partial backup on failure
      try {
        await fs.remove(backupPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      extensionId,
      extensionVersion,
      editor,
      backupPath,
      originalPath: extensionPath,
      timestamp: new Date().toISOString(),
      reason: reason || "Manual backup",
    };

    // Update history
    const history = await this.loadHistory();
    history.backups.push(metadata);
    await this.saveHistory(history);

    return metadata;
  }

  /**
   * Restore an extension from backup
   */
  async restoreExtension(backupId: string, force: boolean = false): Promise<void> {
    const history = await this.loadHistory();
    const backup = history.backups.find((b) => b.id === backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Check if backup files exist
    if (!(await fs.pathExists(backup.backupPath))) {
      throw new Error(`Backup files missing: ${backup.backupPath}`);
    }

    // Check if target exists and handle accordingly
    const targetExists = await fs.pathExists(backup.originalPath);
    if (targetExists && !force) {
      throw new Error(
        `Extension already exists at ${backup.originalPath}. Use --force to overwrite.`,
      );
    }

    // Remove existing if force is true
    if (targetExists && force) {
      await fs.remove(backup.originalPath);
    }

    // Restore from backup
    await fs.copy(backup.backupPath, backup.originalPath, {
      overwrite: true,
    });
  }

  /**
   * List all backups for an extension
   */
  async listBackups(extensionId?: string, editor?: "vscode" | "cursor"): Promise<BackupMetadata[]> {
    const history = await this.loadHistory();
    let backups = history.backups;

    if (extensionId) {
      backups = backups.filter((b) => b.extensionId === extensionId);
    }

    if (editor) {
      backups = backups.filter((b) => b.editor === editor);
    }

    // Sort by timestamp (newest first)
    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Get latest backup for an extension
   */
  async getLatestBackup(
    extensionId: string,
    editor?: "vscode" | "cursor",
  ): Promise<BackupMetadata | null> {
    const backups = await this.listBackups(extensionId, editor);
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Clean up old backups (keep last N backups per extension)
   */
  async cleanupOldBackups(keepCount: number = 3): Promise<number> {
    const history = await this.loadHistory();
    const backupsByExtension = new Map<string, BackupMetadata[]>();

    // Group backups by extension
    for (const backup of history.backups) {
      const key = `${backup.editor}-${backup.extensionId}`;
      if (!backupsByExtension.has(key)) {
        backupsByExtension.set(key, []);
      }
      backupsByExtension.get(key)!.push(backup);
    }

    let removedCount = 0;
    const newBackups: BackupMetadata[] = [];

    // Keep only the latest N backups per extension
    for (const [, backups] of backupsByExtension) {
      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      // Keep the latest N
      const toKeep = backups.slice(0, keepCount);
      const toRemove = backups.slice(keepCount);

      newBackups.push(...toKeep);

      // Remove old backup files
      for (const backup of toRemove) {
        try {
          await fs.remove(backup.backupPath);
          removedCount++;
        } catch {
          // Ignore errors for missing files
        }
      }
    }

    // Update history
    history.backups = newBackups;
    await this.saveHistory(history);

    return removedCount;
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const history = await this.loadHistory();
    const backupIndex = history.backups.findIndex((b) => b.id === backupId);

    if (backupIndex === -1) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const backup = history.backups[backupIndex];

    // Remove backup files
    try {
      await fs.remove(backup.backupPath);
    } catch {
      // Continue even if files are already missing
    }

    // Remove from history
    history.backups.splice(backupIndex, 1);
    await this.saveHistory(history);
  }

  /**
   * Get backup directory size
   */
  async getBackupSize(): Promise<{ count: number; sizeBytes: number }> {
    const history = await this.loadHistory();
    let totalSize = 0;
    let count = 0;

    for (const backup of history.backups) {
      try {
        const stats = await fs.stat(backup.backupPath);
        if (stats.isDirectory()) {
          const size = await this.getDirectorySize(backup.backupPath);
          totalSize += size;
          count++;
        }
      } catch {
        // Skip missing backups
      }
    }

    return { count, sizeBytes: totalSize };
  }

  /**
   * Calculate directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        const stats = await fs.stat(filePath);
        size += stats.size;
      }
    }

    return size;
  }
}

// Global instance accessor
let globalBackupService: BackupService | null = null;
export function getBackupService(backupDir?: string): BackupService {
  if (!globalBackupService) {
    globalBackupService = new BackupService(backupDir);
  }
  return globalBackupService;
}
