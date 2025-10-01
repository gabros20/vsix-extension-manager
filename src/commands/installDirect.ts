import { Command } from "commander";
import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "node:path";
import { getDirectInstallService } from "../features/install/services/directInstallService";
import { getVsixScanner } from "../features/install/services/vsixScannerService";

interface InstallDirectOptions {
  vsix?: string;
  vsixDir?: string;
  editor?: "vscode" | "cursor";
  force?: boolean;
  quiet?: boolean;
  json?: boolean;
}

export function createInstallDirectCommand(): Command {
  const command = new Command("install-direct");
  command
    .description("Install VSIX files directly (bypasses VS Code CLI)")
    .option("-v, --vsix <path>", "Path to VSIX file")
    .option("-d, --vsix-dir <path>", "Path to directory containing VSIX files")
    .option("-e, --editor <editor>", "Target editor (vscode|cursor)", "vscode")
    .option("-f, --force", "Force reinstall if already installed")
    .option("-q, --quiet", "Quiet mode")
    .option("--json", "Output JSON results")
    .action(async (options: InstallDirectOptions) => {
      try {
        if (!options.quiet && !options.json) {
          p.intro("🚀 Direct VSIX Installation");
        }

        const directInstallService = getDirectInstallService();
        const vsixScanner = getVsixScanner();

        // Determine extensions directory
        const isCursor = options.editor === "cursor";
        const extensionsDir = isCursor
          ? path.join(process.env.HOME || "~", ".cursor", "extensions")
          : path.join(process.env.HOME || "~", ".vscode", "extensions");

        // Ensure extensions directory exists
        await fs.ensureDir(extensionsDir);

        let vsixFiles: string[] = [];

        if (options.vsix) {
          // Single VSIX file
          if (!(await fs.pathExists(options.vsix))) {
            p.log.error(`❌ VSIX file not found: ${options.vsix}`);
            process.exit(1);
          }
          vsixFiles = [options.vsix];
        } else if (options.vsixDir) {
          // Directory of VSIX files
          if (!(await fs.pathExists(options.vsixDir))) {
            p.log.error(`❌ Directory not found: ${options.vsixDir}`);
            process.exit(1);
          }
          const scanResult = await vsixScanner.scanDirectory(options.vsixDir);
          vsixFiles = scanResult.validVsixFiles.map((f) => f.path);
        } else {
          // Interactive mode
          const result = await p.text({
            message: "Enter path to VSIX file or directory:",
            validate: (input: string) => {
              const trimmed = input.trim();
              if (!trimmed) return "Please enter a path";
              if (!fs.existsSync(trimmed)) return "File or directory does not exist";
              return undefined;
            },
          });

          if (p.isCancel(result)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
          }

          const inputPath = result as string;
          if (fs.statSync(inputPath).isDirectory()) {
            const scanResult = await vsixScanner.scanDirectory(inputPath);
            vsixFiles = scanResult.validVsixFiles.map((f) => f.path);
          } else {
            vsixFiles = [inputPath];
          }
        }

        if (vsixFiles.length === 0) {
          p.log.error("❌ No VSIX files found");
          process.exit(1);
        }

        if (!options.quiet && !options.json) {
          p.log.info(`📦 Found ${vsixFiles.length} VSIX file(s)`);
          p.log.info(`🎯 Target: ${options.editor} (${extensionsDir})`);
        }

        // Install VSIX files
        const results = [];
        const startTime = Date.now();

        for (const vsixFile of vsixFiles) {
          if (!options.quiet && !options.json) {
            p.log.info(`📦 Installing ${path.basename(vsixFile)}...`);
          }

          const result = await directInstallService.installVsix(vsixFile, extensionsDir, {
            force: options.force,
          });

          results.push({
            vsixFile,
            success: result.success,
            error: result.error,
          });
        }

        const duration = Date.now() - startTime;
        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                total: results.length,
                successful,
                failed,
                duration,
                results,
              },
              null,
              2,
            ),
          );
        } else {
          p.log.info(`✅ Installation completed!`);
          p.log.info(
            `📊 Total: ${results.length} | Successful: ${successful} | Failed: ${failed} | Duration: ${Math.round(duration / 1000)}s`,
          );

          if (failed > 0) {
            p.log.warn(`❌ Failed installations:`);
            results
              .filter((r) => !r.success)
              .forEach((r) => {
                p.log.warn(`  • ${path.basename(r.vsixFile)}: ${r.error}`);
              });
          }
        }

        if (!options.quiet && !options.json) {
          p.outro("🎉 Direct installation completed!");
        }
      } catch (error) {
        if (!options.quiet && !options.json) {
          p.log.error(
            `❌ Installation failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        process.exit(1);
      }
    });

  return command;
}
