/**
 * Auto-recovery strategies for common errors
 * Implements intelligent retry with escalating recovery attempts
 */

import type { ErrorContext, ErrorSuggestion } from "./suggestions";

export interface RecoveryResult {
  recovered: boolean;
  strategy?: string;
  message: string;
  shouldRetry: boolean;
}

export type RecoveryStrategy = (
  error: Error,
  context: ErrorContext,
) => Promise<RecoveryResult | null>;

/**
 * Recovery strategies registry
 */
export class ErrorRecoveryService {
  private strategies: Map<string, RecoveryStrategy> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Register default recovery strategies
   */
  private registerDefaultStrategies(): void {
    this.strategies.set("timeout-increase", this.timeoutIncreaseStrategy);
    this.strategies.set("source-fallback", this.sourceFallbackStrategy);
    this.strategies.set("direct-install", this.directInstallStrategy);
    this.strategies.set("skip-on-exists", this.skipOnExistsStrategy);
    this.strategies.set("re-download", this.reDownloadStrategy);
  }

  /**
   * Attempt recovery for an error
   */
  async attemptRecovery(
    error: Error,
    context: ErrorContext,
    suggestion: ErrorSuggestion,
  ): Promise<RecoveryResult | null> {
    if (!suggestion.autoRecovery) {
      return null;
    }

    // Try each strategy in order
    for (const [name, strategy] of this.strategies) {
      try {
        const result = await strategy(error, context);
        if (result) {
          return { ...result, strategy: name };
        }
      } catch {
        // Strategy failed, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Strategy: Increase timeout and retry
   */
  private timeoutIncreaseStrategy: RecoveryStrategy = async (error, context) => {
    const errorMsg = error.message.toLowerCase();
    if (!errorMsg.includes("timeout") && !errorMsg.includes("timed out")) {
      return null;
    }

    const currentTimeout = (context.options?.timeout as number) || 30000;
    const attemptCount = context.attemptCount || 0;

    // Double timeout up to 2 minutes
    const newTimeout = Math.min(currentTimeout * 2, 120000);

    if (attemptCount >= 2 || newTimeout === currentTimeout) {
      return null; // Max attempts or can't increase further
    }

    return {
      recovered: false,
      message: `Retrying with increased timeout (${newTimeout / 1000}s)`,
      shouldRetry: true,
    };
  };

  /**
   * Strategy: Fallback to alternative source (Open VSX)
   */
  private sourceFallbackStrategy: RecoveryStrategy = async (error, context) => {
    const errorMsg = error.message.toLowerCase();
    if (!errorMsg.includes("403") && !errorMsg.includes("404") && !errorMsg.includes("network")) {
      return null;
    }

    const currentSource = (context.options?.source as string) || "marketplace";

    if (currentSource === "marketplace") {
      return {
        recovered: false,
        message: "Retrying with Open VSX registry",
        shouldRetry: true,
      };
    }

    return null; // Already tried fallback
  };

  /**
   * Strategy: Try direct installation (bypass CLI)
   */
  private directInstallStrategy: RecoveryStrategy = async (error, context) => {
    const errorMsg = error.message.toLowerCase();
    if (!errorMsg.includes("install") && !errorMsg.includes("cli")) {
      return null;
    }

    const attemptCount = context.attemptCount || 0;
    if (attemptCount >= 1) {
      return null; // Already tried
    }

    return {
      recovered: false,
      message: "Retrying with direct installation method",
      shouldRetry: true,
    };
  };

  /**
   * Strategy: Skip extension if already installed
   */
  private skipOnExistsStrategy: RecoveryStrategy = async (error) => {
    const errorMsg = error.message.toLowerCase();
    if (!errorMsg.includes("already installed") && !errorMsg.includes("already exists")) {
      return null;
    }

    return {
      recovered: true,
      message: "Extension already installed, skipping",
      shouldRetry: false,
    };
  };

  /**
   * Strategy: Re-download corrupted extension
   */
  private reDownloadStrategy: RecoveryStrategy = async (error, context) => {
    const errorMsg = error.message.toLowerCase();
    if (!errorMsg.includes("corrupt") && !errorMsg.includes("invalid")) {
      return null;
    }

    const attemptCount = context.attemptCount || 0;
    if (attemptCount >= 1) {
      return null; // Already tried
    }

    return {
      recovered: false,
      message: "Re-downloading extension (file may be corrupted)",
      shouldRetry: true,
    };
  };

  /**
   * Register custom recovery strategy
   */
  registerStrategy(name: string, strategy: RecoveryStrategy): void {
    this.strategies.set(name, strategy);
  }
}

/**
 * Singleton instance
 */
export const errorRecoveryService = new ErrorRecoveryService();
