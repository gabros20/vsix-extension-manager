/**
 * Add Command - Universal entry point for adding extensions
 * Consolidates download, quick-install, from-list, install, and install-direct commands
 */

import { BaseCommand } from "../base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "../base/types";
import { inputDetector } from "./inputDetector";
import { addExecutor, type AddOptions } from "./executor";
import { UserInputError } from "../../core/errors";

/**
 * Add command - smart universal entry point
 * Automatically detects input type and executes appropriate workflow
 */
export class AddCommand extends BaseCommand {
  /**
   * Execute the add command
   */
  async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
    // Validate we have input
    if (args.length === 0) {
      throw new UserInputError(
        "No input provided. Expected URL, extension ID, file path, directory, or list file.",
      );
    }

    const input = args[0];

    // Detect input type
    const detection = await inputDetector.detectInputType(input);

    // Convert global options to add-specific options
    const addOptions: AddOptions = {
      editor: options.editor,
      codeBin: options.codeBin,
      cursorBin: options.cursorBin,
      allowMismatch: options.allowMismatch,
      source: options.source,
      version: options.version,
      preRelease: options.preRelease,
      downloadOnly: options.downloadOnly,
      skipInstalled: options.skipInstalled,
      force: options.force,
      output: options.output,
      parallel: options.parallel,
      timeout: options.timeout,
      retry: options.retry,
      retryDelay: options.retryDelay,
      checkCompat: options.checkCompat,
      noBackup: options.noBackup,
      verifyChecksum: options.verifyChecksum,
      quiet: options.quiet,
      json: options.json,
      yes: options.yes,
      dryRun: options.dryRun,
    };

    // Execute based on detected type
    return await addExecutor.execute(detection, addOptions);
  }

  /**
   * Get command help information
   */
  getHelp(): CommandHelp {
    return {
      name: "add",
      description:
        "Universal entry point for adding extensions. Automatically detects input type and executes the appropriate workflow.",
      usage: "vsix add <input> [options]",
      examples: [
        "vsix add https://marketplace.visualstudio.com/items?itemName=ms-python.python",
        "vsix add ms-python.python",
        "vsix add ./extension.vsix",
        "vsix add ./downloads",
        "vsix add extensions.txt",
        "vsix add https://example.com/ext.vsix --download-only",
        "vsix add ms-python.python --editor cursor --version 2024.2.0",
        "vsix add extensions.json --parallel 5",
      ],
      options: [
        { flag: "--editor <type>", description: "Target editor (cursor|vscode|auto)" },
        {
          flag: "--download-only",
          description: "Download without installing",
          defaultValue: "false",
        },
        { flag: "--source <registry>", description: "Registry (marketplace|open-vsx|auto)" },
        { flag: "--version <version>", description: "Specific version to install" },
        { flag: "--pre-release", description: "Use pre-release version", defaultValue: "false" },
        { flag: "--parallel <n>", description: "Parallel operations", defaultValue: "3" },
        { flag: "--force", description: "Force reinstall/overwrite", defaultValue: "false" },
        { flag: "--output <path>", description: "Output directory" },
        { flag: "--quiet", description: "Minimal output", defaultValue: "false" },
        { flag: "--json", description: "JSON output", defaultValue: "false" },
        { flag: "--yes", description: "Auto-confirm", defaultValue: "false" },
        { flag: "--dry-run", description: "Show plan without executing", defaultValue: "false" },
      ],
    };
  }
}

/**
 * Export singleton instance
 */
export default new AddCommand();
