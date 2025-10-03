/**
 * Info Command - Show detailed extension information
 * Enhanced from versions.ts with richer extension details
 * Integration Phase: Now uses CommandResultBuilder
 */

import { BaseCommand } from "./base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "./base/types";
import { CommandResultBuilder } from "../core/output/CommandResultBuilder";
import { fetchExtensionVersions } from "../core/registry";
import { ui, promptPolicy } from "../core/ui";

/**
 * Info command options
 */
export interface InfoOptions extends GlobalOptions {
  all?: boolean; // Show all versions (not just latest)
  limit?: number; // Limit number of versions shown
}

/**
 * Info command implementation
 */
export class InfoCommand extends BaseCommand {
  async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("info");
    const infoOptions = options as InfoOptions;

    // Validate arguments
    if (args.length === 0) {
      throw new Error("Extension ID is required. Usage: vsix info <extension-id>");
    }

    const extensionId = args[0];

    ui.intro(`ℹ️  Extension Info: ${extensionId}`);

    try {
      // Fetch versions
      const spinner = ui.spinner();
      if (!options.quiet && !options.json) {
        spinner.start(`Fetching information for ${extensionId}...`);
      }

      const versions = await fetchExtensionVersions(extensionId);

      if (!options.quiet && !options.json) {
        spinner.stop("Information retrieved");
      }

      if (versions.length === 0) {
        ui.log.warning("No versions found for this extension");
        return builder.setSummary("No versions found").build();
      }

      // Determine how many versions to show
      const limit = infoOptions.limit || (infoOptions.all ? versions.length : 10);
      const versionsToShow = versions.slice(0, limit);

      // Show information in interactive mode
      if (promptPolicy.isInteractive(options)) {
        // Map ExtensionVersionInfo[] to format expected by displayExtensionInfo
        const mappedAll = versions.map((v) => ({
          version: v.version,
          isPreRelease: false,
          lastUpdated: v.published,
        }));
        const mappedToShow = versionsToShow.map((v) => ({
          version: v.version,
          isPreRelease: false,
          lastUpdated: v.published,
        }));
        this.displayExtensionInfo(extensionId, mappedAll, mappedToShow, infoOptions);
      }

      // Add versions to builder
      versionsToShow.forEach((v) => {
        builder.addSuccess({
          id: extensionId,
          name: extensionId,
          version: v.version,
        });
      });

      ui.outro(`Found ${versions.length} version(s)`);

      return builder.setSummary(`Found ${versions.length} versions`).build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (promptPolicy.isInteractive(options)) {
        ui.log.error(message);
      }

      return CommandResultBuilder.fromError(
        "info",
        error instanceof Error ? error : new Error(message),
      );
    }
  }

  /**
   * Display extension information in interactive mode
   */
  private displayExtensionInfo(
    extensionId: string,
    allVersions: Array<{ version: string; isPreRelease: boolean; lastUpdated?: string }>,
    versionsToShow: Array<{ version: string; isPreRelease: boolean; lastUpdated?: string }>,
    options: InfoOptions,
  ): void {
    // Summary
    const latest = allVersions[0];
    const latestPreRelease = allVersions.find((v) => v.isPreRelease);

    const summaryLines = [
      `📦 Extension ID: ${extensionId}`,
      `🔖 Latest Version: ${latest.version}${latest.isPreRelease ? " (pre-release)" : ""}`,
    ];

    if (latestPreRelease && latestPreRelease.version !== latest.version) {
      summaryLines.push(`🚧 Latest Pre-release: ${latestPreRelease.version}`);
    }

    summaryLines.push(`📊 Total Versions: ${allVersions.length}`);

    ui.note(summaryLines.join("\n"), "Summary");

    // Version list
    const versionLines: string[] = [];

    if (options.all || versionsToShow.length < allVersions.length) {
      versionLines.push(
        `Showing ${versionsToShow.length} of ${allVersions.length} versions${options.all ? "" : " (use --all to see all)"}`,
      );
      versionLines.push("");
    }

    for (let i = 0; i < versionsToShow.length; i++) {
      const v = versionsToShow[i];
      const badge = v.isPreRelease ? "[pre-release]" : "[stable]";
      const date = v.lastUpdated
        ? new Date(v.lastUpdated).toISOString().split("T")[0]
        : "unknown date";

      versionLines.push(
        `${(i + 1).toString().padStart(3)}. ${v.version.padEnd(15)} ${badge.padEnd(14)} ${date}`,
      );
    }

    ui.log.message("\n" + versionLines.join("\n") + "\n");

    // Installation hints
    const hintsLines = [
      `Install latest: vsix add ${extensionId}`,
      `Install specific: vsix add ${extensionId} --version ${versionsToShow[0].version}`,
    ];

    if (latestPreRelease) {
      hintsLines.push(`Install pre-release: vsix add ${extensionId} --pre-release`);
    }

    ui.note(hintsLines.join("\n"), "💡 Installation Commands");
  }

  /**
   * Get command help
   */
  getHelp(): CommandHelp {
    return {
      name: "info",
      description: "Show detailed information about an extension including available versions",
      usage: "vsix info <extension-id> [options]",
      examples: [
        "vsix info ms-python.python",
        "vsix info ms-python.python --all",
        "vsix info ms-python.python --limit 5",
        "vsix info dbaeumer.vscode-eslint --json",
      ],
      options: [
        {
          flag: "--all",
          description: "Show all available versions",
          defaultValue: "false",
        },
        {
          flag: "--limit <n>",
          description: "Limit number of versions shown",
          defaultValue: "10",
        },
        {
          flag: "--source <registry>",
          description: "Registry (marketplace|open-vsx)",
          defaultValue: "marketplace",
        },
        { flag: "--quiet", description: "Minimal output", defaultValue: "false" },
        { flag: "--json", description: "JSON output", defaultValue: "false" },
      ],
    };
  }
}

/**
 * Export singleton instance
 */
export default new InfoCommand();
