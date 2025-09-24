import * as p from "@clack/prompts";
import path from "path";
import fs from "fs-extra";
import {
  getEditorService,
  getVsixScanner,
  getInstallService,
  getInstallFromListService,
} from "../features/install";
import { DEFAULT_OUTPUT_DIR } from "../config/constants";

interface InstallOptions {
  // Input sources
  vsix?: string; // Single VSIX file
  vsixDir?: string | string[]; // Directory/directories to scan for VSIX files
  file?: string; // Extension list file (.txt or extensions.json)

  // Download behavior when installing from list
  downloadMissing?: boolean;

  // Editor targeting
  editor?: string; // vscode | cursor | auto
  codeBin?: string; // Explicit VS Code binary path
  cursorBin?: string; // Explicit Cursor binary path

  // Install behavior
  skipInstalled?: boolean;
  forceReinstall?: boolean;
  dryRun?: boolean;

  // Parallelism and retries
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;

  // Output control
  quiet?: boolean;
  json?: boolean;
  summary?: string;
  allowMismatchedBinary?: boolean;

  // Config values (merged in)
  installParallel?: number;
  installRetry?: number;
  installRetryDelay?: number;
  outputDir?: string;
  cacheDir?: string;
  source?: string;
  preRelease?: boolean;

  // Legacy compatibility
  output?: string;
}

export async function installExtensions(options: InstallOptions) {
  console.clear();

  p.intro("⚙️  VSIX Extension Manager - Install");

  try {
    // Determine install mode (interactive if no clear mode provided)
    const installMode = determineInstallMode(options);

    switch (installMode) {
      case "single-vsix":
        await installSingleVsix(options);
        break;
      case "vsix-directory":
        await installFromVsixDirectory(options);
        break;
      case "from-list":
        await installFromList(options);
        break;
      default:
        await interactiveInstallMode(options);
    }
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function determineInstallMode(options: InstallOptions): string {
  if (options.vsix) return "single-vsix";
  if (options.vsixDir) return "vsix-directory";
  if (options.file) return "from-list";
  return "interactive";
}

function normalizeVsixDirs(vsixDir?: string | string[]): string[] {
  if (!vsixDir) return [];
  return Array.isArray(vsixDir) ? vsixDir : [vsixDir];
}

function detectIdentityFromPath(pth: string): "vscode" | "cursor" | "unknown" {
  const lower = pth.toLowerCase();
  if (lower.includes("cursor.app")) return "cursor";
  if (lower.includes("visual studio code.app")) return "vscode";
  if (/(^|[\\/])cursor([\\/]|$)/.test(lower)) return "cursor";
  if (/(^|[\\/])code([\\/]|$)/.test(lower)) return "vscode";
  return "unknown";
}

function getIdentityBadge(expected: "vscode" | "cursor", binaryPath: string): string {
  const identity = detectIdentityFromPath(binaryPath);
  if (identity === "unknown") return "";
  return identity === expected ? " — OK" : " — MISMATCH";
}

async function interactiveInstallMode(options: InstallOptions) {
  const mode = await p.select({
    message: "Choose install mode:",
    options: [
      {
        value: "single-vsix",
        label: "Install single VSIX file",
        hint: "Install one .vsix file into VS Code or Cursor",
      },
      {
        value: "vsix-directory",
        label: "Install all VSIX files from directory",
        hint: "Scan and install multiple .vsix files",
      },
      {
        value: "from-list",
        label: "Install from extension list",
        hint: "Install from .txt file or extensions.json",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  switch (mode) {
    case "single-vsix":
      await installSingleVsix(options);
      break;
    case "vsix-directory":
      await installFromVsixDirectory(options);
      break;
    case "from-list":
      await installFromList(options);
      break;
  }
}

async function installSingleVsix(options: InstallOptions) {
  let vsixPath = options.vsix;

  if (!vsixPath) {
    const result = await p.text({
      message: "Enter path to VSIX file or directory:",
      validate: (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return "Please enter a path";
        if (!fs.existsSync(trimmed)) return "File or directory does not exist";
        try {
          const stat = fs.statSync(trimmed);
          if (stat.isFile() && !trimmed.toLowerCase().endsWith(".vsix")) {
            return "Must be a .vsix file or a directory";
          }
        } catch {
          return "Unable to access the given path";
        }
        return undefined;
      },
    });

    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    vsixPath = result as string;
  }

  // Resolve VSIX path: allow directory input and pick a VSIX inside
  if (!fs.existsSync(vsixPath!)) {
    p.log.error(`❌ VSIX file not found: ${vsixPath}`);
    process.exit(1);
  }

  const vsixStat = fs.statSync(vsixPath!);
  if (vsixStat.isDirectory()) {
    const vsixScanner = getVsixScanner();
    const scanResult = await vsixScanner.scanDirectory(vsixPath!, { recursive: false });
    const candidates = scanResult.validVsixFiles;

    if (candidates.length === 0) {
      p.log.error(`❌ No VSIX files found in directory: ${vsixPath}`);
      process.exit(1);
    }

    if (!options.quiet && !options.json && candidates.length > 1) {
      const choice = await p.select({
        message: "Select VSIX to install:",
        options: candidates.map((f) => ({ value: f.path, label: f.filename })),
      });
      if (p.isCancel(choice)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      vsixPath = choice as string;
    } else {
      const chosen = candidates.sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];
      if (!options.quiet) {
        p.log.info(`🔍 Using ${path.basename(chosen.path)} from directory`);
      }
      vsixPath = chosen.path;
    }
  } else {
    if (!vsixPath!.toLowerCase().endsWith(".vsix")) {
      p.log.error("❌ File must be a .vsix file");
      process.exit(1);
    }
  }

  const editor = await resolveEditor(options);
  const binPath = await resolveEditorBinary(editor, options);
  // Preflight
  const preflight = await getInstallService().validatePrerequisites(binPath);
  if (!preflight.valid) {
    p.log.error("❌ Preflight checks failed:");
    preflight.errors.forEach((e) => p.log.error(`  • ${e}`));
    process.exit(1);
  }

  p.note(`VSIX: ${vsixPath}\nEditor: ${editor}\nBinary: ${binPath}`, "Install Details");

  if (!options.quiet && !options.json) {
    const confirmRes = await p.confirm({
      message: "Proceed with installation?",
      initialValue: true,
    });
    if (p.isCancel(confirmRes) || !confirmRes) {
      p.cancel("Installation cancelled.");
      return;
    }
  }

  // Perform installation
  const installService = getInstallService();
  const spinner = p.spinner();
  spinner.start("Installing VSIX file...");

  try {
    const result = await installService.installSingleVsix(binPath, vsixPath, {
      dryRun: options.dryRun,
      forceReinstall: options.forceReinstall,
      timeout: 30000,
    });

    if (result.success) {
      spinner.stop("✅ Installation successful!");
      p.note(`File: ${vsixPath}\nExit Code: ${result.exitCode}`, "Install Result");
    } else {
      spinner.stop("❌ Installation failed", 1);
      p.note(
        `File: ${vsixPath}\nExit Code: ${result.exitCode}\nError: ${result.error || "Unknown error"}`,
        "Install Result",
      );
    }
  } catch (error) {
    spinner.stop("❌ Installation failed", 1);
    throw error;
  }

  // JSON/stdout and summary support
  const summaryData = {
    timestamp: new Date().toISOString(),
    file: vsixPath,
    editor,
    binary: binPath,
    dryRun: Boolean(options.dryRun),
  };
  if (options.summary) {
    try {
      await fs.writeJson(options.summary, summaryData, { spaces: 2 });
      if (!options.quiet && !options.json) {
        p.log.success(`📄 Summary written to: ${options.summary}`);
      }
    } catch (error) {
      if (!options.quiet)
        p.log.warn(
          `⚠️ Failed to write summary: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
  }
  if (options.json) {
    console.log(JSON.stringify(summaryData, null, 2));
  } else if (!options.quiet) {
    p.outro("✅ Installation completed!");
  }
}

async function installFromVsixDirectory(options: InstallOptions) {
  let scanDirs = normalizeVsixDirs(options.vsixDir);

  if (scanDirs.length === 0) {
    const result = await p.text({
      message: "Enter directory to scan for VSIX files:",
      placeholder: "./downloads",
      initialValue: DEFAULT_OUTPUT_DIR,
      validate: (input: string) => {
        if (!input.trim()) return "Please enter a directory path";
        if (!fs.existsSync(input.trim())) return "Directory does not exist";
        return undefined;
      },
    });

    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    scanDirs = [result as string];
  }

  // Validate all directories exist
  for (const scanDir of scanDirs) {
    if (!fs.existsSync(scanDir)) {
      p.log.error(`❌ Directory not found: ${scanDir}`);
      process.exit(1);
    }
  }

  const editor = await resolveEditor(options);
  const binPath = await resolveEditorBinary(editor, options);
  // Preflight
  const preflight = await getInstallService().validatePrerequisites(binPath);
  if (!preflight.valid) {
    p.log.error("❌ Preflight checks failed:");
    preflight.errors.forEach((e) => p.log.error(`  • ${e}`));
    process.exit(1);
  }

  // Scan for VSIX files in all directories
  const vsixScanner = getVsixScanner();
  const installService = getInstallService();

  const spinner = p.spinner();
  spinner.start("Scanning for VSIX files...");

  try {
    const allValidVsix = [];
    const allInvalidFiles = [];
    let totalFiles = 0;

    for (const scanDir of scanDirs) {
      const scanResult = await vsixScanner.scanDirectory(scanDir);
      allValidVsix.push(...scanResult.validVsixFiles);
      allInvalidFiles.push(...scanResult.invalidFiles);
      totalFiles += scanResult.totalFiles;
    }

    const combinedScanResult = {
      totalFiles,
      validVsixFiles: allValidVsix,
      invalidFiles: allInvalidFiles,
      errors: [],
    };

    spinner.stop(`Found ${combinedScanResult.validVsixFiles.length} VSIX file(s)`);

    if (combinedScanResult.validVsixFiles.length === 0) {
      p.log.warn("⚠️ No valid VSIX files found in the directories");
      return;
    }

    // Show scan summary
    const summary = vsixScanner.getScanSummary(combinedScanResult);
    p.note(
      `Total: ${summary.total}\nValid: ${summary.valid}\nInvalid: ${summary.invalid}\nUnique Extensions: ${summary.uniqueExtensions}`,
      "Scan Summary",
    );

    if (combinedScanResult.invalidFiles.length > 0) {
      p.log.warn(`⚠️ ${combinedScanResult.invalidFiles.length} invalid file(s) found:`);
      combinedScanResult.invalidFiles.forEach((file) => {
        p.log.warn(`  • ${file.filename}: ${file.error}`);
      });
    }

    // Confirm installation (skip in quiet/json mode)
    if (!options.quiet && !options.json) {
      const shouldProceed = await p.confirm({
        message: `Install ${combinedScanResult.validVsixFiles.length} VSIX file(s)?`,
        initialValue: true,
      });

      if (p.isCancel(shouldProceed) || !shouldProceed) {
        p.cancel("Installation cancelled.");
        return;
      }
    }

    // Create install tasks
    const installTasks = combinedScanResult.validVsixFiles.map((vsixFile) => ({
      vsixFile,
      extensionId: vsixFile.extensionId,
      targetVersion: vsixFile.version,
    }));

    // Perform bulk installation
    spinner.start("Installing VSIX files...");
    const installResult = await installService.installBulkVsix(
      binPath,
      installTasks,
      {
        dryRun: options.dryRun,
        forceReinstall: options.forceReinstall,
        skipInstalled: options.skipInstalled,
        parallel: Number(options.parallel) || options.installParallel || 1,
        retry: Number(options.retry) || options.installRetry || 2,
        retryDelay: Number(options.retryDelay) || options.installRetryDelay || 1000,
        timeout: 30000,
        quiet: options.quiet,
      },
      (result) => {
        if (!options.quiet) {
          const status = result.success ? "✅" : result.skipped ? "⏭️" : "❌";
          const filename = path.basename(result.task.vsixFile.path);
          spinner.message(`${status} ${filename}`);
        }
      },
    );

    spinner.stop(`Installation completed!`);

    // Show results
    p.note(
      `Total: ${installResult.total}\nSuccessful: ${installResult.successful}\nSkipped: ${installResult.skipped}\nFailed: ${installResult.failed}\nDuration: ${Math.round(installResult.elapsedMs / 1000)}s`,
      "Install Summary",
    );

    if (installResult.failed > 0 && !options.quiet) {
      p.log.error("❌ Failed installations:");
      installResult.results
        .filter((r) => !r.success && !r.skipped)
        .forEach((result) => {
          p.log.error(`  • ${path.basename(result.task.vsixFile.path)}: ${result.error}`);
        });
    }

    // Write summary JSON if requested
    if (options.summary) {
      try {
        const summaryData = {
          timestamp: new Date().toISOString(),
          scanResult: {
            totalFiles: combinedScanResult.totalFiles,
            validVsixFiles: combinedScanResult.validVsixFiles.length,
            invalidFiles: combinedScanResult.invalidFiles.length,
          },
          installResult: {
            total: installResult.total,
            successful: installResult.successful,
            skipped: installResult.skipped,
            failed: installResult.failed,
            elapsedMs: installResult.elapsedMs,
            results: installResult.results.map((r) => ({
              filename: path.basename(r.task.vsixFile.path),
              extensionId: r.task.extensionId,
              version: r.task.targetVersion,
              success: r.success,
              skipped: r.skipped,
              error: r.error,
              elapsedMs: r.elapsedMs,
            })),
          },
        };

        await fs.writeJson(options.summary, summaryData, { spaces: 2 });
        if (!options.quiet) {
          p.log.success(`📄 Summary written to: ${options.summary}`);
        }
      } catch (error) {
        p.log.warn(
          `⚠️ Failed to write summary: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    spinner.stop("❌ Installation failed", 1);
    throw error;
  }

  p.outro("✅ Bulk installation completed!");
}

async function installFromList(options: InstallOptions) {
  let listPath = options.file;

  if (!listPath) {
    const result = await p.text({
      message: "Enter path to extension list file:",
      validate: (input: string) => {
        if (!input.trim()) return "Please enter a file path";
        if (!fs.existsSync(input.trim())) return "File does not exist";
        return undefined;
      },
    });

    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    listPath = result as string;
  }

  // Validate file exists
  if (!fs.existsSync(listPath!)) {
    p.log.error(`❌ File not found: ${listPath}`);
    process.exit(1);
  }

  const editor = await resolveEditor(options);
  const binPath = await resolveEditorBinary(editor, options);
  // Preflight
  const preflight = await getInstallService().validatePrerequisites(binPath);
  if (!preflight.valid) {
    p.log.error("❌ Preflight checks failed:");
    preflight.errors.forEach((e) => p.log.error(`  • ${e}`));
    process.exit(1);
  }

  // Determine VSIX search directories
  let vsixSearchDirs = normalizeVsixDirs(options.vsixDir);
  if (vsixSearchDirs.length === 0) {
    vsixSearchDirs = [options.outputDir || options.output || DEFAULT_OUTPUT_DIR];
  }
  // Always include cache directory if specified
  if (options.cacheDir && !vsixSearchDirs.includes(options.cacheDir)) {
    vsixSearchDirs.unshift(options.cacheDir);
  }
  // Include output directory if not already present
  const outputDir = options.outputDir || options.output || DEFAULT_OUTPUT_DIR;
  if (!vsixSearchDirs.includes(outputDir)) {
    vsixSearchDirs.push(outputDir);
  }

  // Install from list
  const installFromListService = getInstallFromListService();

  const spinner = p.spinner();
  spinner.start("Processing extension list...");

  try {
    const result = await installFromListService.installFromList(
      binPath,
      listPath,
      vsixSearchDirs,
      {
        downloadMissing: options.downloadMissing,
        downloadOptions: {
          outputDir: options.outputDir || options.output,
          cacheDir: options.cacheDir,
          source:
            options.source === "auto"
              ? undefined
              : (options.source as "marketplace" | "open-vsx" | undefined),
          preRelease: options.preRelease,
          quiet: options.quiet,
          parallel: options.parallel,
          retry: options.retry,
          retryDelay: options.retryDelay,
        },
        installOptions: {
          dryRun: options.dryRun,
          forceReinstall: options.forceReinstall,
          skipInstalled: options.skipInstalled,
          parallel: Number(options.parallel) || options.installParallel || 1,
          retry: Number(options.retry) || options.installRetry || 2,
          retryDelay: Number(options.retryDelay) || options.installRetryDelay || 1000,
          timeout: 30000,
          quiet: options.quiet,
        },
      },
      (message) => {
        if (!options.quiet) {
          spinner.message(message);
        }
      },
    );

    spinner.stop("Installation completed!");

    // Show results
    p.note(
      `Total Extensions: ${result.totalExtensions}\nVSIX Files Found: ${result.foundVsixFiles}\nDownloaded: ${result.downloadedExtensions}\nInstalled: ${result.installedExtensions}\nSkipped: ${result.skippedExtensions}\nFailed: ${result.failedExtensions}`,
      "Install Summary",
    );

    if (result.downloadResult && !options.quiet) {
      p.note(
        `Downloaded: ${result.downloadResult.successful}\nDownload Failed: ${result.downloadResult.failed}`,
        "Download Summary",
      );
    }

    if (result.errors.length > 0) {
      p.log.error("❌ Errors encountered:");
      result.errors.forEach((error) => {
        p.log.error(`  • ${error}`);
      });
    }

    if (result.installResult.failed > 0 && !options.quiet) {
      p.log.error("❌ Failed installations:");
      result.installResult.results
        .filter((r) => !r.success && !r.skipped)
        .forEach((result) => {
          const filename = result.task.vsixFile
            ? path.basename(result.task.vsixFile.path)
            : result.task.extensionId || "unknown";
          p.log.error(`  • ${filename}: ${result.error}`);
        });
    }

    // Write summary JSON if requested
    if (options.summary) {
      try {
        const summaryData = {
          timestamp: new Date().toISOString(),
          totalExtensions: result.totalExtensions,
          foundVsixFiles: result.foundVsixFiles,
          downloadedExtensions: result.downloadedExtensions,
          installedExtensions: result.installedExtensions,
          skippedExtensions: result.skippedExtensions,
          failedExtensions: result.failedExtensions,
          downloadResult: result.downloadResult,
          installResult: {
            total: result.installResult.total,
            successful: result.installResult.successful,
            skipped: result.installResult.skipped,
            failed: result.installResult.failed,
            elapsedMs: result.installResult.elapsedMs,
            results: result.installResult.results.map((r) => ({
              extensionId: r.task.extensionId,
              vsixPath: r.task.vsixFile?.path,
              version: r.task.targetVersion,
              success: r.success,
              skipped: r.skipped,
              error: r.error,
              elapsedMs: r.elapsedMs,
            })),
          },
          errors: result.errors,
        };

        await fs.writeJson(options.summary, summaryData, { spaces: 2 });
        if (!options.quiet) {
          p.log.success(`📄 Summary written to: ${options.summary}`);
        }
      } catch (error) {
        p.log.warn(
          `⚠️ Failed to write summary: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    spinner.stop("❌ Installation failed", 1);
    throw error;
  }

  p.outro("✅ List installation completed!");
}

async function resolveEditor(options: InstallOptions): Promise<"vscode" | "cursor"> {
  let editor = options.editor as "vscode" | "cursor" | "auto" | undefined;

  if (!editor || editor === "auto") {
    // Show spinner during editor detection
    const spinner = p.spinner();
    if (!options.quiet && !options.json) {
      spinner.start("Detecting installed editors...");
    }

    const editorService = getEditorService();
    const availableEditors = await editorService.getAvailableEditors();

    if (!options.quiet && !options.json) {
      spinner.stop("Editor detection complete");
    }

    if (availableEditors.length === 0) {
      p.log.error("❌ No editors found. Please install VS Code or Cursor.");
      p.log.info("💡 Install VS Code: https://code.visualstudio.com/");
      p.log.info("💡 Install Cursor: https://cursor.sh/");
      process.exit(1);
    }

    if (availableEditors.length === 1) {
      const detected = availableEditors[0];
      p.log.info(`🔍 Auto-detected ${detected.displayName} at ${detected.binaryPath}`);
      return detected.name;
    }

    // Multiple editors available
    const choices = availableEditors.map((editor) => ({
      value: editor.name,
      label: `${editor.displayName} (${editor.binaryPath})${getIdentityBadge(editor.name, editor.binaryPath)}`,
    }));

    if (options.quiet || options.json) {
      // In quiet/json mode with multiple editors, require explicit selection
      throw new Error(
        `Multiple editors found (${availableEditors.map((e) => e.displayName).join(", ")}). ` +
          `Please specify which editor to use with --editor vscode or --editor cursor`,
      );
    }

    const result = await p.select({
      message: "Multiple editors found. Select target editor:",
      options: choices,
    });

    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    editor = result as "vscode" | "cursor";
  }

  return editor;
}

async function resolveEditorBinary(
  editor: "vscode" | "cursor",
  options: InstallOptions,
): Promise<string> {
  const editorService = getEditorService();

  // Use explicit binary path if provided
  const explicitPath = editor === "vscode" ? options.codeBin : options.cursorBin;

  try {
    return await editorService.resolveEditorBinary(
      editor,
      explicitPath,
      Boolean(options.allowMismatchedBinary),
    );
  } catch (error) {
    p.log.error(`❌ ${error instanceof Error ? error.message : String(error)}`);

    // Show available editors for troubleshooting
    const availableEditors = await editorService.getAvailableEditors();
    if (availableEditors.length > 0) {
      p.log.info("📋 Available editors:");
      availableEditors.forEach((editor) => {
        p.log.info(`  • ${editor.displayName}: ${editor.binaryPath}`);
      });
    }

    process.exit(1);
  }
}

// Lightweight UI entrypoints for interactive launcher
export async function runInstallVsixUI(options: InstallOptions) {
  options.vsix = options.vsix || ""; // Trigger interactive single VSIX mode
  await installSingleVsix(options);
}

export async function runInstallVsixDirUI(options: InstallOptions) {
  // Leave vsixDir undefined to prompt for directory interactively
  await installFromVsixDirectory(options);
}

export async function runInstallFromListUI(options: InstallOptions) {
  options.file = options.file || ""; // Trigger interactive list mode
  await installFromList(options);
}
