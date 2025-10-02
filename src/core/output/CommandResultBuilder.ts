/**
 * Builder for constructing standardized command results
 */

import type {
  CommandResult,
  CommandStatus,
  ResultItem,
  ErrorItem,
  WarningItem,
  ResultTotals,
} from "./types";

export class CommandResultBuilder<T = any> {
  private result: Partial<CommandResult<T>>;
  private items: ResultItem<T>[] = [];
  private errors: ErrorItem[] = [];
  private warnings: WarningItem[] = [];
  private startTime: number;

  constructor(command: string) {
    this.result = {
      command,
      timestamp: new Date().toISOString(),
    };
    this.startTime = Date.now();
  }

  addSuccess(item: Omit<ResultItem<T>, "status">): this {
    this.items.push({ ...item, status: "success" });
    return this;
  }

  addFailure(item: Omit<ResultItem<T>, "status">): this {
    this.items.push({ ...item, status: "failed" });
    return this;
  }

  addSkipped(item: Omit<ResultItem<T>, "status">): this {
    this.items.push({ ...item, status: "skipped" });
    return this;
  }

  addWarning(item: Omit<ResultItem<T>, "status">): this {
    this.items.push({ ...item, status: "warning" });
    return this;
  }

  addError(error: ErrorItem): this {
    this.errors.push(error);
    return this;
  }

  addWarningItem(warning: WarningItem): this {
    this.warnings.push(warning);
    return this;
  }

  setMetadata(metadata: Record<string, any>): this {
    this.result.metadata = { ...this.result.metadata, ...metadata };
    return this;
  }

  setSummary(summary: string): this {
    this.result.summary = summary;
    return this;
  }

  private calculateStatus(): CommandStatus {
    if (this.errors.length > 0 || this.items.some((i) => i.status === "failed")) {
      return this.items.some((i) => i.status === "success") ? "partial" : "error";
    }
    return "ok";
  }

  private calculateTotals(): ResultTotals {
    const successful = this.items.filter((i) => i.status === "success").length;
    const failed = this.items.filter((i) => i.status === "failed").length;
    const skipped = this.items.filter((i) => i.status === "skipped").length;
    const warningCount = this.warnings.length + this.items.filter((i) => i.status === "warning").length;

    return {
      total: this.items.length,
      successful,
      failed,
      skipped,
      warnings: warningCount,
      duration: Date.now() - this.startTime,
    };
  }

  build(): CommandResult<T> {
    const totals = this.calculateTotals();
    const status = this.calculateStatus();

    // Auto-generate summary if not provided
    const summary =
      this.result.summary ||
      this.generateSummary(status, totals);

    return {
      status,
      command: this.result.command!,
      summary,
      items: this.items.length > 0 ? this.items : undefined,
      errors: this.errors.length > 0 ? this.errors : undefined,
      warnings: this.warnings.length > 0 ? this.warnings : undefined,
      totals,
      metadata: this.result.metadata,
      timestamp: this.result.timestamp,
      duration: totals.duration,
    };
  }

  private generateSummary(status: CommandStatus, totals: ResultTotals): string {
    if (status === "ok") {
      return `Successfully completed ${totals.successful} operation${totals.successful !== 1 ? "s" : ""}`;
    }

    if (status === "partial") {
      return `Completed with ${totals.successful} success, ${totals.failed} failed`;
    }

    return `Failed: ${totals.failed} error${totals.failed !== 1 ? "s" : ""}`;
  }

  static fromError(command: string, error: Error): CommandResult {
    return new CommandResultBuilder(command)
      .addError({
        code: error.name || "UNKNOWN_ERROR",
        message: error.message,
        stack: error.stack,
      })
      .setSummary(`Command failed: ${error.message}`)
      .build();
  }
}
