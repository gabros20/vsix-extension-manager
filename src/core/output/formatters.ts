/**
 * Output formatters for different display modes
 * Integration Phase: Temporarily without chalk until dependency is added
 */

import type {
  CommandResult,
  OutputOptions,
  FormattedOutput,
  ResultTotals,
  ResultItem,
  WarningItem,
  ErrorItem,
} from "./types";

// Simple color helper (ANSI codes)
const color = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

export class OutputFormatter {
  /**
   * Format result based on options
   */
  format(result: CommandResult, options: OutputOptions = {}): FormattedOutput {
    switch (options.format) {
      case "json":
        return this.formatJSON(result, false, options);
      case "json-pretty":
        return this.formatJSON(result, true, options);
      case "human":
      default:
        return this.formatHuman(result, options);
    }
  }

  /**
   * Format as JSON (for machine consumption or --json flag)
   */
  private formatJSON(
    result: CommandResult,
    pretty: boolean,
    options: OutputOptions,
  ): FormattedOutput {
    const output = {
      ...result,
      timestamp: options.includeTimestamp !== false ? result.timestamp : undefined,
      metadata: options.includeMetadata !== false ? result.metadata : undefined,
      errors: result.errors?.map((e) => ({
        ...e,
        stack: options.includeStack ? e.stack : undefined,
      })),
    };

    const content = pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);

    return {
      content,
      exitCode: result.status === "ok" ? 0 : 1,
    };
  }

  /**
   * Format for human-readable console output
   */
  private formatHuman(result: CommandResult, options: OutputOptions): FormattedOutput {
    const lines: string[] = [];

    // Status icon
    const icon = this.getStatusIcon(result.status);
    lines.push(`${icon} ${result.summary}`);

    // Totals (if available)
    if (result.totals && !options.quiet) {
      lines.push("");
      lines.push(this.formatTotals(result.totals));
    }

    // Items (if available and not quiet)
    if (result.items && !options.quiet) {
      lines.push("");
      lines.push(this.formatItems(result.items));
    }

    // Warnings
    if (result.warnings && result.warnings.length > 0) {
      lines.push("");
      lines.push(this.formatWarnings(result.warnings));
    }

    // Errors
    if (result.errors && result.errors.length > 0) {
      lines.push("");
      lines.push(this.formatErrors(result.errors, options));
    }

    return {
      content: lines.join("\n"),
      exitCode: result.status === "ok" ? 0 : 1,
    };
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "ok":
        return color.green("✓");
      case "partial":
        return color.yellow("⚠");
      case "error":
        return color.red("✗");
      default:
        return "•";
    }
  }

  private formatTotals(totals: ResultTotals): string {
    const parts: string[] = [];

    if (totals.successful > 0) {
      parts.push(color.green(`${totals.successful} successful`));
    }

    if (totals.failed > 0) {
      parts.push(color.red(`${totals.failed} failed`));
    }

    if (totals.skipped > 0) {
      parts.push(color.gray(`${totals.skipped} skipped`));
    }

    if (totals.warnings > 0) {
      parts.push(color.yellow(`${totals.warnings} warnings`));
    }

    const duration = totals.duration ? ` (${(totals.duration / 1000).toFixed(1)}s)` : "";

    return `${parts.join(", ")}${duration}`;
  }

  private formatItems(items: ResultItem[]): string {
    const lines: string[] = ["Items:"];

    for (const item of items) {
      const icon = this.getStatusIcon(item.status);
      const name = item.name || item.id;
      const version = item.version ? color.gray(` v${item.version}`) : "";
      const message = item.message ? color.gray(` - ${item.message}`) : "";

      lines.push(`  ${icon} ${name}${version}${message}`);
    }

    return lines.join("\n");
  }

  private formatWarnings(warnings: WarningItem[]): string {
    const lines: string[] = [color.yellow("Warnings:")];

    for (const warning of warnings) {
      lines.push(color.yellow(`  ⚠ ${warning.message}`));
      if (warning.context) {
        lines.push(color.gray(`    Context: ${warning.context}`));
      }
    }

    return lines.join("\n");
  }

  private formatErrors(errors: ErrorItem[], options: OutputOptions): string {
    const lines: string[] = [color.red("Errors:")];

    for (const error of errors) {
      lines.push(color.red(`  ✗ ${error.message}`));

      if (error.context) {
        lines.push(color.gray(`    Context: ${error.context}`));
      }

      if (error.suggestion) {
        lines.push(color.cyan(`    Suggestion: ${error.suggestion}`));
      }

      if (options.includeStack && error.stack) {
        lines.push(color.gray(`    Stack: ${error.stack}`));
      }
    }

    return lines.join("\n");
  }
}

export const outputFormatter = new OutputFormatter();
