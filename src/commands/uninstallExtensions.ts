import * as p from "@clack/prompts";
import { getUninstallExtensionsService } from "../features/uninstall";
import { getEditorService } from "../features/install";
import { getInstalledExtensions } from "../features/export";

interface UninstallExtensionsOptions {
  editor?: string;
  codeBin?: string;
  cursorBin?: string;
  allowMismatchedBinary?: boolean;
  all?: boolean;
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;
  quiet?: boolean;
  json?: boolean;
  dryRun?: boolean;
  summary?: string;
}

export async function uninstallExtensions(options: UninstallExtensionsOptions) {
  console.clear();
  p.intro("Uninstall Extensions");

  try {
    const quiet = Boolean(options.quiet);
    const json = Boolean(options.json);
    const service = getUninstallExtensionsService();
    const editorService = getEditorService();
    const spinner = p.spinner();

    // Show spinner during editor detection
    if (!quiet && !json) {
      spinner.start("Detecting installed editors...");
    }

    // Editor selection
    const availableEditors = await editorService.getAvailableEditors();

    if (!quiet && !json) {
      spinner.stop("Editor detection complete");
    }

    let chosenEditor = (options.editor as "vscode" | "cursor" | "auto" | undefined) || "auto";

    if (chosenEditor === "auto") {
      if (availableEditors.length === 0) {
        throw new Error("No editors found. Please install VS Code or Cursor.");
      }
      if (availableEditors.length === 1) {
        const detected = availableEditors[0];
        if (!quiet && !json) {
          p.log.info(`Auto-detected ${detected.displayName} at ${detected.binaryPath}`);
        }
        chosenEditor = detected.name;
      } else {
        // Multiple editors found - prompt user to select
        if (quiet || json) {
          throw new Error(
            `Multiple editors found (${availableEditors.map((e) => e.displayName).join(", ")}). ` +
              `Please specify which editor to use with --editor vscode or --editor cursor`,
          );
        }

        const result = await p.select({
          message: "Multiple editors found. Select which editor to uninstall extensions from:",
          options: availableEditors.map((editor) => ({
            value: editor.name,
            label: `${editor.displayName} (${editor.binaryPath})`,
          })),
        });
        if (p.isCancel(result)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
        chosenEditor = result as "vscode" | "cursor";
      }
    }

    options.editor = chosenEditor;

    // Get installed extensions
    if (!quiet) spinner.start("Scanning installed extensions...");
    const installed = await getInstalledExtensions(chosenEditor);
    if (!quiet) spinner.stop(`Found ${installed.length} installed extension(s)`);

    if (installed.length === 0) {
      const editorDisplayName =
        chosenEditor === "cursor" ? "Cursor" : chosenEditor === "vscode" ? "VS Code" : "the editor";
      p.log.warn(`No extensions found in ${editorDisplayName}`);
      return;
    }

    // Interactive mode: Ask for uninstall mode (all vs selected)
    let selectedExtensions: string[] | undefined;
    if (!quiet && !json && !options.all) {
      const uninstallMode = await p.select({
        message: "Choose uninstall mode:",
        options: [
          {
            value: "all",
            label: "Uninstall all extensions",
            hint: `Remove all ${installed.length} extensions`,
          },
          {
            value: "selected",
            label: "Select extensions to uninstall",
            hint: "Choose which extensions to remove",
          },
        ],
      });

      if (p.isCancel(uninstallMode)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }

      if (uninstallMode === "selected") {
        // Show multiselect with all installed extensions
        const extensionChoices = await p.multiselect({
          message: `Select extensions to uninstall (${installed.length} available):`,
          options: installed.map((ext) => ({
            value: ext.id,
            label: `${ext.displayName || ext.id} (${ext.version})`,
          })),
          required: false,
        });

        if (p.isCancel(extensionChoices)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }

        selectedExtensions = extensionChoices as string[];
        if (selectedExtensions.length === 0) {
          p.log.info("No extensions selected for uninstall.");
          return;
        }
      }
    }

    // Determine which extensions to uninstall
    const extensionsToUninstall = selectedExtensions || installed.map((ext) => ext.id);
    const uninstallCount = extensionsToUninstall.length;

    // Confirm uninstall
    if (!quiet && !json && !options.dryRun) {
      const confirmMessage =
        selectedExtensions && selectedExtensions.length > 0
          ? `Uninstall ${uninstallCount} selected extension(s)?`
          : `Uninstall all ${uninstallCount} extension(s)?`;

      const confirm = await p.confirm({
        message: confirmMessage,
        initialValue: false,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.cancel("Uninstall cancelled.");
        return;
      }
    }

    if (!quiet) spinner.start("Uninstalling extensions...");

    const summary = await service.uninstallExtensions(
      {
        editor: chosenEditor as "vscode" | "cursor",
        codeBin: options.codeBin,
        cursorBin: options.cursorBin,
        allowMismatchedBinary: options.allowMismatchedBinary,
        selectedExtensions: extensionsToUninstall,
        parallel: options.parallel ? Number(options.parallel) : undefined,
        retry: options.retry ? Number(options.retry) : undefined,
        retryDelay: options.retryDelay ? Number(options.retryDelay) : undefined,
        quiet,
        json,
        dryRun: options.dryRun,
      },
      (message) => {
        if (!quiet) spinner.message(message);
      },
    );

    if (!quiet) spinner.stop("Uninstall process finished");

    const summaryLines = [
      `Total: ${summary.totalExtensions}`,
      `Uninstalled: ${summary.uninstalled}`,
      `Failed: ${summary.failed}`,
      `Duration: ${Math.round(summary.elapsedMs / 1000)}s`,
    ].join("\n");

    if (json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    p.note(summaryLines, "Uninstall Summary");

    const failed = summary.results.filter((r) => !r.success);
    if (failed.length > 0 && !quiet) {
      p.log.error("Failed to uninstall:");
      failed.forEach((r) => p.log.error(`  ${r.extensionId}: ${r.error || "Unknown error"}`));
    }

    // Write summary JSON if requested
    if (options.summary) {
      try {
        const fs = await import("fs-extra");
        await fs.writeJson(options.summary, summary, { spaces: 2 });
        if (!quiet) {
          p.log.success(`Summary written to: ${options.summary}`);
        }
      } catch (error) {
        p.log.warn(
          `Failed to write summary: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!quiet) {
      if (options.dryRun) {
        if (summary.totalExtensions > 0) {
          p.outro(
            `Dry run complete! ${summary.totalExtensions} extension(s) would be uninstalled.`,
          );
        } else {
          p.outro("Dry run complete! No extensions to uninstall.");
        }
      } else if (summary.uninstalled === 0 && summary.failed === 0) {
        p.outro("No extensions were uninstalled.");
      } else if (summary.uninstalled > 0 && summary.failed === 0) {
        p.outro(`Successfully uninstalled ${summary.uninstalled} extension(s).`);
      } else if (summary.failed > 0) {
        p.outro("Uninstall completed with issues. Check failed extensions above.");
      } else {
        p.outro("Uninstall process complete.");
      }
    }
  } catch (error) {
    p.log.error("Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

export async function runUninstallExtensionsUI(options: UninstallExtensionsOptions) {
  await uninstallExtensions(options);
}
