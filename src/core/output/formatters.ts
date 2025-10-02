/**
 * Output formatters for different display modes
 */

import type { CommandResult, OutputOptions, FormattedOutput } from "./types";
import chalk from "chalk";

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
        return chalk.green("✓");
      case "partial":
        return chalk.yellow("⚠");
      case "error":
        return chalk.red("✗");
      default:
        return "•";
    }
  }

  private formatTotals(totals: any): string {
    const parts: string[] = [];

    if (totals.successful > 0) {
      parts.push(chalk.green(`${totals.successful} successful`));
    }

    if (totals.failed > 0) {
      parts.push(chalk.red(`${totals.failed} failed`));
    }

    if (totals.skipped > 0) {
      parts.push(chalk.gray(`${totals.skipped} skipped`));
    }

    if (totals.warnings > 0) {
      parts.push(chalk.yellow(`${totals.warnings} warnings`));
    }

    const duration = totals.duration ? ` (${(totals.duration / 1000).toFixed(1)}s)` : "";

    return `${parts.join(", ")}${duration}`;
  }

  private formatItems(items: any[]): string {
    const lines: string[] = ["Items:"];

    for (const item of items) {
      const icon = this.getStatusIcon(item.status);
      const name = item.name || item.id;
      const version = item.version ? chalk.gray(` v${item.version}`) : "";
      const message = item.message ? chalk.gray(` - ${item.message}`) : "";

      lines.push(`  ${icon} ${name}${version}${message}`);
    }

    return lines.join("\n");
  }

  private formatWarnings(warnings: any[]): string {
    const lines: string[] = [chalk.yellow("Warnings:")];

    for (const warning of warnings) {
      lines.push(chalk.yellow(`  ⚠ ${warning.message}`));
      if (warning.context) {
        lines.push(chalk.gray(`    Context: ${warning.context}`));
      }
    }

    return lines.join("\n");
  }

  private formatErrors(errors: any[], options: OutputOptions): string {
    const lines: string[] = [chalk.red("Errors:")];

    for (const error of errors) {
      lines.push(chalk.red(`  ✗ ${error.message}`));

      if (error.context) {
        lines.push(chalk.gray(`    Context: ${error.context}`));
      }

      if (error.suggestion) {
        lines.push(chalk.cyan(`    Suggestion: ${error.suggestion}`));
      }

      if (options.includeStack && error.stack) {
        lines.push(chalk.gray(`    Stack: ${error.stack}`));
      }
    }

    return lines.join("\n");
  }
}

export const outputFormatter = new OutputFormatter();
