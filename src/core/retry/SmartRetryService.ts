/**
 * Smart retry service with escalating strategies
 * Automatically selects and applies appropriate retry strategies
 */

import type { RetryContext, RetryOptions, RetryResult, RetryStrategy, Task } from "./types";
import {
  NetworkRetryStrategy,
  TimeoutIncreaseStrategy,
  DirectInstallStrategy,
  DownloadOnlyStrategy,
  UserInterventionStrategy,
} from "./strategies";
import { ui } from "../ui";

/**
 * Fatal errors that should never be retried
 */
const FATAL_ERROR_PATTERNS = [
  /404/i, // Not found
  /ENOENT/i, // File not found
  /EACCES/i, // Permission denied
  /invalid.*extension.*id/i, // Invalid extension ID
  /malformed/i, // Malformed data
  /unsupported/i, // Unsupported operation
  /cancelled/i, // User cancelled
  /aborted/i, // User aborted
];

export class SmartRetryService {
  private strategies: RetryStrategy[];

  constructor(customStrategies?: RetryStrategy[]) {
    this.strategies = customStrategies || this.getDefaultStrategies();
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if error is fatal and should not be retried
   */
  private isFatalError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return FATAL_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
  }

  private getDefaultStrategies(): RetryStrategy[] {
    return [
      new NetworkRetryStrategy(),
      new TimeoutIncreaseStrategy(),
      new DirectInstallStrategy(),
      new DownloadOnlyStrategy(),
      new UserInterventionStrategy(),
    ];
  }

  async executeWithRetry<T>(task: Task<T>, options: RetryOptions = {}): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const maxAttempts = options.maxAttempts || 3;

    const context: RetryContext = {
      attemptCount: 0,
      startTime,
      timeout: options.timeout,
      maxAttempts,
      metadata: options.metadata || {},
    };

    try {
      const data = await task.run(context);

      return {
        success: true,
        data,
        attempts: 1,
        duration: Date.now() - startTime,
      };
    } catch (initialError: unknown) {
      const error = initialError instanceof Error ? initialError : new Error(String(initialError));
      context.lastError = error;
      context.attemptCount = 1;

      // Quick exit for fatal errors - don't waste time retrying
      if (this.isFatalError(error)) {
        return {
          success: false,
          error,
          attempts: 1,
          duration: Date.now() - startTime,
        };
      }

      return await this.retryWithStrategies(task, context, error);
    }
  }

  private async retryWithStrategies<T>(
    task: Task<T>,
    context: RetryContext,
    lastError: Error,
  ): Promise<RetryResult<T>> {
    for (const strategy of this.strategies) {
      // Skip strategies that can't handle this error
      if (!strategy.canHandle(lastError, context)) {
        continue;
      }

      // Stop if we've exhausted retries
      if (context.attemptCount >= (context.maxAttempts || 3)) {
        break;
      }

      // Attempt strategy and handle result
      const result = await this.attemptStrategy(strategy, task, context);

      // Handle success
      if (result.type === "success") {
        return result.value;
      }

      // Handle special errors (abort, skip)
      if (result.type === "special") {
        if (result.shouldThrow) {
          throw result.error;
        }
        if (result.value) {
          return result.value;
        }
        // Shouldn't happen, but return failure if no value
        return this.buildFailureResult(result.error, context);
      }

      // Handle retry errors
      lastError = result.error;
      context.lastError = result.error;
      context.attemptCount++;

      // Stop on fatal errors
      if (this.isFatalError(result.error)) {
        break;
      }

      // Check if we should continue retrying
      if (!(await this.shouldContinue(result.error, strategy, context))) {
        break;
      }
    }

    return this.buildFailureResult(lastError, context);
  }

  /**
   * Attempt a single strategy and classify the result
   */
  private async attemptStrategy<T>(
    strategy: RetryStrategy,
    task: Task<T>,
    context: RetryContext,
  ): Promise<
    | { type: "success"; value: RetryResult<T> }
    | { type: "special"; error: Error; shouldThrow: boolean; value?: RetryResult<T> }
    | { type: "retry"; error: Error }
  > {
    try {
      const description = strategy.getDescription(context.lastError!, context);
      if (!context.metadata?.quiet) {
        ui.log.warning(`${description}...`);
      }

      const data = await strategy.attempt(task, context);

      return {
        type: "success",
        value: {
          success: true,
          data,
          strategy: strategy.name,
          attempts: context.attemptCount + 1,
          duration: Date.now() - context.startTime,
        },
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Handle user abort
      if (err.message === "USER_ABORTED") {
        return { type: "special", error: err, shouldThrow: true };
      }

      // Handle skip request
      if (err.message === "SKIP_REQUESTED") {
        return {
          type: "special",
          error: err,
          shouldThrow: false,
          value: {
            success: false,
            error: err,
            strategy: strategy.name,
            attempts: context.attemptCount + 1,
            duration: Date.now() - context.startTime,
          },
        };
      }

      // Regular retry error
      return { type: "retry", error: err };
    }
  }

  /**
   * Build final failure result
   */
  private buildFailureResult<T>(error: Error, context: RetryContext): RetryResult<T> {
    return {
      success: false,
      error,
      attempts: context.attemptCount,
      duration: Date.now() - context.startTime,
    };
  }

  private async shouldContinue(
    error: Error,
    strategy: RetryStrategy,
    context: RetryContext,
  ): Promise<boolean> {
    if (context.attemptCount >= (context.maxAttempts || 3)) {
      return false;
    }

    if (error.message === "USER_ABORTED" || error.message === "SKIP_REQUESTED") {
      return false;
    }

    return true;
  }

  async executeBatch<T>(tasks: Task<T>[], options: RetryOptions = {}): Promise<RetryResult<T>[]> {
    const results: RetryResult<T>[] = [];

    for (const task of tasks) {
      const result = await this.executeWithRetry(task, options);
      results.push(result);

      if (result.error?.message === "USER_ABORTED") {
        break;
      }
    }

    return results;
  }

  getStrategyNames(): string[] {
    return this.strategies.map((s) => s.name);
  }

  getStrategy(name: string): RetryStrategy | undefined {
    return this.strategies.find((s) => s.name === name);
  }
}

export const smartRetryService = new SmartRetryService();
