/**
 * Type definitions for the v2.0 command framework
 */

/**
 * Global options available to all commands
 */
export interface GlobalOptions {
  // Editor options
  editor?: "cursor" | "vscode" | "auto";
  codeBin?: string;
  cursorBin?: string;
  allowMismatch?: boolean;

  // Output modes
  quiet?: boolean;
  json?: boolean;
  yes?: boolean;
  debug?: boolean;

  // Source and version
  source?: "marketplace" | "open-vsx" | "auto";
  version?: string;
  preRelease?: boolean;

  // Performance
  parallel?: number;
  timeout?: number;
  retry?: number;
  retryDelay?: number;

  // Behavior
  skipInstalled?: boolean;
  force?: boolean;
  output?: string;
  downloadOnly?: boolean;

  // Safety
  checkCompat?: boolean;
  noBackup?: boolean;
  verifyChecksum?: boolean;

  // Special
  plan?: boolean;
  dryRun?: boolean;
  profile?: string;
  config?: string;
}

/**
 * Result of a command execution
 */
export interface CommandResult {
  status: "ok" | "error";
  command: string;
  summary: string;
  items?: ResultItem[];
  errors?: ErrorItem[];
  warnings?: WarningItem[];
  totals?: {
    success: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Individual result item
 */
export interface ResultItem {
  id: string;
  version?: string;
  status: "success" | "failed" | "skipped";
  duration: number;
  details?: Record<string, unknown>;
}

/**
 * Error item
 */
export interface ErrorItem {
  code: string;
  message: string;
  item?: string;
  context?: Record<string, unknown>;
}

/**
 * Warning item
 */
export interface WarningItem {
  code: string;
  message: string;
  item?: string;
}

/**
 * Command help information
 */
export interface CommandHelp {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  options?: {
    flag: string;
    description: string;
    defaultValue?: string;
  }[];
}

/**
 * Command execution context
 */
export interface CommandContext {
  options: GlobalOptions;
  startTime: number;
}
