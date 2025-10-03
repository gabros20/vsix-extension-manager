/**
 * Error suggestion system
 * Provides contextual suggestions for common errors
 */

export interface ErrorSuggestion {
  title: string;
  actions: SuggestedAction[];
  autoRecovery?: boolean;
}

export interface SuggestedAction {
  description: string;
  command?: string;
  automated?: boolean;
}

export interface ErrorContext {
  command?: string;
  input?: string;
  options?: Record<string, unknown>;
  attemptCount?: number;
}

/**
 * Get contextual suggestions for errors
 */
export class ErrorSuggestionService {
  getSuggestion(error: Error, _context: ErrorContext = {}): ErrorSuggestion {
    const errorMsg = error.message.toLowerCase();

    // Binary mismatch errors
    if (errorMsg.includes("binary mismatch") || errorMsg.includes("wrong editor")) {
      return {
        title: "Binary Mismatch Detected",
        actions: [
          {
            description: "Specify the correct editor explicitly",
            command: "--editor cursor (or --editor vscode)",
            automated: false,
          },
          {
            description: "Provide custom binary path",
            command: "--cursor-bin /path/to/cursor (or --code-bin)",
            automated: false,
          },
          {
            description: "Allow mismatch and continue anyway",
            command: "--allow-mismatch",
            automated: false,
          },
        ],
      };
    }

    // Timeout errors
    if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
      return {
        title: "Operation Timed Out",
        actions: [
          {
            description: "Retry with longer timeout",
            command: "--timeout 60000 (60 seconds)",
            automated: true,
          },
          {
            description: "Try direct installation (bypass CLI)",
            command: "(automatic fallback available)",
            automated: true,
          },
          {
            description: "Download only for manual install",
            command: "--download-only",
            automated: false,
          },
        ],
        autoRecovery: true,
      };
    }

    // Network errors (403, 404, connection)
    if (
      errorMsg.includes("403") ||
      errorMsg.includes("404") ||
      errorMsg.includes("enotfound") ||
      errorMsg.includes("network")
    ) {
      return {
        title: "Network Error",
        actions: [
          {
            description: "Try alternative registry (Open VSX)",
            command: "--source open-vsx",
            automated: true,
          },
          {
            description: "Check your network connection",
            automated: false,
          },
          {
            description: "Use local VSIX file if available",
            command: "vsix add ./extension.vsix",
            automated: false,
          },
        ],
        autoRecovery: true,
      };
    }

    // Extension already installed
    if (errorMsg.includes("already installed") || errorMsg.includes("already exists")) {
      return {
        title: "Extension Already Installed",
        actions: [
          {
            description: "Skip this extension",
            automated: true,
          },
          {
            description: "Force reinstall",
            command: "--force",
            automated: false,
          },
          {
            description: "Update to latest version",
            command: "vsix update <extension-id>",
            automated: false,
          },
        ],
      };
    }

    // Incompatible extension
    if (errorMsg.includes("incompatible") || errorMsg.includes("not compatible")) {
      return {
        title: "Extension Incompatible",
        actions: [
          {
            description: "Check extension compatibility",
            command: "vsix info <extension-id>",
            automated: false,
          },
          {
            description: "Install specific compatible version",
            command: "--version <compatible-version>",
            automated: false,
          },
          {
            description: "Skip compatibility check (not recommended)",
            command: "--skip-compat-check",
            automated: false,
          },
        ],
      };
    }

    // Permission errors
    if (errorMsg.includes("permission") || errorMsg.includes("eacces")) {
      return {
        title: "Permission Denied",
        actions: [
          {
            description: "Check file/directory permissions",
            automated: false,
          },
          {
            description: "Ensure editor extensions directory is writable",
            automated: false,
          },
          {
            description: "Run health check for diagnostics",
            command: "vsix doctor",
            automated: false,
          },
        ],
      };
    }

    // No editor found
    if (errorMsg.includes("no editor") || errorMsg.includes("editor not found")) {
      return {
        title: "No Editor Found",
        actions: [
          {
            description: "Install VS Code or Cursor first",
            automated: false,
          },
          {
            description: "Specify custom editor binary path",
            command: "--code-bin /path/to/code",
            automated: false,
          },
          {
            description: "Download extensions only (no install)",
            command: "--download-only",
            automated: false,
          },
        ],
      };
    }

    // Corrupted extension
    if (errorMsg.includes("corrupt") || errorMsg.includes("invalid vsix")) {
      return {
        title: "Corrupted Extension",
        actions: [
          {
            description: "Re-download the extension",
            automated: true,
          },
          {
            description: "Verify checksum",
            command: "--verify-checksum",
            automated: false,
          },
          {
            description: "Download from alternative source",
            command: "--source open-vsx",
            automated: true,
          },
        ],
        autoRecovery: true,
      };
    }

    // Generic fallback
    return {
      title: "Error Occurred",
      actions: [
        {
          description: "Run health check to diagnose",
          command: "vsix doctor",
          automated: false,
        },
        {
          description: "Check the documentation",
          automated: false,
        },
        {
          description: "Report issue if problem persists",
          automated: false,
        },
      ],
    };
  }

  /**
   * Format suggestion for display
   */
  formatSuggestion(suggestion: ErrorSuggestion): string {
    const lines: string[] = [];

    lines.push(`💡 ${suggestion.title}`);
    lines.push("");

    suggestion.actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action.description}`);
      if (action.command) {
        lines.push(`   ${action.command}`);
      }
    });

    if (suggestion.autoRecovery) {
      lines.push("");
      lines.push("ℹ️  Automatic recovery will be attempted");
    }

    return lines.join("\n");
  }
}

/**
 * Singleton instance
 */
export const errorSuggestionService = new ErrorSuggestionService();
