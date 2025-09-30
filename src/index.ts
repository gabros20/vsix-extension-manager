#!/usr/bin/env node

import { Command } from "commander";
import { downloadVsix } from "./commands/download";
import { loadConfig, convertCliToConfig, type Config } from "./config/constants";
import { initializeErrorHandler, handleErrorAndExit } from "./core/errors";
import packageJson from "../package.json";

/**
 * Wrap command action with configuration loading and error handling
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

program
  .command("download")
  .alias("dl")
  .description("Download a VSIX file from marketplace URL")
  .option("-u, --url <url>", "Marketplace URL of the extension")
  .option("-v, --version <version>", "Version of the extension to download")
  .option("-o, --output <path>", "Output directory (default: ./downloads)")
  .option("-f, --file <path>", "Bulk JSON file path (non-interactive mode)")
  .option("--parallel <n>", "Number of parallel downloads (bulk mode)")
  .option("--retry <n>", "Number of retry attempts per item (bulk mode)")
  .option("--retry-delay <ms>", "Delay in ms between retries (bulk mode)")
  .option("--skip-existing", "Skip downloads if target file already exists", false)
  .option("--overwrite", "Overwrite existing files", false)
  .option("--quiet", "Reduce output (non-interactive)", false)
  .option("--json", "Machine-readable logs (where applicable)", false)
  .option("--summary <path>", "Write bulk summary JSON to the given path")
  .option("--pre-release", "Prefer pre-release when resolving 'latest'", false)
  .option("--source <source>", "Source registry: marketplace|open-vsx|auto (default: marketplace)")
  .option(
    "--filename-template <template>",
    "Custom filename template (default: {name}-{version}.vsix)",
  )
  .option("--cache-dir <path>", "Cache directory for downloads (overrides output)")
  .option("--checksum", "Generate SHA256 checksum for downloaded files", false)
  .option("--verify-checksum <hash>", "Verify downloaded file against provided SHA256 hash")
  .option("--install-after", "Install downloaded extensions after successful downloads", false)
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      await downloadVsix({ ...options, ...config });
    }, opts);
  });

program
  .command("quick-install")
  .alias("qi")
  .description("Quickly download an extension by URL to a temp dir, install it, then clean up")
  .option("-u, --url <url>", "Marketplace or OpenVSX URL of the extension")
  .option("-e, --editor <editor>", "Target editor: vscode|cursor|auto (default: auto)")
  .option("--code-bin <path>", "Explicit path to VS Code binary")
  .option("--cursor-bin <path>", "Explicit path to Cursor binary")
  .option(
    "--allow-mismatched-binary",
    "Allow proceeding when resolved binary identity mismatches the requested editor",
    false,
  )
  .option("--pre-release", "Prefer pre-release when resolving 'latest'", false)
  .option("--source <source>", "Source registry: marketplace|open-vsx|auto (default: auto)")
  .option("--dry-run", "Show what would be installed without making changes", false)
  .option("--quiet", "Reduce output", false)
  .option("--json", "Machine-readable output", false)
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { quickInstall } = await import("./commands/quickInstall");
      await quickInstall({ ...options, ...config });
    }, opts);
  });

program
  .command("versions")
  .description("List available versions for an extension")
  .option("-u, --url <url>", "Marketplace URL of the extension")
  .option("--json", "Output JSON", false)
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { listVersions } = await import("./commands/versions");
      await listVersions({ ...options, ...config });
    }, opts);
  });

program
  .command("export-installed")
  .alias("export")
  .description("Export currently installed extensions from VS Code or Cursor")
  .option("-o, --output <path>", "Output file path")
  .option("-f, --format <format>", "Output format: txt|extensions.json")
  .option("-e, --editor <editor>", "Editor to export from: vscode|cursor|auto (default: auto)")
  .option("-w, --workspace", "Export workspace extensions.json instead of installed", false)
  .option("--json", "Machine-readable output", false)
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { exportInstalled } = await import("./commands/exportInstalled");
      await exportInstalled({ ...options, ...config });
    }, opts);
  });

program
  .command("from-list")
  .description("Download extensions from a list file")
  .option("-f, --file <path>", "Path to extensions list file")
  .option("-o, --output <path>", "Output directory (default: ./downloads)")
  .option("--format <format>", "Input file format: txt|extensions.json|auto")
  .option("--parallel <n>", "Number of parallel downloads")
  .option("--retry <n>", "Number of retry attempts per item")
  .option("--retry-delay <ms>", "Delay in ms between retries")
  .option("--skip-existing", "Skip downloads if target file already exists", false)
  .option("--overwrite", "Overwrite existing files", false)
  .option("--quiet", "Reduce output", false)
  .option("--json", "Machine-readable logs", false)
  .option("--summary <path>", "Write bulk summary JSON to the given path")
  .option("--pre-release", "Prefer pre-release when resolving 'latest'", false)
  .option("--source <source>", "Source registry: marketplace|open-vsx|auto (default: auto)")
  .option("--filename-template <template>", "Custom filename template")
  .option("--cache-dir <path>", "Cache directory for downloads")
  .option("--checksum", "Generate SHA256 checksum for downloaded files", false)
  .option(
    "--install",
    "Install extensions after downloading (requires --download-missing behavior)",
    false,
  )
  .option("--download-only", "Download only, do not install (default behavior)", false)
  .option("--check-compatibility", "Check extension compatibility with editor version", false)
  .option(
    "--editor <editor>",
    "Target editor for compatibility check: vscode|cursor|auto (default: auto)",
  )
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { fromList } = await import("./commands/fromList");
      await fromList({ ...options, ...config });
    }, opts);
  });

program
  .command("install")
  .description("Install VSIX files or extensions from lists into VS Code/Cursor")
  .option("--vsix <path>", "Single VSIX file to install")
  .option("--vsix-dir <paths...>", "Directories to scan for VSIX files (recursive)")
  .option("-f, --file <path>", "Extension list file (.txt or extensions.json) to install from")
  .option("--download-missing", "Download missing extensions when installing from list", false)
  .option("-e, --editor <editor>", "Target editor: vscode|cursor|auto (default: auto)")
  .option("--code-bin <path>", "Explicit path to VS Code binary")
  .option("--cursor-bin <path>", "Explicit path to Cursor binary")
  .option("--skip-installed", "Skip if same version already installed", false)
  .option("--force-reinstall", "Force reinstall even if same version", false)
  .option("--dry-run", "Show what would be installed without making changes", false)
  .option("--parallel <n>", "Number of parallel installs (default: 1)")
  .option("--retry <n>", "Number of retry attempts per install")
  .option("--retry-delay <ms>", "Delay in ms between retries")
  .option("--quiet", "Reduce output", false)
  .option("--json", "Machine-readable logs", false)
  .option("--summary <path>", "Write install summary JSON to the given path")
  .option(
    "--allow-mismatched-binary",
    "Allow proceeding when resolved binary identity mismatches the requested editor",
    false,
  )
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { installExtensions } = await import("./commands/install");
      await installExtensions({ ...options, ...config });
    }, opts);
  });

program
  .command("update-installed")
  .alias("update")
  .description("Update installed extensions to latest available versions")
  .option("-e, --editor <editor>", "Target editor: vscode|cursor|auto (default: auto)")
  .option("--pre-release", "Prefer pre-release when resolving 'latest'", false)
  .option("--source <source>", "Source registry: marketplace|open-vsx|auto (default: auto)")
  .option("--parallel <n>", "Number of parallel updates (default: 1)")
  .option("--retry <n>", "Number of retry attempts per extension")
  .option("--retry-delay <ms>", "Delay in ms between retries")
  .option("--quiet", "Reduce output", false)
  .option("--json", "Machine-readable output", false)
  .option("--dry-run", "Preview updates without downloading/installing", false)
  .option("--summary <path>", "Write update summary JSON to the given path")
  .option("--code-bin <path>", "Explicit path to VS Code binary")
  .option("--cursor-bin <path>", "Explicit path to Cursor binary")
  .option(
    "--allow-mismatched-binary",
    "Allow proceeding when resolved binary identity mismatches the requested editor",
    false,
  )
  .option("--skip-backup", "Skip creating backups before updating", false)
  .option("--backup-dir <path>", "Custom backup directory (default: ~/.vsix-backups)")
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { updateInstalled } = await import("./commands/updateInstalled");
      await updateInstalled({ ...options, ...config });
    }, opts);
  });

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

program
  .command("uninstall")
  .description("Uninstall extensions from VS Code/Cursor")
  .option("-e, --editor <editor>", "Target editor: vscode|cursor|auto (default: auto)")
  .option("--code-bin <path>", "Explicit path to VS Code binary")
  .option("--cursor-bin <path>", "Explicit path to Cursor binary")
  .option("--all", "Uninstall all extensions (non-interactive)", false)
  .option("--parallel <n>", "Number of parallel uninstalls (default: 1)")
  .option("--retry <n>", "Number of retry attempts per uninstall")
  .option("--retry-delay <ms>", "Delay in ms between retries")
  .option("--quiet", "Reduce output", false)
  .option("--json", "Machine-readable output", false)
  .option("--dry-run", "Show what would be uninstalled without making changes", false)
  .option("--summary <path>", "Write uninstall summary JSON to the given path")
  .option(
    "--allow-mismatched-binary",
    "Allow proceeding when resolved binary identity mismatches the requested editor",
    false,
  )
  .action(async (opts) => {
    await withConfigAndErrorHandling(async (config, options) => {
      const { uninstallExtensions } = await import("./commands/uninstallExtensions");
      await uninstallExtensions({ ...options, ...config });
    }, opts);
  });

program.action(async () => {
  await withConfigAndErrorHandling(async (config) => {
    const { runInteractive } = await import("./commands/interactive");
    await runInteractive(config);
  }, {});
});

program.parse();
