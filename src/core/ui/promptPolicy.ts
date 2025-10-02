/**
 * Prompt policy enforcer for consistent behavior across modes
 * Ensures predictable prompting based on quiet/json/yes flags
 */

import type { GlobalOptions } from "../../commands/base/types";
import { UserInputError } from "../errors";

/**
 * Prompt context for policy decisions
 */
export interface PromptContext {
  options: GlobalOptions;
  command: string;
  required?: boolean;
}

/**
 * Prompt policy class
 */
export class PromptPolicy {
  /**
   * Determine if prompting is allowed based on options
   */
  shouldPrompt(context: PromptContext): boolean {
    // Never prompt in quiet mode
    if (context.options.quiet) {
      return false;
    }

    // Never prompt in JSON mode
    if (context.options.json) {
      return false;
    }

    // Never prompt if auto-confirm is enabled
    if (context.options.yes) {
      return false;
    }

    // Allow prompting in interactive mode
    return true;
  }

  /**
   * Handle required input that must be provided
   * In non-interactive modes, throws error with helpful message
   */
  handleRequiredInput(fieldName: string, flagName: string, context: PromptContext): never {
    const mode = context.options.quiet
      ? "quiet"
      : context.options.json
        ? "JSON"
        : context.options.yes
          ? "auto-confirm"
          : "non-interactive";

    throw new UserInputError(
      `${fieldName} is required but not provided.\n` +
        `In ${mode} mode, you must specify ${flagName} flag.\n` +
        `Example: ${context.command} ${flagName} <value>`,
    );
  }

  /**
   * Get auto-confirm value for yes/no prompts
   * Returns true if --yes is set, otherwise throws in non-interactive modes
   */
  getAutoConfirmValue(context: PromptContext, defaultValue = true): boolean {
    if (context.options.yes) {
      return true; // Auto-confirm
    }

    if (context.options.quiet || context.options.json) {
      // In quiet/JSON modes without --yes, use default value
      return defaultValue;
    }

    throw new Error("Not in auto-confirm mode - should have prompted instead");
  }

  /**
   * Check if we're in interactive mode
   */
  isInteractive(options: GlobalOptions): boolean {
    return !options.quiet && !options.json && !options.yes;
  }

  /**
   * Validate that required options are provided in non-interactive modes
   */
  validateRequiredOptions(
    options: GlobalOptions,
    required: Array<{ field: keyof GlobalOptions; flagName: string; commandName: string }>,
  ): void {
    if (this.isInteractive(options)) {
      return; // Can prompt in interactive mode
    }

    const missing = required.filter((req) => !options[req.field]);

    if (missing.length > 0) {
      const missingList = missing.map((m) => `  • ${m.flagName}`).join("\n");
      const mode = options.quiet ? "quiet" : options.json ? "JSON" : "auto-confirm (--yes)";

      throw new UserInputError(
        `Missing required options in ${mode} mode:\n${missingList}\n\n` +
          `These must be specified when running in non-interactive mode.`,
      );
    }
  }
}

/**
 * Singleton instance
 */
export const promptPolicy = new PromptPolicy();
