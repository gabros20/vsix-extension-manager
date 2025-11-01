// Shared types to ensure consistency across commands and utilities

export type SourceRegistry = "marketplace" | "open-vsx" | "auto";

export type ExportFormat = "txt" | "extensions.json" | "yaml";

export type EditorType = "vscode" | "cursor" | "auto";

export interface BulkOptions {
  parallel?: number;
  retry?: number;
  retryDelay?: number; // milliseconds
  quiet?: boolean;
  json?: boolean;
  summaryPath?: string;
  source?: "marketplace" | "open-vsx";
  filenameTemplate?: string;
  cacheDir?: string;
  skipExisting?: boolean;
  overwrite?: boolean;
  checksum?: boolean;
  verifyChecksum?: string;
}

export interface ExtensionVersionInfo {
  version: string;
  published?: string;
}
