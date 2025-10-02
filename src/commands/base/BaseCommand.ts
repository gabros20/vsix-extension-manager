/**
 * Base command class for v2.0 command framework
 * All new commands extend this class
 */

import type { CommandResult, CommandHelp, GlobalOptions, CommandContext } from "./types";

export abstract class BaseCommand {
  /**
   * Execute the command with given arguments and options
   * @param args - Positional arguments
   * @param options - Global options
   * @returns Command result
   */
  abstract execute(args: string[], options: GlobalOptions): Promise<CommandResult>;

  /**
   * Get help information for this command
   * @returns Command help details
   */
  abstract getHelp(): CommandHelp;

  /**
   * Validate command arguments and options
   * Override this to add custom validation
   */
  protected async validate(): Promise<void> {
    // Base validation - override in subclasses
  }

  /**
   * Create command execution context
   * @param options - Global options
   * @returns Command context
   */
  protected createContext(options: GlobalOptions): CommandContext {
    return {
      options,
      startTime: Date.now(),
    };
  }

  /**
   * Create a successful command result
   * @param summary - Summary message
   * @param data - Additional result data
   * @returns Command result
   */
  protected createSuccessResult(summary: string, data?: Partial<CommandResult>): CommandResult {
    return {
      status: "ok",
      command: this.constructor.name,
      summary,
      items: [],
      errors: [],
      warnings: [],
      totals: {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        warnings: 0,
        duration: 0,
      },
      ...data,
    };
  }

  /**
   * Create an error command result
   * @param summary - Summary message
   * @param data - Additional result data
   * @returns Command result
   */
  protected createErrorResult(summary: string, data?: Partial<CommandResult>): CommandResult {
    return {
      status: "error",
      command: this.constructor.name,
      summary,
      items: [],
      errors: [],
      warnings: [],
      ...data,
    };
  }

  /**
   * Calculate command duration from context
   * @param context - Command context
   * @returns Duration in milliseconds
   */
  protected getDuration(context: CommandContext): number {
    return Date.now() - context.startTime;
  }
}
