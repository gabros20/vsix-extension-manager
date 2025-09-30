import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import {
  getInstalledExtensions,
  formatExtensions,
  findWorkspaceExtensionsJson,
  getExportStats,
} from "../features/export";
import type { ExportFormat, EditorType } from "../features/export";
import { validate } from "../core/validation";

interface ExportInstalledOptions {
  output?: string;
  format?: string;
  workspace?: boolean;
  json?: boolean;
  editor?: string;
}

export async function exportInstalled(options: ExportInstalledOptions) {
  try {
    p.intro("🔍 Export Installed Extensions");

    // Determine editor to export from
    let editor: EditorType = "auto";
    if (options.editor) {
      if (!["vscode", "cursor", "auto"].includes(options.editor)) {
        p.log.error("❌ Invalid editor. Supported editors: vscode, cursor, auto");
        process.exit(1);
      }
      editor = options.editor as EditorType;
    } else if (!options.json && !options.workspace) {
      // Interactive editor selection
      const editorChoice = await p.select({
        message: "Choose editor to export from:",
        options: [
          { value: "auto", label: "Auto-detect (prefer Cursor)" },
          { value: "cursor", label: "Cursor" },
          { value: "vscode", label: "VS Code" },
        ],
      });

      if (p.isCancel(editorChoice)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }

      editor = editorChoice as EditorType;
    }

    // Determine output format
    let format: ExportFormat = "txt";
    if (options.format) {
      if (!["txt", "extensions.json"].includes(options.format)) {
        p.log.error("❌ Invalid format. Supported formats: txt, extensions.json");
        process.exit(1);
      }
      format = options.format as ExportFormat;
    } else if (!options.json) {
      // Interactive format selection
      const formatChoice = await p.select({
        message: "Choose output format:",
        options: [
          { value: "extensions.json", label: "VS Code extensions.json (workspace format)" },
          { value: "txt", label: "Plain text (extension IDs only)" },
        ],
      });

      if (p.isCancel(formatChoice)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }

      format = formatChoice as ExportFormat;
    }

    // Ask for output destination (interactive, minimal; skip if --json provided)
    let requestedOutputPath: string | undefined;
    if (!options.output && !options.json) {
      if (options.workspace) {
        const defaultWorkspacePath = path.join(process.cwd(), ".vscode", "extensions.json");
        const res = await p.text({
          message: "Enter output file path (press Enter to print instead):",
          placeholder: defaultWorkspacePath,
          initialValue: defaultWorkspacePath,
        });
        if (p.isCancel(res)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
        requestedOutputPath = (res as string).trim() || undefined;
      } else {
        const defaultFilename =
          format === ("extensions.json" as ExportFormat)
            ? "extensions.json"
            : `extensions-${new Date().toISOString().split("T")[0]}.${format}`;
        const res = await p.text({
          message: "Enter output file path (press Enter to print instead):",
          placeholder: defaultFilename,
          initialValue: defaultFilename,
        });
        if (p.isCancel(res)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
        requestedOutputPath = (res as string).trim() || undefined;
      }
    }

    // Check if workspace mode is requested
    if (options.workspace) {
      const workspaceExtensionsJson = findWorkspaceExtensionsJson();
      if (workspaceExtensionsJson) {
        p.log.info(`📁 Found workspace extensions.json: ${workspaceExtensionsJson}`);

        const content = fs.readFileSync(workspaceExtensionsJson, "utf-8");

        const targetPath = options.output || requestedOutputPath;
        if (targetPath) {
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(targetPath, content);
          p.log.success(`✅ Workspace extensions exported to: ${targetPath}`);
        } else {
          console.log(content);
        }
        // Show exported list (workspace)
        if (!options.json) {
          try {
            const parsed = JSON.parse(content);
            const recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
            if (recs.length > 0) {
              p.note(recs.join("\n"), "Exported Extensions");
            }
          } catch {}
        }
        if (!options.json) {
          // Summarize export (workspace always VS Code workspace format)
          let count = 0;
          let valid = false;
          try {
            const parsed = JSON.parse(content);
            const result = validate.vscodeExtensionsJson(parsed);
            valid = result.valid;
            if (result.valid) count = result.data!.recommendations.length;
          } catch {}
          const summary = `Total: ${count} extension(s)\nFormat: workspace format\nOutput: ${targetPath || "stdout"}\nValidation: ${valid ? "✅" : "❌"}`;
          p.note(summary, "Export Complete");
        }
        return;
      } else {
        p.log.warn("⚠️ No workspace extensions.json found in current directory");
        const continueChoice = await p.confirm({
          message: "Export globally installed extensions instead?",
        });

        if (p.isCancel(continueChoice) || !continueChoice) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
      }
    }

    // Get installed extensions
    const spinner = p.spinner();
    const editorName = editor === "auto" ? "available" : editor === "cursor" ? "Cursor" : "VS Code";
    spinner.start(`Scanning ${editorName} extensions...`);

    const extensions = await getInstalledExtensions(editor);
    spinner.stop(`Found ${extensions.length} installed extension(s)`);

    if (extensions.length === 0) {
      const editorDisplayName =
        editor === "auto" ? "VS Code or Cursor" : editor === "cursor" ? "Cursor" : "VS Code";
      p.log.warn(
        `⚠️ No extensions found. Make sure ${editorDisplayName} is installed and has extensions.`,
      );
      return;
    }

    // Get export statistics for validation reporting
    const stats = getExportStats(extensions);

    // Show validation summary for extensions.json format
    if (format === "extensions.json" && stats.invalid > 0) {
      p.log.warn(`⚠️ Found ${stats.invalid} invalid extension ID(s) that will be excluded:`);
      stats.invalidIds.slice(0, 5).forEach((id) => p.log.warn(`  • ${id}`));
      if (stats.invalidIds.length > 5) {
        p.log.warn(`  • ... and ${stats.invalidIds.length - 5} more`);
      }
      p.log.info(`✅ ${stats.valid} valid extension(s) will be exported`);
    }

    // Format output
    const output = formatExtensions(extensions, format);

    // Handle output destination
    const finalOutputPath = options.output || requestedOutputPath;
    if (finalOutputPath) {
      // Ensure output directory exists
      const outputDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(finalOutputPath, output);
      p.log.success(`✅ Extensions exported to: ${finalOutputPath}`);
      // Show exported list (non-workspace, file output)
      if (!options.json) {
        let lines: string[] = [];
        if (format === ("json" as ExportFormat)) {
          lines = extensions.map((ext) => `${ext.id} (${ext.version}) - ${ext.displayName}`);
        } else {
          // txt or extensions.json list of IDs
          lines = extensions.map((ext) => ext.id);
        }
        if (lines.length > 0) {
          p.note(lines.join("\n"), "Exported Extensions");
        }
      }
    } else if (options.json || format !== "txt") {
      // Machine-readable output or non-JSON format
      console.log(output);
    } else {
      // Interactive mode - pretty display
      p.note(
        extensions.map((ext) => ext.id).join("\n"),
        `${extensions.length} Installed Extensions`,
      );

      if (!options.workspace) {
        const shouldSave = await p.confirm({
          message: "Save to file?",
        });

        if (p.isCancel(shouldSave)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }

        if (shouldSave) {
          const fileExtension = format === ("extensions.json" as ExportFormat) ? "json" : format;
          const defaultFilename = `extensions-${new Date().toISOString().split("T")[0]}.${fileExtension}`;
          const filename = await p.text({
            message: "Enter filename:",
            defaultValue: defaultFilename,
          });

          if (p.isCancel(filename)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
          }

          fs.writeFileSync(filename as string, output);
          p.log.success(`✅ Extensions exported to: ${filename}`);
        }
      }
    }

    // Post-export summary (skip when --json to keep machine-readable)
    if (!options.json) {
      let count = 0;
      let valid = true;
      try {
        if (format === ("extensions.json" as ExportFormat)) {
          const parsed = JSON.parse(output);
          const result = validate.vscodeExtensionsJson(parsed);
          valid = result.valid;
          count = result.valid ? result.data!.recommendations.length : 0;
        } else if (format === ("txt" as ExportFormat)) {
          count = output
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#")).length;
          // Validate IDs
          const ids = output
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"));
          const result = validate.extensionList(ids);
          valid = result.valid;
        } else {
          // json detailed export
          const parsed = JSON.parse(output);
          count = Array.isArray(parsed) ? parsed.length : 0;
        }
      } catch {
        valid = false;
      }
      const displayFormat =
        format === ("extensions.json" as ExportFormat) ? "workspace format" : format;
      const summaryLines = [
        `Total: ${count} extension(s)`,
        `Format: ${displayFormat}`,
        `Output: ${finalOutputPath ? finalOutputPath : "stdout"}`,
        `Validation: ${valid ? "✅" : "❌"}`,
      ].join("\n");
      p.note(summaryLines, "Export Complete");
    }

    p.outro("✨ Export completed!");
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
