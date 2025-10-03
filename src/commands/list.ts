/**
 * List Command - List and export installed extensions
 * Enhanced from exportInstalled.ts with multiple formats and better UX
 * Integration Phase: Now uses CommandResultBuilder
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";
import { BaseCommand } from "./base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "./base/types";
import { CommandResultBuilder } from "../core/output/CommandResultBuilder";
import { getInstalledExtensions } from "../features/export";
import { getEditorService } from "../features/install";
import { ui, promptPolicy } from "../core/ui";

/**
 * List command options
 */
export interface ListOptions extends GlobalOptions {
  format?: "json" | "yaml" | "txt" | "csv" | "table";
  includeDisabled?: boolean;
  detailed?: boolean;
}

/**
 * List command implementation
 */
export class ListCommand extends BaseCommand {
  async execute(_args: string[], options: GlobalOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("list");
    const listOptions = options as ListOptions;

    ui.intro("📋 List Extensions");

    try {
      // Get editor info
      const editorService = getEditorService();
      const editor = options.editor || "auto";
      let chosenEditor: "vscode" | "cursor";

      if (editor === "auto") {
        const available = await editorService.getAvailableEditors();
        if (available.length === 0) {
          throw new Error("No editors found. Please install VS Code or Cursor.");
        }

        if (available.length === 1) {
          chosenEditor = available[0].name;
          if (promptPolicy.isInteractive(options)) {
            ui.log.info(`Auto-detected ${available[0].displayName}`);
          }
        } else {
          if (!promptPolicy.shouldPrompt({ options, command: "list" })) {
            promptPolicy.handleRequiredInput("Editor", "--editor", {
              options,
              command: "vsix list",
            });
          }

          const selected = await ui.selectEditor(available, "cursor");
          chosenEditor = selected.name;
        }
      } else {
        chosenEditor = editor as "vscode" | "cursor";
      }

      // Get installed extensions
      const spinner = ui.spinner();
      if (!options.quiet && !options.json) {
        spinner.start("Scanning installed extensions...");
      }

      const extensions = await getInstalledExtensions(chosenEditor);

      if (!options.quiet && !options.json) {
        spinner.stop(`Found ${extensions.length} extensions`);
      }

      if (extensions.length === 0) {
        ui.log.warning("No extensions found");
        return builder.setSummary("No extensions found").build();
      }

      // Determine format
      let format = listOptions.format || "table";
      if (promptPolicy.shouldPrompt({ options, command: "list" }) && !listOptions.format) {
        format = await ui.select({
          message: "Choose output format:",
          options: [
            { value: "table", label: "Table (interactive display)" },
            { value: "json", label: "JSON (structured data)" },
            { value: "yaml", label: "YAML (human-readable structured)" },
            { value: "txt", label: "Plain text (extension IDs only)" },
            { value: "csv", label: "CSV (spreadsheet-compatible)" },
          ],
        });
      }

      // Format output
      const formatted = this.formatExtensions(extensions, format, listOptions);

      // Handle output destination
      if (options.output) {
        await fs.ensureDir(path.dirname(options.output));
        await fs.writeFile(options.output, formatted);

        if (promptPolicy.isInteractive(options)) {
          ui.log.success(`✅ Exported ${extensions.length} extensions to ${options.output}`);
        }

        ui.outro(`Exported to ${options.output}`);
      } else {
        // Print to console
        if (!options.quiet && !options.json) {
          ui.log.message("\n" + formatted + "\n");
        } else {
          console.log(formatted);
        }

        ui.outro(`Listed ${extensions.length} extensions`);
      }

      // Add extensions to builder
      extensions.forEach((ext) => {
        builder.addSuccess({
          id: ext.id,
          name: ext.displayName || ext.id,
          version: ext.version,
        });
      });

      return builder.setSummary(`Listed ${extensions.length} extensions`).build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (promptPolicy.isInteractive(options)) {
        ui.log.error(message);
      }

      return CommandResultBuilder.fromError(
        "list",
        error instanceof Error ? error : new Error(message),
      );
    }
  }

  /**
   * Format extensions in the requested format
   */
  private formatExtensions(
    extensions: Array<{
      id: string;
      version: string;
      displayName?: string;
      publisher?: string;
      disabled?: boolean;
    }>,
    format: string,
    options: ListOptions,
  ): string {
    switch (format) {
      case "json":
        return this.formatAsJson(extensions, options);

      case "yaml":
        return this.formatAsYaml(extensions, options);

      case "txt":
        return this.formatAsText(extensions);

      case "csv":
        return this.formatAsCsv(extensions, options);

      case "table":
      default:
        return this.formatAsTable(extensions, options);
    }
  }

  /**
   * Format as JSON
   */
  private formatAsJson(
    extensions: Array<{ id: string; version: string; displayName?: string; publisher?: string }>,
    options: ListOptions,
  ): string {
    if (options.detailed) {
      return JSON.stringify(extensions, null, 2);
    }

    // Simple format: array of extension IDs
    return JSON.stringify(
      extensions.map((ext) => ext.id),
      null,
      2,
    );
  }

  /**
   * Format as YAML
   */
  private formatAsYaml(
    extensions: Array<{ id: string; version: string; displayName?: string; publisher?: string }>,
    options: ListOptions,
  ): string {
    if (options.detailed) {
      return yaml.stringify(extensions);
    }

    // Simple format: array of extension IDs
    return yaml.stringify(extensions.map((ext) => ext.id));
  }

  /**
   * Format as plain text
   */
  private formatAsText(extensions: Array<{ id: string }>): string {
    return extensions.map((ext) => ext.id).join("\n");
  }

  /**
   * Format as CSV
   */
  private formatAsCsv(
    extensions: Array<{ id: string; version: string; displayName?: string; publisher?: string }>,
    options: ListOptions,
  ): string {
    const lines: string[] = [];

    if (options.detailed) {
      lines.push("ID,Version,Display Name,Publisher");
      for (const ext of extensions) {
        const displayName = (ext.displayName || ext.id).replace(/,/g, ";");
        const publisher = (ext.publisher || "").replace(/,/g, ";");
        lines.push(`${ext.id},${ext.version},${displayName},${publisher}`);
      }
    } else {
      lines.push("ID,Version");
      for (const ext of extensions) {
        lines.push(`${ext.id},${ext.version}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Format as table for console
   */
  private formatAsTable(
    extensions: Array<{
      id: string;
      version: string;
      displayName?: string;
      publisher?: string;
      disabled?: boolean;
    }>,
    options: ListOptions,
  ): string {
    const lines: string[] = [];
    const maxIdLen = Math.max(...extensions.map((e) => e.id.length), 10);
    const maxVersionLen = Math.max(...extensions.map((e) => e.version.length), 7);

    if (options.detailed) {
      const maxNameLen = Math.max(...extensions.map((e) => (e.displayName || e.id).length), 12);

      lines.push(
        `${"ID".padEnd(maxIdLen)}  ${"VERSION".padEnd(maxVersionLen)}  ${"NAME".padEnd(maxNameLen)}  STATUS`,
      );
      lines.push("-".repeat(maxIdLen + maxVersionLen + maxNameLen + 16));

      for (const ext of extensions) {
        const name = (ext.displayName || ext.id).substring(0, maxNameLen);
        const status = "enabled"; // Default to enabled as InstalledExtension doesn't track disabled state
        lines.push(
          `${ext.id.padEnd(maxIdLen)}  ${ext.version.padEnd(maxVersionLen)}  ${name.padEnd(maxNameLen)}  ${status}`,
        );
      }
    } else {
      lines.push(`${"ID".padEnd(maxIdLen)}  VERSION`);
      lines.push("-".repeat(maxIdLen + maxVersionLen + 2));

      for (const ext of extensions) {
        lines.push(`${ext.id.padEnd(maxIdLen)}  ${ext.version}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Get command help
   */
  getHelp(): CommandHelp {
    return {
      name: "list",
      description: "List installed extensions in various formats",
      usage: "vsix list [options]",
      examples: [
        "vsix list",
        "vsix list --format json",
        "vsix list --format yaml --output extensions.yml",
        "vsix list --format txt --output extensions.txt",
        "vsix list --format csv --detailed",
        "vsix list --editor cursor --format table",
      ],
      options: [
        { flag: "--editor <type>", description: "Target editor (cursor|vscode|auto)" },
        {
          flag: "--format <type>",
          description: "Output format (table|json|yaml|txt|csv)",
          defaultValue: "table",
        },
        {
          flag: "--output <path>",
          description: "Output file path (prints to console if not specified)",
        },
        {
          flag: "--detailed",
          description: "Include detailed information",
          defaultValue: "false",
        },
        { flag: "--quiet", description: "Minimal output", defaultValue: "false" },
        { flag: "--json", description: "JSON output", defaultValue: "false" },
      ],
    };
  }
}

/**
 * Export singleton instance
 */
export default new ListCommand();
