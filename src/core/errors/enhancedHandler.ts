/**
 * Enhanced error handler with contextual suggestions and auto-recovery
 * Extends the base error handler with intelligent error analysis
 */

import { ErrorHandler } from "./handler";
import { errorSuggestionService, type ErrorContext } from "./suggestions";
import { errorRecoveryService, type RecoveryResult } from "./recovery";
import type { VsixError } from "./types";
import { ui } from "../ui";

export interface ErrorAction {
  action: "retry" | "skip" | "abort" | "manual";
  modifiedContext?: ErrorContext;
  message?: string;
}

/**
 * Enhanced error handler with smart suggestions and recovery
 */
export class EnhancedErrorHandler extends ErrorHandler {
  /**
   * Handle error with contextual suggestions and recovery options
   */
  async handleWithSuggestions(
    error: Error | VsixError,
    context: ErrorContext = {},
  ): Promise<ErrorAction> {
    // Get contextual suggestions
    const suggestion = errorSuggestionService.getSuggestion(error);

    // Show error with suggestions
    this.showErrorWithSuggestions(error, suggestion, context);

    // Attempt auto-recovery if available
    if (suggestion.autoRecovery) {
      const recovery = await this.attemptEnhancedRecovery(error, context, suggestion);
      if (recovery) {
        return recovery;
      }
    }

    // Prompt user for action in interactive mode
    return await this.promptUserForAction(error, context);
  }

  /**
   * Show error with contextual suggestions
   */
  private showErrorWithSuggestions(
    error: Error,
    suggestion: ReturnType<typeof errorSuggestionService.getSuggestion>,
    context: ErrorContext,
  ): void {
    // Show error title
    ui.log.error(`❌ ${error.message}`);

    // Show context if available
    if (context.command) {
      ui.log.message(`Command: ${context.command}`);
    }
    if (context.input) {
      ui.log.message(`Input: ${context.input}`);
    }

    // Show suggestions
    console.log(""); // Empty line
    const formattedSuggestion = errorSuggestionService.formatSuggestion(suggestion);
    ui.log.message(formattedSuggestion);
  }

  /**
   * Attempt automatic recovery with enhanced strategies
   */
  private async attemptEnhancedRecovery(
    error: Error,
    context: ErrorContext,
    suggestion: ReturnType<typeof errorSuggestionService.getSuggestion>,
  ): Promise<ErrorAction | null> {
    const recovery = await errorRecoveryService.attemptRecovery(error, context, suggestion);

    if (!recovery) {
      return null;
    }

    if (recovery.recovered) {
      // Successful recovery, skip this item
      ui.log.success(`✓ ${recovery.message}`);
      return {
        action: "skip",
        message: recovery.message,
      };
    }

    if (recovery.shouldRetry) {
      // Recovery suggests retry
      ui.log.info(`🔄 ${recovery.message}`);

      // Modify context based on strategy
      const modifiedContext = this.applyRecoveryStrategy(context, recovery);

      return {
        action: "retry",
        modifiedContext,
        message: recovery.message,
      };
    }

    return null;
  }

  /**
   * Apply recovery strategy modifications to context
   */
  private applyRecoveryStrategy(context: ErrorContext, recovery: RecoveryResult): ErrorContext {
    const modified = { ...context };

    if (!recovery.strategy) {
      return modified;
    }

    switch (recovery.strategy) {
      case "timeout-increase":
        const currentTimeout = (context.options?.timeout as number) || 30000;
        modified.options = {
          ...context.options,
          timeout: Math.min(currentTimeout * 2, 120000),
        };
        break;

      case "source-fallback":
        modified.options = {
          ...context.options,
          source: "open-vsx",
        };
        break;

      case "direct-install":
        modified.options = {
          ...context.options,
          direct: true,
        };
        break;

      case "re-download":
        modified.options = {
          ...context.options,
          forceDownload: true,
        };
        break;
    }

    // Increment attempt count
    modified.attemptCount = (context.attemptCount || 0) + 1;

    return modified;
  }

  /**
   * Prompt user for action in interactive mode
   */
  private async promptUserForAction(error: Error, context: ErrorContext): Promise<ErrorAction> {
    // Check if we should prompt
    if (context.options?.quiet || context.options?.json || context.options?.yes) {
      // Non-interactive mode - abort
      return { action: "abort" };
    }

    console.log(""); // Empty line

    try {
      const action = await ui.select({
        message: "How would you like to proceed?",
        options: [
          { value: "retry", label: "Retry" },
          { value: "skip", label: "Skip this item" },
          { value: "abort", label: "Abort operation" },
          { value: "manual", label: "Manual intervention" },
        ],
      });

      return { action: action as "retry" | "skip" | "abort" | "manual" };
    } catch {
      // User cancelled - treat as abort
      return { action: "abort" };
    }
  }

  /**
   * Format error for JSON output
   */
  formatErrorForJson(error: Error, context: ErrorContext): Record<string, unknown> {
    const suggestion = errorSuggestionService.getSuggestion(error);

    return {
      error: {
        message: error.message,
        name: error.name,
        code: (error as VsixError).code,
      },
      context: {
        command: context.command,
        input: context.input,
        attemptCount: context.attemptCount,
      },
      suggestions: {
        title: suggestion.title,
        actions: suggestion.actions,
        autoRecovery: suggestion.autoRecovery,
      },
    };
  }
}

/**
 * Singleton instance
 */
export const enhancedErrorHandler = new EnhancedErrorHandler();
