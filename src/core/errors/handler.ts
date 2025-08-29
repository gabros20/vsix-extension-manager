// Error handling utilities for consistent error formatting and logging

import * as p from "@clack/prompts";
import { VsixError, ErrorSeverity } from "./types";
import { FileSystemErrors, NetworkErrors } from "./definitions";

/**
 * Error formatting options
 */
export interface ErrorFormatOptions {
  showSuggestions?: boolean;
  showMetadata?: boolean;
  showStack?: boolean;
  jsonOutput?: boolean;
  colors?: boolean;
}

/**
 * Error handler for consistent error processing and display
 */
export class ErrorHandler {
  private quiet: boolean;
  private jsonOutput: boolean;

  constructor(quiet = false, jsonOutput = false) {
    this.quiet = quiet;
    this.jsonOutput = jsonOutput;
  }

  /**
   * Handle and format error for display
   */
  handle(error: Error | VsixError, options: ErrorFormatOptions = {}): void {
    const opts = {
      showSuggestions: true,
      showMetadata: false,
      showStack: false,
      jsonOutput: this.jsonOutput,
      colors: true,
      ...options,
    };

    if (error instanceof VsixError) {
      this.handleTypedError(error, opts);
    } else {
      this.handleGenericError(error, opts);
    }
  }

  /**
   * Handle typed VSIX errors
   */
  private handleTypedError(error: VsixError, options: ErrorFormatOptions): void {
    if (options.jsonOutput) {
      console.log(JSON.stringify(error.toJSON(), null, 2));
      return;
    }

    if (!this.quiet) {
      // Show error with appropriate icon and color
      const icon = this.getErrorIcon(error.severity);
      const title = options.colors ? this.colorize(error.title, error.severity) : error.title;

      p.log.error(`${icon} ${title}: ${error.message}`);

      // Show suggestions if enabled
      if (options.showSuggestions && error.suggestions.length > 0) {
        console.log(); // Empty line for spacing
        p.log.info("💡 Suggested actions:");
        error.suggestions.forEach((suggestion, index) => {
          const automated = suggestion.automated ? " (automated)" : "";
          p.log.info(
            `   ${index + 1}. ${suggestion.action}${automated}: ${suggestion.description}`,
          );
        });
      }

      // Show metadata if enabled and available
      if (options.showMetadata && error.metadata && Object.keys(error.metadata).length > 0) {
        console.log(); // Empty line for spacing
        p.log.info("📋 Error details:");
        Object.entries(error.metadata).forEach(([key, value]) => {
          p.log.info(`   ${key}: ${value}`);
        });
      }

      // Show stack trace if enabled
      if (options.showStack && error.stack) {
        console.log(); // Empty line for spacing
        p.log.info("🔍 Stack trace:");
        console.log(error.stack);
      }

      // Show error code for debugging
      if (error.code) {
        console.log(); // Empty line for spacing
        p.log.info(`🔍 Error code: ${error.code}`);
      }
    }
  }

  /**
   * Handle generic errors (convert them to typed errors where possible)
   */
  private handleGenericError(error: Error, options: ErrorFormatOptions): void {
    if (options.jsonOutput) {
      console.log(
        JSON.stringify(
          {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!this.quiet) {
      p.log.error(`❌ ${error.message}`);

      if (options.showStack && error.stack) {
        console.log(); // Empty line for spacing
        p.log.info("🔍 Stack trace:");
        console.log(error.stack);
      }
    }
  }

  /**
   * Get appropriate icon for error severity
   */
  private getErrorIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return "⚠️";
      case ErrorSeverity.MEDIUM:
        return "🚨";
      case ErrorSeverity.HIGH:
        return "🔥";
      case ErrorSeverity.CRITICAL:
        return "💥";
      default:
        return "❌";
    }
  }

  /**
   * Apply color based on error severity
   */
  private colorize(text: string, severity: ErrorSeverity): string {
    // Basic ANSI color codes (can be enhanced with a proper color library)
    const colors = {
      [ErrorSeverity.LOW]: "\x1b[33m", // Yellow
      [ErrorSeverity.MEDIUM]: "\x1b[35m", // Magenta
      [ErrorSeverity.HIGH]: "\x1b[31m", // Red
      [ErrorSeverity.CRITICAL]: "\x1b[41m", // Red background
    };

    const reset = "\x1b[0m";
    const color = colors[severity] || "";

    return `${color}${text}${reset}`;
  }

  /**
   * Check if error suggests automated recovery
   */
  canAutoRecover(error: VsixError): boolean {
    return error.suggestions.some((suggestion) => suggestion.automated === true);
  }

  /**
   * Get automated recovery suggestions
   */
  getAutoRecoverySuggestions(error: VsixError): Array<{ action: string; description: string }> {
    return error.suggestions.filter((suggestion) => suggestion.automated === true);
  }

  /**
   * Attempt automated error recovery
   */
  async attemptAutoRecovery(error: VsixError): Promise<boolean> {
    const autoSuggestions = this.getAutoRecoverySuggestions(error);

    if (autoSuggestions.length === 0) {
      return false;
    }

    if (!this.quiet) {
      p.log.info(`🔧 Attempting automated recovery for: ${error.title}`);
    }

    // This is a placeholder - specific recovery logic would be implemented
    // based on error codes and types
    for (const suggestion of autoSuggestions) {
      if (!this.quiet) {
        p.log.info(`   Trying: ${suggestion.action}`);
      }

      // Implement specific recovery logic based on suggestion.action
      // For now, just simulate success/failure
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false; // Would return true if recovery succeeded
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null;

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(quiet = false, jsonOutput = false): ErrorHandler {
  globalErrorHandler = new ErrorHandler(quiet, jsonOutput);
  return globalErrorHandler;
}

/**
 * Get global error handler instance
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * Convenience function to handle errors
 */
export function handleError(error: Error | VsixError, options?: ErrorFormatOptions): void {
  getErrorHandler().handle(error, options);
}

/**
 * Convenience function to handle errors and exit
 */
export function handleErrorAndExit(
  error: Error | VsixError,
  exitCode = 1,
  options?: ErrorFormatOptions,
): never {
  handleError(error, options);
  process.exit(exitCode);
}

/**
 * Convert generic errors to typed errors where possible
 */
export function enhanceError(error: Error): VsixError | Error {
  // Enhance common error patterns
  if (error.message.includes("ENOENT")) {
    const match = error.message.match(/ENOENT.*?'([^']+)'/);
    const path = match ? match[1] : "unknown";
    return FileSystemErrors.fileNotFound(path);
  }

  if (error.message.includes("EACCES") || error.message.includes("permission denied")) {
    const match = error.message.match(/'([^']+)'/);
    const path = match ? match[1] : "unknown";
    return FileSystemErrors.permissionDenied(path, "access");
  }

  if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
    return NetworkErrors.connectionTimeout();
  }

  if (error.message.includes("ECONNREFUSED")) {
    return NetworkErrors.connectionRefused();
  }

  if (error.message.includes("404") || error.message.includes("Not Found")) {
    return NetworkErrors.notFound("resource");
  }

  // Return original error if no enhancement possible
  return error;
}

/**
 * Wrap async functions to automatically handle and enhance errors
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: ErrorFormatOptions,
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const enhanced = enhanceError(error as Error);
      handleError(enhanced, options);
      throw enhanced;
    }
  }) as T;
}
