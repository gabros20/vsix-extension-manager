#!/usr/bin/env node

import { Command } from "commander";
import { initializeErrorHandler, handleErrorAndExit } from "./core/errors";
import packageJson from "../package.json";
import { outputFormatter } from "./core/output";
import type { CommandResult, GlobalOptions } from "./commands/base/types";
import type { BaseCommand } from "./commands/base/BaseCommand";
import type { ConfigV2 } from "./config/constants";

/**
 * Wrap v2.0 command action with CommandResult handling and output formatting
 * Integration Phase: New wrapper for Phase 2 integrated commands
 */
async function withV2CommandHandling(
  commandModule: () => Promise<{ default: BaseCommand }>,
  args: string[],
  options: Record<string, unknown>,
): Promise<void> {
  try {
    // Import command dynamically
    const { default: command } = await commandModule();

    // Convert options to GlobalOptions
    const globalOptions: GlobalOptions = {
      editor: options.editor as any,
      codeBin: options.codeBin as string,
      cursorBin: options.cursorBin as string,
      allowMismatch: options.allowMismatch as boolean,
      quiet: options.quiet as boolean,
      json: options.json as boolean,
      yes: options.yes as boolean,
      debug: options.debug as boolean,
      source: options.source as any,
      version: options.version as string,
      preRelease: options.preRelease as boolean,
      parallel: options.parallel ? parseInt(options.parallel as string) : undefined,
      timeout: options.timeout ? parseInt(options.timeout as string) : undefined,
      retry: options.retry ? parseInt(options.retry as string) : undefined,
      retryDelay: options.retryDelay ? parseInt(options.retryDelay as string) : undefined,
      skipInstalled: options.skipInstalled as boolean,
      force: options.force as boolean,
      output: options.output as string,
      downloadOnly: options.downloadOnly as boolean,
      checkCompat: options.checkCompat as boolean,
      noBackup: options.noBackup as boolean,
      verifyChecksum: options.verifyChecksum as boolean,
      plan: options.plan as boolean,
      dryRun: options.dryRun as boolean,
      profile: options.profile as string,
      config: options.config as string,
    };

    // Execute command
    const result: CommandResult = await command.execute(args, globalOptions);

    // Format output based on options
    const formatted = outputFormatter.format(result, {
      format: globalOptions.json ? "json-pretty" : "human",
      quiet: globalOptions.quiet,
      includeStack: globalOptions.debug,
    });

    // Output result
    console.log(formatted.content);

    // Exit with appropriate code
    process.exit(formatted.exitCode);
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.error(JSON.stringify({ status: "error", error: errorMessage }, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}

// Legacy wrapper removed - v2.0 uses BaseCommand pattern for all commands

const program = new Command();

program
  .name("vsix-extension-manager")
  .description(
    "VSIX Extension Manager: download, list versions, export, and manage VS Code/Cursor extensions",
  )
  .version(packageJson.version)
  .option("--config <path>", "Path to configuration file");

// ============================================================================
// V2.0 COMMANDS - Clean Slate
// ============================================================================
// All commands are registered dynamically via wireV2Command() below
// No manual command registration needed

// Default action when no command specified - show interactive menu
program.action(async () => {
  // TODO: Implement proper v2.0 interactive mode
  const { runInteractive } = await import("./commands/interactive");
  const { DEFAULT_CONFIG_V2 } = await import("./config/constants");
  await runInteractive(DEFAULT_CONFIG_V2);
});

// =============================================================================
// v2.0 COMMAND STRUCTURE (New commands with smart routing)
// =============================================================================

/**
 * Wire a v2.0 command into Commander
 * Loads command from registry and sets up proper option handling
 */
async function wireV2Command(commandName: string, aliases: string[] = []): Promise<Command | null> {
  try {
    const { loadCommand, hasCommand } = await import("./commands/registry");

    if (!hasCommand(commandName)) {
      return null;
    }

    const commandInstance = await loadCommand(commandName);
    const help = commandInstance.getHelp();

    const cmd = program.command(help.name).description(help.description);

    // Add aliases
    aliases.forEach((alias) => cmd.alias(alias));

    // Add arguments if specified in usage
    if (help.usage && help.usage !== help.name) {
      const usageParts = help.usage.split(" ").slice(1); // Remove command name
      usageParts.forEach((part) => {
        // Skip generic [options] placeholder
        if (part.toLowerCase() === "[options]") {
          return;
        }

        if (part.startsWith("<") && part.endsWith(">")) {
          cmd.argument(part, "");
        } else if (part.startsWith("[") && part.endsWith("]")) {
          cmd.argument(part, "", undefined); // Optional argument
        }
      });
    }

    // Add all standard global options
    cmd
      .option("-e, --editor <type>", "Target editor (cursor|vscode|auto)")
      .option("--code-bin <path>", "VS Code binary path")
      .option("--cursor-bin <path>", "Cursor binary path")
      .option("--allow-mismatch", "Allow binary mismatch")
      .option("--source <registry>", "Registry (marketplace|open-vsx|auto)")
      .option("-v, --version <version>", "Specific version")
      .option("--pre-release", "Use pre-release version")
      .option("--parallel <n>", "Parallel operations", parseInt)
      .option("--timeout <sec>", "Timeout in seconds", parseInt)
      .option("--retry <n>", "Retry attempts", parseInt)
      .option("--retry-delay <ms>", "Delay between retries (ms)", parseInt)
      .option("--skip-installed", "Skip already installed")
      .option("--force", "Force reinstall/overwrite")
      .option("-o, --output <path>", "Output directory or file")
      .option("--check-compat", "Check compatibility")
      .option("--no-backup", "Skip automatic backup")
      .option("--verify-checksum", "Verify checksums")
      .option("--plan", "Show execution plan only")
      .option("--dry-run", "Validate only")
      .option("-y, --yes", "Auto-confirm prompts")
      .option("--quiet", "Minimal output")
      .option("--json", "JSON output")
      .option("--debug", "Debug logging");

    // Add command-specific options if defined
    if (help.options) {
      help.options.forEach((opt) => {
        cmd.option(opt.flag, opt.description, opt.defaultValue);
      });
    }

    cmd.action(async (...args) => {
      try {
        // Last argument is the Command object, second-to-last is options
        const options = args[args.length - 2];
        const positionalArgs = args.slice(0, -2);

        // Convert Commander options to GlobalOptions
        const globalOptions = {
          editor: options.editor,
          codeBin: options.codeBin,
          cursorBin: options.cursorBin,
          allowMismatch: options.allowMismatch,
          source: options.source,
          version: options.version,
          preRelease: options.preRelease,
          parallel: options.parallel,
          timeout: options.timeout,
          retry: options.retry,
          retryDelay: options.retryDelay,
          skipInstalled: options.skipInstalled,
          force: options.force,
          output: options.output,
          checkCompat: options.checkCompat,
          noBackup: options.noBackup,
          verifyChecksum: options.verifyChecksum,
          plan: options.plan,
          dryRun: options.dryRun,
          yes: options.yes,
          quiet: options.quiet,
          json: options.json,
          debug: options.debug,
          downloadOnly: options.downloadOnly,
        };

        // Initialize error handler
        initializeErrorHandler(globalOptions.quiet || false, globalOptions.json || false);

        // Execute command
        const result = await commandInstance.execute(positionalArgs, globalOptions);

        // Handle result
        if (globalOptions.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.status === "ok") {
          // Success message already shown by command
        } else {
          handleErrorAndExit(new Error(result.summary));
        }
      } catch (error) {
        handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
      }
    });

    return cmd;
  } catch (error) {
    console.error(`Failed to load v2.0 command '${commandName}':`, error);
    return null;
  }
}

/**
 * Background update checker - non-blocking
 * Checks for extension updates and shows a subtle notification if available
 */
async function checkForUpdatesInBackground(): Promise<void> {
  try {
    const { UpdateChecker } = await import("./core/updates/UpdateChecker");
    const checker = new UpdateChecker();

    // Check with weekly frequency (respects cache)
    const result = await checker.checkForUpdates("weekly");

    // Only show notification if updates are available
    if (result.updates.length > 0) {
      console.log(""); // Empty line for spacing
      console.log(
        `💡 ${result.updates.length} extension update${result.updates.length > 1 ? "s" : ""} available`,
      );
      console.log(`   Run 'vsix update' to review and install`);
      console.log(""); // Empty line for spacing
    }
  } catch (error) {
    // Silently fail - don't interrupt user workflow
  }
}

// Wire v2.0 commands and parse arguments
(async () => {
  try {
    // ============================================================================
    // Startup: First-Run Detection (Clean Slate v2.0)
    // ============================================================================

    // Check for first run and offer setup wizard
    // Only run if not executing setup command explicitly
    const args = process.argv.slice(2);
    const isSetupCommand = args.includes("setup");
    const isHelpFlag = args.includes("--help") || args.includes("-h");
    const isVersionFlag = args.includes("--version") || args.includes("-V");

    if (!isSetupCommand && !isHelpFlag && !isVersionFlag) {
      const { handleFirstRun } = await import("./core/setup/firstRun");

      // Get global options to check for quiet/json modes
      const globalOpts = program.opts();
      const quiet = globalOpts.quiet || args.includes("--quiet");
      const json = globalOpts.json || args.includes("--json");

      const ranWizard = await handleFirstRun({
        skip: quiet || json,
        quiet: quiet || json,
      });

      // If wizard ran, we might want to reload config
      // but for now we'll let each command load its own config
    }

    // Background update check (non-blocking, fires and forgets)
    // Only check if not in quiet/json mode and not help/version
    if (!isHelpFlag && !isVersionFlag) {
      const globalOpts = program.opts();
      const quiet = globalOpts.quiet || args.includes("--quiet");
      const json = globalOpts.json || args.includes("--json");

      if (!quiet && !json) {
        // Fire and forget - don't wait for update check
        checkForUpdatesInBackground().catch(() => {
          // Silently fail - don't interrupt user workflow
        });
      }
    }

    // ============================================================================
    // Command Registration
    // ============================================================================

    // Core v2.0 commands
    await wireV2Command("add", ["get"]); // Universal entry point
    await wireV2Command("remove", ["rm"]); // Enhanced uninstall
    await wireV2Command("update", ["upgrade"]); // Smart update with rollback
    await wireV2Command("list", ["ls"]); // Enhanced export
    await wireV2Command("info"); // Enhanced versions
    await wireV2Command("doctor"); // Health check & diagnostics
    await wireV2Command("setup"); // First-run configuration wizard
    await wireV2Command("rollback", ["rb"]); // Restore from backups

    // TODO: Add remaining v2.0 commands as they're implemented
    // await wireV2Command('search');
    // await wireV2Command('workspace');
    // await wireV2Command('templates');

    // ============================================================================
    // Parse & Execute
    // ============================================================================

    // Parse arguments after all commands are registered
    await program.parseAsync();
  } catch (error) {
    console.error("Failed to initialize CLI:", error);
    process.exit(1);
  }
})();
