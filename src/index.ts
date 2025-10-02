#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig, convertCliToConfig, type Config } from "./config/constants";
import { initializeErrorHandler, handleErrorAndExit } from "./core/errors";
import packageJson from "../package.json";
import { outputFormatter } from "./core/output";
import type { CommandResult, GlobalOptions } from "./commands/base/types";
import type { BaseCommand } from "./commands/base/BaseCommand";

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

/**
 * Wrap command action with configuration loading and error handling
 * Legacy wrapper for v1.x commands (preserved during migration)
 */
async function withConfigAndErrorHandling<T extends Record<string, unknown>>(
  action: (config: Config, options: T) => Promise<void>,
  options: T,
): Promise<void> {
  try {
    // Get global config file path if set
    const globalOpts = program.opts();
    const configFilePath = globalOpts.config;

    // Convert CLI options to config format
    const cliConfig = convertCliToConfig(options);

    // Load full configuration (CLI > ENV > FILE > DEFAULTS)
    const config = await loadConfig(cliConfig, configFilePath);

    // Update error handler with config settings
    initializeErrorHandler(config.quiet, config.json);

    // Execute command with loaded config
    await action(config, options);
  } catch (error) {
    handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
  }
}

const program = new Command();

program
  .name("vsix-extension-manager")
  .description(
    "VSIX Extension Manager: download, list versions, export, and manage VS Code/Cursor extensions",
  )
  .version(packageJson.version)
  .option("--config <path>", "Path to configuration file");

// ============================================================================
// V2.0 COMMANDS (Integration Phase)
// ============================================================================

/**
 * add - Universal entry point for adding extensions
 * Integration Phase: First v2.0 command with Phase 2 systems integrated
 * Consolidates: download, quick-install, from-list, install, install-direct
 */
program
  .command("add <input>")
  .description("Add extensions (universal entry point) - detects input type automatically")
  .option("-e, --editor <type>", "Target editor: cursor|vscode|auto (default: auto)")
  .option("--code-bin <path>", "VS Code binary path")
  .option("--cursor-bin <path>", "Cursor binary path")
  .option("--allow-mismatch", "Allow binary mismatch")
  .option("--download-only", "Download without installing")
  .option("--source <registry>", "Registry: marketplace|open-vsx|auto (default: auto)")
  .option("--version <version>", "Specific version")
  .option("--pre-release", "Use pre-release version")
  .option("--parallel <n>", "Parallel operations (1-10)", "3")
  .option("--timeout <sec>", "Timeout in seconds", "30")
  .option("--retry <n>", "Retry attempts", "3")
  .option("--retry-delay <ms>", "Delay between retries (ms)", "1000")
  .option("--force", "Force reinstall/overwrite")
  .option("--skip-installed", "Skip already installed")
  .option("--output <path>", "Output directory")
  .option("--check-compat", "Check compatibility")
  .option("--no-backup", "Skip automatic backup")
  .option("--verify-checksum", "Verify download checksums")
  .option("-y, --yes", "Auto-confirm all prompts")
  .option("--quiet", "Minimal output")
  .option("--json", "JSON output")
  .option("--debug", "Debug logging")
  .option("--plan", "Show execution plan without running")
  .option("--dry-run", "Validate only, no execution")
  .action(async (input, opts) => {
    await withV2CommandHandling(() => import("./commands/add"), [input], opts);
  });

// ============================================================================
// V2.0 COMMANDS - Clean Slate
// ============================================================================
// Legacy v1.x commands have been removed. All functionality is now available
// through the v2.0 command structure below.

program
  .command("rollback")
  .description("Rollback extensions from backups")
  .option("--extension-id <id>", "Extension ID to rollback")
  .option("-e, --editor <editor>", "Filter by editor: vscode|cursor")
  .option("--backup-id <id>", "Specific backup ID to restore")
  .option("--latest", "Restore latest backup for the extension", false)
  .option("--list", "List available backups", false)
  .option("--force", "Force restore even if extension exists", false)
  .option("--cleanup", "Clean up old backups", false)
  .option("--keep-count <n>", "Number of backups to keep per extension (default: 3)")
  .option("--quiet", "Reduce output", false)
  .option("--json", "Machine-readable output", false)
  .option("--backup-dir <path>", "Custom backup directory (default: ~/.vsix-backups)")
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { rollback } = await import("./commands/rollback");
      // Don't merge config for rollback - it has different options
      await rollback(options);
    }, opts);
  });

// Default action when no command specified - show interactive menu
program.action(async () => {
  await withConfigAndErrorHandling(async (config) => {
    const { runInteractive } = await import("./commands/interactive");
    await runInteractive(config);
  }, {});
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

// Wire v2.0 commands and parse arguments
(async () => {
  try {
    // ============================================================================
    // Startup: Config v2 Integration & First-Run Detection
    // ============================================================================
    
    // Check for configuration migration (v1 → v2)
    const { ConfigMigrator } = await import("./config/migrator");
    const migrator = new ConfigMigrator();
    const migrated = await migrator.autoMigrate();
    
    if (migrated) {
      console.log("✅ Configuration migrated to v2.0 format");
      console.log("");
    }
    
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
    
    // ============================================================================
    // Command Registration
    // ============================================================================
    
    // Core v2.0 commands
    await wireV2Command("add", ["get"]); // Universal entry point
    await wireV2Command("remove", ["rm"]); // Enhanced uninstall
    await wireV2Command("list", ["ls"]); // Enhanced export
    await wireV2Command("info"); // Enhanced versions

    // Note: update command conflicts with existing "update-installed" alias
    // We'll keep old "update-installed" for now and add "upgrade" alias for new command
    await wireV2Command("update", ["upgrade"]);
    await wireV2Command("doctor"); // Health check & diagnostics
    await wireV2Command("setup"); // First-run configuration wizard

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
