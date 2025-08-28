#!/usr/bin/env node

import { Command } from "commander";
import { downloadVsix } from "./commands/download";
import packageJson from "../package.json";

const program = new Command();

program
  .name("vsix-downloader")
  .description("Download VS Code extensions as VSIX files from the Visual Studio Marketplace")
  .version(packageJson.version);

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
  .action(downloadVsix);

program
  .command("versions")
  .description("List available versions for an extension")
  .option("-u, --url <url>", "Marketplace URL of the extension")
  .option("--json", "Output JSON", false)
  .action(async (opts) => {
    const { listVersions } = await import("./commands/versions");
    await listVersions(opts);
  });

program
  .command("export-installed")
  .alias("export")
  .description("Export currently installed extensions from VS Code or Cursor")
  .option("-o, --output <path>", "Output file path")
  .option("-f, --format <format>", "Output format: json|txt|extensions.json")
  .option("-e, --editor <editor>", "Editor to export from: vscode|cursor|auto (default: auto)")
  .option("-w, --workspace", "Export workspace extensions.json instead of installed", false)
  .option("--json", "Machine-readable output", false)
  .action(async (opts) => {
    const { exportInstalled } = await import("./commands/exportInstalled");
    await exportInstalled(opts);
  });

program
  .command("from-list")
  .alias("install")
  .description("Download extensions from a list file")
  .option("-f, --file <path>", "Path to extensions list file")
  .option("-o, --output <path>", "Output directory (default: ./downloads)")
  .option("--format <format>", "Input file format: json|txt|extensions.json|auto")
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
  .action(async (opts) => {
    const { fromList } = await import("./commands/fromList");
    await fromList(opts);
  });

// Default command - interactive mode
program.action(() => {
  downloadVsix({});
});

program.parse();
