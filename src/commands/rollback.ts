/**
 * Rollback Command - Restore extensions from backups
 * Converted to BaseCommand pattern for v2.0 consistency
 */

import { BaseCommand } from "./base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "./base/types";
import { CommandResultBuilder } from "../core/output/CommandResultBuilder";
import { getBackupService, type BackupMetadata } from "../core/backup";
import { ui, promptPolicy } from "../core/ui";
import { formatBytes } from "../core/ui/progress";

/**
 * Rollback command options
 */
export interface RollbackOptions extends GlobalOptions {
  extensionId?: string;
  backupId?: string;
  latest?: boolean;
  list?: boolean;
  cleanup?: boolean;
  keepCount?: number;
  backupDir?: string;
}

/**
 * Rollback command implementation
 */
class RollbackCommand extends BaseCommand {
  async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("rollback");
    const rollbackOptions = options as RollbackOptions;
    const backupService = getBackupService(rollbackOptions.backupDir);

    try {
      // List mode - show available backups
      if (rollbackOptions.list) {
        return await this.handleListBackups(backupService, rollbackOptions, builder);
      }

      // Cleanup mode - remove old backups
      if (rollbackOptions.cleanup) {
        return await this.handleCleanup(backupService, rollbackOptions, builder);
      }

      // Rollback mode - restore from backup
      return await this.handleRollback(backupService, rollbackOptions, builder, args);
    } catch (error) {
      builder.addError({
        code: "ROLLBACK_ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
      return builder.build();
    }
  }

  /**
   * Handle listing available backups
   */
  private async handleListBackups(
    backupService: ReturnType<typeof getBackupService>,
    options: RollbackOptions,
    builder: CommandResultBuilder,
  ): Promise<CommandResult> {
    const editor = options.editor as "vscode" | "cursor" | undefined;
    const backups = await backupService.listBackups(options.extensionId, editor);

    if (backups.length === 0) {
      if (promptPolicy.isInteractive(options)) {
        ui.log.info("No backups found");
      }
      return builder.setSummary("No backups found").build();
    }

    // Add backups to result items
    for (const backup of backups) {
      const date = new Date(backup.timestamp);
      builder.addSuccess({
        id: backup.id,
        message: `${backup.extensionId} v${backup.extensionVersion} (${backup.editor})`,
        details: {
          extensionId: backup.extensionId,
          version: backup.extensionVersion,
          editor: backup.editor,
          timestamp: date.toISOString(),
          date: date.toLocaleString(),
          reason: backup.reason || "Manual backup",
        },
      });
    }

    // Show in UI if interactive
    if (promptPolicy.isInteractive(options)) {
      ui.intro("📦 Available Backups");

      for (const backup of backups) {
        const date = new Date(backup.timestamp);
        ui.log.info(
          `${backup.extensionId} v${backup.extensionVersion} (${backup.editor})\n` +
            `  ID: ${backup.id}\n` +
            `  Date: ${date.toLocaleString()}\n` +
            `  Reason: ${backup.reason || "Manual backup"}`,
        );
      }

      const sizeInfo = await backupService.getBackupSize();
      ui.outro(`Total: ${sizeInfo.count} backups, ${formatBytes(sizeInfo.sizeBytes)}`);
    }

    return builder
      .setSummary(`Found ${backups.length} backup(s)`)
      .setMetadata({ totalBackups: backups.length })
      .build();
  }

  /**
   * Handle cleanup of old backups
   */
  private async handleCleanup(
    backupService: ReturnType<typeof getBackupService>,
    options: RollbackOptions,
    builder: CommandResultBuilder,
  ): Promise<CommandResult> {
    const keepCount = Number(options.keepCount ?? 3);
    const removed = await backupService.cleanupOldBackups(keepCount);

    if (promptPolicy.isInteractive(options)) {
      ui.log.success(
        `Cleaned up ${removed} old backup(s), keeping latest ${keepCount} per extension`,
      );
    }

    return builder
      .setSummary(`Cleaned up ${removed} backup(s), kept ${keepCount} per extension`)
      .setMetadata({ removed, keepCount })
      .build();
  }

  /**
   * Handle rollback from backup
   */
  private async handleRollback(
    backupService: ReturnType<typeof getBackupService>,
    options: RollbackOptions,
    builder: CommandResultBuilder,
    args: string[],
  ): Promise<CommandResult> {
    if (promptPolicy.isInteractive(options)) {
      ui.intro("🔄 Rollback Extension");
    }

    let backupToRestore: BackupMetadata | null = null;

    // Determine which backup to restore
    if (options.backupId) {
      // Explicit backup ID provided
      const backups = await backupService.listBackups();
      backupToRestore = backups.find((b) => b.id === options.backupId) || null;

      if (!backupToRestore) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }
    } else if (options.latest && options.extensionId) {
      // Latest backup for specific extension
      const editor = options.editor as "vscode" | "cursor" | undefined;
      backupToRestore = await backupService.getLatestBackup(options.extensionId, editor);

      if (!backupToRestore) {
        throw new Error(`No backups found for extension: ${options.extensionId}`);
      }
    } else if (args.length > 0) {
      // Backup ID as positional argument
      const backupId = args[0];
      const backups = await backupService.listBackups();
      backupToRestore = backups.find((b) => b.id === backupId) || null;

      if (!backupToRestore) {
        throw new Error(`Backup not found: ${backupId}`);
      }
    } else if (promptPolicy.isInteractive(options)) {
      // Interactive mode - let user select
      const editor = options.editor as "vscode" | "cursor" | undefined;
      const backups = await backupService.listBackups(options.extensionId, editor);

      if (backups.length === 0) {
        ui.log.warning("No backups found");
        return builder.setSummary("No backups available").build();
      }

      const selected = await ui.select({
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

      if (selected === undefined) {
        ui.cancel("Rollback cancelled");
        return builder.setSummary("Rollback cancelled").build();
      }

      backupToRestore = backups.find((b) => b.id === selected) || null;
    } else {
      // Non-interactive mode requires explicit parameters
      promptPolicy.handleRequiredInput(
        "Backup identifier",
        "--backup-id or --latest with --extension-id",
        { options, command: "vsix-extension-manager rollback" },
      );
    }

    if (!backupToRestore) {
      throw new Error("No backup selected");
    }

    // Confirm rollback
    if (promptPolicy.shouldPrompt({ options, command: "rollback" }) && !options.force) {
      const confirmed = await ui.confirm(
        `Restore ${backupToRestore.extensionId} v${backupToRestore.extensionVersion} from backup?`,
        true,
      );

      if (!confirmed) {
        ui.cancel("Rollback cancelled");
        return builder.setSummary("Rollback cancelled").build();
      }
    }

    // Perform rollback
    const spinner = promptPolicy.isInteractive(options) ? ui.spinner() : null;
    spinner?.start("Restoring from backup...");

    try {
      await backupService.restoreExtension(backupToRestore.id, Boolean(options.force));

      spinner?.stop("Restore completed");

      builder.addSuccess({
        id: backupToRestore.extensionId,
        message: `Restored ${backupToRestore.extensionId} v${backupToRestore.extensionVersion}`,
        details: {
          version: backupToRestore.extensionVersion,
          editor: backupToRestore.editor,
          backupId: backupToRestore.id,
        },
      });

      if (promptPolicy.isInteractive(options)) {
        ui.outro(
          `✅ Successfully restored ${backupToRestore.extensionId} v${backupToRestore.extensionVersion}`,
        );
      }

      return builder
        .setSummary(
          `Successfully restored ${backupToRestore.extensionId} v${backupToRestore.extensionVersion}`,
        )
        .setMetadata({ restored: backupToRestore })
        .build();
    } catch (error) {
      spinner?.stop("Restore failed");
      throw error;
    }
  }

  getHelp(): CommandHelp {
    return {
      name: "rollback",
      description: "Restore extensions from backups",
      usage: "rollback [backup-id] [options]",
      examples: [
        "vsix-extension-manager rollback --list",
        "vsix-extension-manager rollback --latest --extension-id ms-python.python",
        "vsix-extension-manager rollback --backup-id abc123",
        "vsix-extension-manager rollback --cleanup --keep-count 5",
      ],
      options: [
        { flag: "--list", description: "List available backups" },
        { flag: "--backup-id <id>", description: "Restore specific backup by ID" },
        {
          flag: "--latest",
          description: "Restore latest backup (requires --extension-id)",
        },
        { flag: "--extension-id <id>", description: "Filter by extension ID" },
        { flag: "--cleanup", description: "Clean up old backups" },
        {
          flag: "--keep-count <n>",
          description: "Number of backups to keep per extension (default: 3)",
        },
        { flag: "--force", description: "Force restore without confirmation" },
        { flag: "--backup-dir <path>", description: "Custom backup directory" },
      ],
    };
  }
}

// Export singleton instance
export default new RollbackCommand();
