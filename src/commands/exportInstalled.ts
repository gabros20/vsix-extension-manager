import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import {
  getInstalledExtensions,
  formatExtensions,
  findWorkspaceExtensionsJson,
} from "../features/export";
import type { ExportFormat, EditorType } from "../features/export";

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
    let format: ExportFormat = "json";
    if (options.format) {
      if (!["json", "txt", "extensions.json"].includes(options.format)) {
        p.log.error("❌ Invalid format. Supported formats: json, txt, extensions.json");
        process.exit(1);
      }
      format = options.format as ExportFormat;
    } else if (!options.json) {
      // Interactive format selection
      const formatChoice = await p.select({
        message: "Choose output format:",
        options: [
          { value: "json", label: "JSON (detailed extension info)" },
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

    // Check if workspace mode is requested
    if (options.workspace) {
      const workspaceExtensionsJson = findWorkspaceExtensionsJson();
      if (workspaceExtensionsJson) {
        p.log.info(`📁 Found workspace extensions.json: ${workspaceExtensionsJson}`);

        const content = fs.readFileSync(workspaceExtensionsJson, "utf-8");

        if (options.output) {
          fs.writeFileSync(options.output, content);
          p.log.success(`✅ Workspace extensions exported to: ${options.output}`);
        } else {
          console.log(content);
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

    // Format output
    const output = formatExtensions(extensions, format);

    // Handle output destination
    if (options.output) {
      // Ensure output directory exists
      const outputDir = path.dirname(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(options.output, output);
      p.log.success(`✅ Extensions exported to: ${options.output}`);
    } else if (options.json || format !== "json") {
      // Machine-readable output or non-JSON format
      console.log(output);
    } else {
      // Interactive mode - pretty display
      p.note(
        extensions.map((ext) => `${ext.id} (${ext.version}) - ${ext.displayName}`).join("\n"),
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

    p.outro("✨ Export completed!");
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
