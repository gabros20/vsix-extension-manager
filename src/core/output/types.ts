/**
 * Standardized output type definitions
 * Provides consistent API responses across all commands
 */

export type CommandStatus = "ok" | "error" | "partial";

export interface CommandResult<T = any> {
  status: CommandStatus;
  command: string;
  summary: string;
  items?: ResultItem<T>[];
  errors?: ErrorItem[];
  warnings?: WarningItem[];
  totals?: ResultTotals;
  metadata?: Record<string, any>;
  timestamp?: string;
  duration?: number;
}

export interface ResultItem<T = any> {
  id: string;
  name?: string;
  version?: string;
  status: "success" | "failed" | "skipped" | "warning";
  duration?: number;
  message?: string;
  details?: T;
}

export interface ErrorItem {
  code: string;
  message: string;
  context?: string;
  item?: string;
  suggestion?: string;
  stack?: string;
}

export interface WarningItem {
  code: string;
  message: string;
  context?: string;
  item?: string;
}

export interface ResultTotals {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  warnings: number;
  duration: number;
}

export interface OutputOptions {
  format?: "json" | "json-pretty" | "human";
  includeTimestamp?: boolean;
  includeMetadata?: boolean;
  includeStack?: boolean;
  quiet?: boolean;
}

export interface FormattedOutput {
  content: string;
  exitCode: number;
}
