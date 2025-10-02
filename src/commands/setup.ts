/**
 * Setup Command - First-run configuration wizard
 * Interactive wizard for configuring VSIX Extension Manager
 */

import { BaseCommand } from "./base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "./base/types";
import { setupWizard } from "../core/setup";
import { ui } from "../core/ui";

/**
 * Setup command options
 */
export interface SetupOptions extends GlobalOptions {
  force?: boolean;
  quick?: boolean;
  output?: string;
}

/**
 * Setup command implementation
 */
class SetupCommand extends BaseCommand {
  async execute(_args: string[], options: GlobalOptions): Promise<CommandResult> {
    const context = this.createContext(options);
    const setupOptions = options as SetupOptions;

    try {
      let result;

      if (setupOptions.quick) {
        // Quick setup with minimal prompts
        result = await setupWizard.runQuick(setupOptions.output);
      } else if (setupOptions.quiet || setupOptions.json) {
        // Non-interactive setup with defaults
        result = await setupWizard.runNonInteractive({
          outputPath: setupOptions.output,
        });

        if (setupOptions.json) {
          console.log(JSON.stringify(result, null, 2));
        }
      } else {
        // Full interactive setup
        result = await setupWizard.run({
          forceOverwrite: setupOptions.force,
          outputPath: setupOptions.output,
        });
      }

      if (!result) {
        return {
          status: "ok",
          command: "setup",
          summary: "Setup cancelled or skipped",
          items: [],
          totals: {
            success: 0,
            failed: 0,
            skipped: 1,
            duration: this.getDuration(context),
          },
        };
      }

      return {
        status: "ok",
        command: "setup",
        summary: "Configuration created successfully",
        items: [
          {
            id: "config",
            status: "success" as const,
            duration: this.getDuration(context),
            details: {
              editor: result.editor.prefer,
              safety: result.safety["check-compatibility"],
              performance: `${result.performance["parallel-downloads"]} parallel downloads`,
            },
          },
        ],
        totals: {
          success: 1,
          failed: 0,
          skipped: 0,
          duration: this.getDuration(context),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!setupOptions.quiet && !setupOptions.json) {
        ui.log.error(`Setup failed: ${message}`);
      }

      return {
        status: "error",
        command: "setup",
        summary: `Setup failed: ${message}`,
        items: [],
        errors: [
          {
            code: "SETUP_FAILED",
            message,
          },
        ],
        totals: {
          success: 0,
          failed: 1,
          skipped: 0,
          duration: this.getDuration(context),
        },
      };
    }
  }

  getHelp(): CommandHelp {
    return {
      name: "setup",
      description: "Run first-time configuration wizard",
      usage: "vsix setup [options]",
      options: [
        {
          flag: "--quick",
          description: "Quick setup with minimal prompts",
        },
        {
          flag: "--force",
          description: "Overwrite existing configuration",
        },
        {
          flag: "--output <path>",
          description: "Custom output path for configuration file",
        },
        {
          flag: "--quiet",
          description: "Non-interactive mode with defaults",
        },
        {
          flag: "--json",
          description: "Output configuration as JSON",
        },
      ],
      examples: [
        "vsix setup",
        "vsix setup --quick",
        "vsix setup --force --output ./custom-config.yml",
      ],
    };
  }
}

/**
 * Export default instance for command registry
 */
export default new SetupCommand();
