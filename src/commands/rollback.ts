import * as p from "@clack/prompts";
import { getBackupService, type BackupMetadata } from "../core/backup";
import { formatBytes } from "../core/ui/progress";

interface RollbackOptions {
  extensionId?: string;
  editor?: string;
  backupId?: string;
  latest?: boolean;
  list?: boolean;
  force?: boolean;
  cleanup?: boolean;
  keepCount?: number;
  quiet?: boolean;
  json?: boolean;
  backupDir?: string;
}

export async function rollback(options: RollbackOptions) {
  const quiet = Boolean(options.quiet);
  const json = Boolean(options.json);
  const backupService = getBackupService(options.backupDir);

  try {
    // List mode - show available backups
    if (options.list) {
      const editor = options.editor as "vscode" | "cursor" | undefined;
      const backups = await backupService.listBackups(options.extensionId, editor);

      if (json) {
        console.log(JSON.stringify(backups, null, 2));
        return;
      }

      if (backups.length === 0) {
        if (!quiet) {
          p.log.info("No backups found");
        }
        return;
      }

      if (!quiet) {
        console.clear();
        p.intro("📦 Available Backups");

        for (const backup of backups) {
          const date = new Date(backup.timestamp);
          p.log.info(
            `${backup.extensionId} v${backup.extensionVersion} (${backup.editor})\n` +
              `  ID: ${backup.id}\n` +
              `  Date: ${date.toLocaleString()}\n` +
              `  Reason: ${backup.reason || "Manual backup"}`,
          );
        }

        // Show backup size info
        const sizeInfo = await backupService.getBackupSize();
        p.outro(`Total: ${sizeInfo.count} backups, ${formatBytes(sizeInfo.sizeBytes)}`);
      }
      return;
    }

    // Cleanup mode - remove old backups
    if (options.cleanup) {
      const keepCount = Number(options.keepCount ?? 3);
      const removed = await backupService.cleanupOldBackups(keepCount);

      if (json) {
        console.log(JSON.stringify({ removed, keepCount }, null, 2));
        return;
      }

      if (!quiet) {
        p.log.success(
          `Cleaned up ${removed} old backup(s), keeping latest ${keepCount} per extension`,
        );
      }
      return;
    }

    // Rollback mode - restore from backup
    if (!quiet && !json) {
      console.clear();
      p.intro("🔄 Rollback Extension");
    }

    let backupToRestore: BackupMetadata | null = null;

    // If backup ID provided, use it
    if (options.backupId) {
      const backups = await backupService.listBackups();
      backupToRestore = backups.find((b) => b.id === options.backupId) || null;

      if (!backupToRestore) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }
    }
    // If latest flag and extension ID provided, get latest backup
    else if (options.latest && options.extensionId) {
      const editor = options.editor as "vscode" | "cursor" | undefined;
      backupToRestore = await backupService.getLatestBackup(options.extensionId, editor);

      if (!backupToRestore) {
        throw new Error(`No backups found for extension: ${options.extensionId}`);
      }
    }
    // Interactive mode - let user select
    else if (!quiet && !json) {
      const editor = options.editor as "vscode" | "cursor" | undefined;
      const backups = await backupService.listBackups(options.extensionId, editor);

      if (backups.length === 0) {
        p.log.warn("No backups found");
        return;
      }

      const selected = await p.select({
        message: "Select backup to restore:",
        options: backups.map((backup) => {
          const date = new Date(backup.timestamp);
          return {
            value: backup.id,
            label: `${backup.extensionId} v${backup.extensionVersion}`,
            hint: `${backup.editor} - ${date.toLocaleString()}`,
          };
        }),
      });

      if (p.isCancel(selected)) {
        p.cancel("Rollback cancelled");
        process.exit(0);
      }

      backupToRestore = backups.find((b) => b.id === selected) || null;
    } else {
      throw new Error(
        "Please provide --backup-id, --latest with --extension-id, or run interactively",
      );
    }

    if (!backupToRestore) {
      throw new Error("No backup selected");
    }

    // Confirm rollback
    if (!quiet && !json && !options.force) {
      const confirm = await p.confirm({
        message: `Restore ${backupToRestore.extensionId} v${backupToRestore.extensionVersion} from backup?`,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.cancel("Rollback cancelled");
        process.exit(0);
      }
    }

    // Perform rollback
    const spinner = quiet || json ? null : p.spinner();
    spinner?.start("Restoring from backup...");

    await backupService.restoreExtension(backupToRestore.id, Boolean(options.force));

    spinner?.stop("Restore completed");

    if (json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            restored: backupToRestore,
          },
          null,
          2,
        ),
      );
    } else if (!quiet) {
      p.outro(
        `✅ Successfully restored ${backupToRestore.extensionId} v${backupToRestore.extensionVersion}`,
      );
    }
  } catch (error) {
    if (json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    } else {
      p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    }
    process.exit(1);
  }
}

export async function runRollbackUI(options: RollbackOptions) {
  await rollback(options);
}
