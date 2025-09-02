import * as p from "@clack/prompts";
import os from "os";
import path from "path";
import fs from "fs-extra";
import {
  downloadSingleExtension,
  type SingleDownloadRequest,
  type SingleDownloadResult,
} from "../features/download";
import { FileExistsAction } from "../core/filesystem";
import { ProgressInfo, createProgressBar, formatBytes } from "../core/ui/progress";
import { shouldUpdateProgress, truncateText, truncateMiddle } from "../core/helpers";
import { getEditorService, getInstallService } from "../features/install";
import type { EditorType, SourceRegistry } from "../core/types";

interface QuickInstallOptions {
  url?: string;
  editor?: EditorType;
  codeBin?: string;
  cursorBin?: string;
  allowMismatchedBinary?: boolean;
  preRelease?: boolean;
  source?: SourceRegistry;
  quiet?: boolean;
  json?: boolean;
  dryRun?: boolean;
}

export async function quickInstall(options: QuickInstallOptions) {
  console.clear();
  p.intro("⚡ VSIX Quick Install");

  // Collect URL if not provided
  let url = options.url;
  if (!url) {
    const urlResult = await p.text({
      message: "Enter the extension URL (Marketplace or OpenVSX):",
      validate: (input: string) => (!input.trim() ? "Please enter a valid URL" : undefined),
    });
    if (p.isCancel(urlResult)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    url = String(urlResult);
  }

  // Create a unique temp directory for this quick operation
  const tempDirName = `vsix-quick-install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempDir = path.join(os.tmpdir(), tempDirName);

  const downloadSpinner = p.spinner();
  let lastUpdate = Date.now();

  const progressWrapper = (progress: ProgressInfo) => {
    if (options.quiet) return;
    const now = Date.now();
    if (!shouldUpdateProgress(lastUpdate, now)) return;
    const bar = createProgressBar(progress.percentage, 30);
    downloadSpinner.message(
      `${bar} ${formatBytes(progress.downloaded)}/${formatBytes(progress.total)}`,
    );
    lastUpdate = now;
  };

  const installSpinner = p.spinner();

  let downloadResult: SingleDownloadResult | null = null;
  let binPath: string | null = null;
  let chosenEditor: "vscode" | "cursor" = "cursor";

  try {
    await fs.ensureDir(tempDir);

    // Download latest by default (prefer stable unless preRelease is true)
    const request: SingleDownloadRequest = {
      url: url!,
      requestedVersion: "latest",
      preferPreRelease: Boolean(options.preRelease),
      source: options.source,
      outputDir: tempDir,
      fileExistsAction: FileExistsAction.OVERWRITE,
      quiet: Boolean(options.quiet),
      progressCallback: options.quiet ? undefined : progressWrapper,
    };

    if (!options.quiet) {
      downloadSpinner.start(`Downloading ${truncateText(url!)}...`);
    }
    downloadResult = await downloadSingleExtension(request);
    if (!options.quiet) downloadSpinner.stop("Download complete");

    const downloadedPath =
      downloadResult.filePath || path.join(downloadResult.outputDir, downloadResult.filename);

    // Resolve editor (interactive selection if multiple, like single install)
    const editorService = getEditorService();
    chosenEditor = await resolveEditorForQuick(options);
    const explicit = chosenEditor === "vscode" ? options.codeBin : options.cursorBin;
    binPath = editorService.resolveEditorBinary(
      chosenEditor,
      explicit,
      Boolean(options.allowMismatchedBinary),
    );

    // Preflight check
    const preflight = await getInstallService().validatePrerequisites(binPath);
    if (!preflight.valid) {
      if (!options.quiet) {
        p.log.error("❌ Preflight checks failed:");
        preflight.errors.forEach((e) => p.log.error(`  • ${e}`));
      }
      process.exit(1);
    }

    // Show install details and confirm (match single install behavior)
    const ttyWidth = process.stdout.columns || 80;
    const baseVsix = path.basename(downloadedPath);
    const maxLine = Math.max(22, Math.min(ttyWidth - 30, 42));
    const shortVsix = truncateMiddle(baseVsix, maxLine);
    const shortBin = truncateMiddle(binPath, maxLine);
    p.note(`VSIX: ${shortVsix}\nEditor: ${chosenEditor}\nBinary: ${shortBin}`, "Install Details");

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

    if (!options.quiet) installSpinner.start("Installing extension...");

    const installResult = await getInstallService().installSingleVsix(binPath, downloadedPath, {
      dryRun: Boolean(options.dryRun),
      forceReinstall: false,
      timeout: 30000,
    });

    if (installResult.success) {
      if (!options.quiet) installSpinner.stop("✅ Installed successfully");
    } else {
      if (!options.quiet) installSpinner.stop("❌ Installation failed", 1);
      if (!options.quiet) p.log.error(installResult.error || "Unknown error");
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              url,
              version: downloadResult.resolvedVersion,
              file: downloadedPath,
              error: installResult.error,
            },
            null,
            2,
          ),
        );
      }
      return;
    }

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            url,
            version: downloadResult.resolvedVersion,
            file: downloadedPath,
            editor: chosenEditor,
            editorBinary: binPath,
          },
          null,
          2,
        ),
      );
    } else if (!options.quiet) {
      p.outro("🎉 Quick install completed (temp files cleaned up)");
    }
  } finally {
    // Cleanup temp directory regardless of success
    try {
      await fs.remove(tempDir);
    } catch {
      // best-effort cleanup
    }
  }
}

// Lightweight UI entrypoint for interactive launcher
export async function runQuickInstallUI(options: QuickInstallOptions) {
  await quickInstall(options);
}

// Match single install's editor selection behavior
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

async function resolveEditorForQuick(options: QuickInstallOptions): Promise<"vscode" | "cursor"> {
  const editorService = getEditorService();
  const availableEditors = editorService.getAvailableEditors();

  if (options.editor && options.editor !== "auto") {
    return options.editor;
  }

  if (availableEditors.length === 0) {
    throw new Error("No editors found. Please install VS Code or Cursor.");
  }

  if (availableEditors.length === 1) {
    const detected = availableEditors[0];
    if (!options.quiet && !options.json) {
      p.log.info(`🔍 Auto-detected ${detected.displayName} at ${detected.binaryPath}`);
    }
    return detected.name;
  }

  if (options.quiet || options.json) {
    const cursor = availableEditors.find((e) => e.name === "cursor");
    return (cursor || availableEditors[0]).name;
  }

  const result = await p.select({
    message: "Multiple editors found. Select target editor:",
    options: availableEditors.map((editor) => ({
      value: editor.name,
      label: `${editor.displayName} (${editor.binaryPath})${getIdentityBadge(editor.name, editor.binaryPath)}`,
    })),
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  return result as "vscode" | "cursor";
}
