/**
 * Remove Command - Uninstall extensions with enhanced backup
 * Refactored from uninstallExtensions.ts with automatic backup integration
 * Integration Phase: Now uses CommandResultBuilder
 */

import { BaseCommand } from "./base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "./base/types";
import { CommandResultBuilder } from "../core/output/CommandResultBuilder";
import { getUninstallExtensionsService } from "../features/uninstall";
import { getEditorService } from "../features/install";
import { getInstalledExtensions } from "../features/export";
import { ui, promptPolicy } from "../core/ui";

/**
 * Remove command options
 */
export interface RemoveOptions extends GlobalOptions {
  all?: boolean;
  ids?: string[];
}

/**
 * Remove command implementation
 */
export class RemoveCommand extends BaseCommand {
  async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("remove");
    const removeOptions = options as RemoveOptions;

    ui.intro("🗑️  Remove Extensions");

    try {
      // Determine which extensions to remove
      const extensionIds = await this.getExtensionsToRemove(args, removeOptions);

      if (extensionIds.length === 0) {
        ui.log.info("No extensions selected for removal");
        return builder.setSummary("No extensions removed").build();
      }

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
          // Multiple editors - need selection
          if (!promptPolicy.shouldPrompt({ options, command: "remove" })) {
            promptPolicy.handleRequiredInput("Editor", "--editor", {
              options,
              command: "vsix remove",
            });
          }

          const selected = await ui.selectEditor(available, "cursor");
          chosenEditor = selected.name;
        }
      } else {
        chosenEditor = editor as "vscode" | "cursor";
      }

      // Confirm removal (unless --yes or non-interactive)
      if (promptPolicy.shouldPrompt({ options, command: "remove" })) {
        const confirmed = await ui.confirm(
          `Remove ${extensionIds.length} extension(s) from ${chosenEditor === "cursor" ? "Cursor" : "VS Code"}?`,
          true,
        );

        if (!confirmed) {
          ui.cancel("Removal cancelled");
        }
      }

      // Show progress
      const spinner = ui.spinner();
      if (!options.quiet && !options.json) {
        spinner.start(`Removing ${extensionIds.length} extension(s)...`);
      }

      // Execute removal
      const uninstallService = getUninstallExtensionsService();
      const result = await uninstallService.uninstallExtensions({
        selectedExtensions: extensionIds,
        editor: chosenEditor as any,
        parallel: options.parallel || 2,
        retry: options.retry || 1,
        retryDelay: options.retryDelay || 1000,
        dryRun: options.dryRun,
      });

      if (!options.quiet && !options.json) {
        spinner.stop("Removal complete");
      }

      // Add results to builder
      interface UninstallResult {
        success: boolean;
        extensionId: string;
        error?: string;
      }

      result.results.forEach((r: UninstallResult) => {
        if (r.success) {
          builder.addSuccess({
            id: r.extensionId,
            name: r.extensionId,
          });
        } else {
          builder.addFailure({
            id: r.extensionId,
            name: r.extensionId,
          });
          builder.addError({
            code: "UNINSTALL_FAILED",
            message: r.error || "Unknown error",
            item: r.extensionId,
          });
        }
      });

      // Show summary in interactive mode
      if (promptPolicy.isInteractive(options)) {
        const builtResult = builder.build();
        if (builtResult.totals) {
          ui.showResultSummary(builtResult.totals);
        }

        if (builtResult.errors && builtResult.errors.length > 0) {
          ui.note(
            builtResult.errors.map((e) => `❌ ${e.item}: ${e.message}`).join("\n"),
            "Failed Removals",
          );
        }
      }

      const allSucceeded = result.failed === 0;
      ui.outro(
        allSucceeded
          ? `✅ Successfully removed ${result.uninstalled} extension(s)`
          : `⚠️  Removed ${result.uninstalled} of ${extensionIds.length} extension(s)`,
      );

      return builder
        .setSummary(`Removed ${result.uninstalled} of ${extensionIds.length} extensions`)
        .build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (promptPolicy.isInteractive(options)) {
        ui.log.error(message);
      }

      return CommandResultBuilder.fromError(
        "remove",
        error instanceof Error ? error : new Error(message),
      );
    }
  }

  /**
   * Determine which extensions to remove
   */
  private async getExtensionsToRemove(args: string[], options: RemoveOptions): Promise<string[]> {
    // If IDs provided as arguments, use those
    if (args.length > 0) {
      return args;
    }

    // If --ids flag provided, use those
    if (options.ids && options.ids.length > 0) {
      return options.ids;
    }

    // If --all flag, get all installed
    if (options.all) {
      return await this.getAllInstalledIds(options);
    }

    // Interactive mode: prompt for selection
    if (promptPolicy.shouldPrompt({ options, command: "remove" })) {
      return await this.promptForExtensions(options);
    }

    // Non-interactive without args - error
    throw new Error(
      "No extensions specified. Provide extension IDs as arguments or use --all flag in non-interactive mode.",
    );
  }

  /**
   * Get all installed extension IDs
   */
  private async getAllInstalledIds(options: RemoveOptions): Promise<string[]> {
    const editor = (options.editor as "vscode" | "cursor") || "cursor";
    const installed = await getInstalledExtensions(editor);
    return installed.map((ext) => ext.id);
  }

  /**
   * Prompt user to select extensions to remove
   */
  private async promptForExtensions(options: RemoveOptions): Promise<string[]> {
    const editor = (options.editor as "vscode" | "cursor") || "cursor";
    const installed = await getInstalledExtensions(editor);

    if (installed.length === 0) {
      ui.log.warning("No extensions found");
      return [];
    }

    // Ask for mode
    const mode = await ui.select({
      message: "Choose removal mode:",
      options: [
        { value: "all", label: `Remove all ${installed.length} extensions` },
        { value: "selected", label: "Select specific extensions" },
      ],
    });

    if (mode === "all") {
      return installed.map((ext) => ext.id);
    }

    // Multi-select
    const selected = await ui.multiselect({
      message: `Select extensions to remove (${installed.length} available):`,
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
      name: "remove",
      description: "Uninstall extensions from VS Code or Cursor",
      usage: "vsix remove [extension-ids...] [options]",
      examples: [
        "vsix remove ms-python.python",
        "vsix remove ms-python.python dbaeumer.vscode-eslint",
        "vsix remove --all",
        "vsix remove --editor cursor --all",
        "vsix remove ms-python.python --dry-run",
      ],
      options: [
        { flag: "--editor <type>", description: "Target editor (cursor|vscode|auto)" },
        { flag: "--all", description: "Remove all installed extensions", defaultValue: "false" },
        { flag: "--parallel <n>", description: "Parallel removals", defaultValue: "2" },
        { flag: "--dry-run", description: "Show what would be removed", defaultValue: "false" },
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
export default new RemoveCommand();
