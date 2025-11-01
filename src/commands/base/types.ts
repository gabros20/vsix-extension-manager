/**
 * Type definitions for the v2.0 command framework
 *
 * Integration Phase: Now imports standardized output types from Phase 2
 */

// Import Phase 2 standardized output types
export type {
  CommandResult,
  CommandStatus,
  ResultItem,
  ErrorItem,
  WarningItem,
  ResultTotals,
} from "../../core/output/types";

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
  config?: string;
  fix?: boolean; // For doctor command auto-fix
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
