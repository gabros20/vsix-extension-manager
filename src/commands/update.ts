/**
 * Update Command - Update installed extensions with smart rollback
 * Refactored from updateInstalled.ts with integrated backup/rollback
 */

import { BaseCommand } from "./base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "./base/types";
import { getUpdateInstalledService } from "../features/update";
import { getEditorService } from "../features/install";
import { getInstalledExtensions } from "../features/export";
import { ui, promptPolicy } from "../core/ui";

/**
 * Update command options
 */
export interface UpdateOptions extends GlobalOptions {
  ids?: string[];
  all?: boolean;
  checkCompat?: boolean;
}

/**
 * Update command implementation
 */
export class UpdateCommand extends BaseCommand {
  async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
    const context = this.createContext(options);
    const updateOptions = options as UpdateOptions;

    ui.intro("⬆️  Update Extensions");

    try {
      // Get editor info
      const editorService = getEditorService();
      const editor = options.editor || "auto";
      let chosenEditor: "vscode" | "cursor";

      if (editor === "auto") {
        const available = await editorService.getAvailableEditors();
        if (available.length === 0) {
          throw new Error("No editors found. Please install VS Code or Cursor.");
        }

        if (available.length === 1) {
          chosenEditor = available[0].name;
          if (promptPolicy.isInteractive(options)) {
            ui.log.info(`Auto-detected ${available[0].displayName}`);
          }
        } else {
          if (!promptPolicy.shouldPrompt({ options, command: "update" })) {
            promptPolicy.handleRequiredInput("Editor", "--editor", {
              options,
              command: "vsix update",
            });
          }

          const selected = await ui.selectEditor(available, "cursor");
          chosenEditor = selected.name;
        }
      } else {
        chosenEditor = editor as "vscode" | "cursor";
      }

      // Determine which extensions to update
      const extensionIds = await this.getExtensionsToUpdate(args, updateOptions, chosenEditor);

      if (extensionIds.length === 0) {
        ui.log.info("No extensions selected for update");
        return this.createSuccessResult("No extensions updated", {
          totals: {
            success: 0,
            failed: 0,
            skipped: 0,
            duration: this.getDuration(context),
          },
        });
      }

      // Show what will be updated
      if (promptPolicy.isInteractive(options)) {
        ui.note(`Will check ${extensionIds.length} extension(s) for updates`, "Update Plan");
      }

      // Confirm update
      if (promptPolicy.shouldPrompt({ options, command: "update" })) {
        const confirmed = await ui.confirm(
          `Check and update ${extensionIds.length} extension(s)?`,
          true,
        );

        if (!confirmed) {
          ui.cancel("Update cancelled");
        }
      }

      // Show progress
      const spinner = ui.spinner();
      if (!options.quiet && !options.json) {
        spinner.start("Checking for updates...");
      }

      // Execute update
      const updateService = getUpdateInstalledService();
      const result = await updateService.updateInstalled({
        editor: chosenEditor,
        extensionIds,
        downloadDir: options.output || "./downloads",
        checkCompatibility: updateOptions.checkCompat !== false,
        parallel: options.parallel || 1,
        installParallel: 1,
        installTimeout: options.timeout || 30000,
        installRetry: options.retry || 2,
        source: options.source,
        preRelease: options.preRelease,
        dryRun: options.dryRun,
        quiet: options.quiet,
        json: options.json,
      });

      if (!options.quiet && !options.json) {
        spinner.stop("Update check complete");
      }

      // Format results
      const items = result.extensions.map((ext) => ({
        id: ext.id,
        version: ext.newVersion || ext.currentVersion,
        status: ext.updated
          ? ("success" as const)
          : ext.skipped
            ? ("skipped" as const)
            : ("failed" as const),
        duration: 0,
        details: {
          oldVersion: ext.currentVersion,
          newVersion: ext.newVersion,
          updateAvailable: ext.updateAvailable,
        },
      }));

      const errors = result.extensions
        .filter((ext) => !ext.updated && !ext.skipped)
        .map((ext) => ({
          code: "UPDATE_FAILED",
          message: ext.error || "Update failed",
          item: ext.id,
        }));

      // Show summary
      if (promptPolicy.isInteractive(options)) {
        if (result.updatedCount > 0) {
          ui.log.success(`✅ Updated ${result.updatedCount} extension(s)`);
        }

        if (result.skippedCount > 0) {
          ui.log.info(`⏭️  Skipped ${result.skippedCount} extension(s) (already up-to-date)`);
        }

        if (result.failedCount > 0) {
          ui.log.error(`❌ Failed ${result.failedCount} extension(s)`);
        }

        ui.showResultSummary({
          success: result.updatedCount,
          failed: result.failedCount,
          skipped: result.skippedCount,
          duration: this.getDuration(context),
        });

        if (errors.length > 0) {
          ui.note(errors.map((e) => `❌ ${e.item}: ${e.message}`).join("\n"), "Failed Updates");
        }

        // Show backup ID if created
        if (result.backupId) {
          ui.note(
            `Backup created: ${result.backupId}\n` +
              `Rollback with: vsix rollback --backup-id ${result.backupId}`,
            "💾 Backup Info",
          );
        }
      }

      const allSucceeded = result.failedCount === 0;
      ui.outro(
        allSucceeded
          ? `✅ Update complete: ${result.updatedCount} updated, ${result.skippedCount} skipped`
          : `⚠️  Update incomplete: ${result.updatedCount} updated, ${result.failedCount} failed`,
      );

      return {
        status: allSucceeded ? "ok" : "error",
        command: "update",
        summary: `Updated ${result.updatedCount} of ${extensionIds.length} extensions`,
        items,
        errors,
        warnings:
          result.skippedCount > 0
            ? [`${result.skippedCount} extensions skipped (already up-to-date)`]
            : [],
        totals: {
          success: result.updatedCount,
          failed: result.failedCount,
          skipped: result.skippedCount,
          duration: this.getDuration(context),
        },
        metadata: {
          backupId: result.backupId,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (promptPolicy.isInteractive(options)) {
        ui.log.error(message);
      }

      return this.createErrorResult(message, {
        errors: [{ code: "UPDATE_FAILED", message }],
        totals: {
          success: 0,
          failed: 1,
          skipped: 0,
          duration: this.getDuration(context),
        },
      });
    }
  }

  /**
   * Determine which extensions to update
   */
  private async getExtensionsToUpdate(
    args: string[],
    options: UpdateOptions,
    editor: "vscode" | "cursor",
  ): Promise<string[]> {
    // If IDs provided as arguments, use those
    if (args.length > 0) {
      return args;
    }

    // If --ids flag provided, use those
    if (options.ids && options.ids.length > 0) {
      return options.ids;
    }

    // If --all or no arguments in non-interactive, update all
    if (options.all || !promptPolicy.shouldPrompt({ options, command: "update" })) {
      const installed = await getInstalledExtensions(editor);
      return installed.map((ext) => ext.id);
    }

    // Interactive mode: prompt for selection
    return await this.promptForExtensions(editor);
  }

  /**
   * Prompt user to select extensions to update
   */
  private async promptForExtensions(editor: "vscode" | "cursor"): Promise<string[]> {
    const installed = await getInstalledExtensions(editor);

    if (installed.length === 0) {
      ui.log.warn("No extensions found");
      return [];
    }

    // Ask for mode
    const mode = await ui.select({
      message: "Choose update mode:",
      options: [
        { value: "all", label: `Update all ${installed.length} extensions` },
        { value: "selected", label: "Select specific extensions" },
      ],
    });

    if (mode === "all") {
      return installed.map((ext) => ext.id);
    }

    // Multi-select
    const selected = await ui.multiselect({
      message: `Select extensions to update (${installed.length} available):`,
      options: installed.map((ext) => ({
        value: ext.id,
        label: `${ext.displayName || ext.id} (${ext.version})`,
      })),
      required: false,
    });

    return selected;
  }

  /**
   * Get command help
   */
  getHelp(): CommandHelp {
    return {
      name: "update",
      description: "Update installed extensions to latest versions",
      usage: "vsix update [extension-ids...] [options]",
      examples: [
        "vsix update",
        "vsix update --all",
        "vsix update ms-python.python",
        "vsix update ms-python.python dbaeumer.vscode-eslint",
        "vsix update --editor cursor --all",
        "vsix update --pre-release",
        "vsix update --dry-run",
      ],
      options: [
        { flag: "--editor <type>", description: "Target editor (cursor|vscode|auto)" },
        { flag: "--all", description: "Update all installed extensions", defaultValue: "false" },
        {
          flag: "--check-compat",
          description: "Check compatibility before updating",
          defaultValue: "true",
        },
        {
          flag: "--pre-release",
          description: "Include pre-release versions",
          defaultValue: "false",
        },
        { flag: "--source <registry>", description: "Registry (marketplace|open-vsx|auto)" },
        { flag: "--parallel <n>", description: "Parallel downloads", defaultValue: "1" },
        { flag: "--output <path>", description: "Download directory", defaultValue: "./downloads" },
        { flag: "--dry-run", description: "Show what would be updated", defaultValue: "false" },
        { flag: "--quiet", description: "Minimal output", defaultValue: "false" },
        { flag: "--json", description: "JSON output", defaultValue: "false" },
        { flag: "--yes", description: "Auto-confirm", defaultValue: "false" },
      ],
    };
  }
}

/**
 * Export singleton instance
 */
export default new UpdateCommand();
