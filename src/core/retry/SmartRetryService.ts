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

export class SmartRetryService {
  private strategies: RetryStrategy[];

  constructor(customStrategies?: RetryStrategy[]) {
    this.strategies = customStrategies || this.getDefaultStrategies();
    this.strategies.sort((a, b) => a.priority - b.priority);
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
    } catch (initialError: any) {
      context.lastError = initialError;
      context.attemptCount = 1;

      return await this.retryWithStrategies(task, context, initialError);
    }
  }

  private async retryWithStrategies<T>(
    task: Task<T>,
    context: RetryContext,
    lastError: Error,
  ): Promise<RetryResult<T>> {
    for (const strategy of this.strategies) {
      if (!strategy.canHandle(lastError, context)) {
        continue;
      }

      if (context.attemptCount >= (context.maxAttempts || 3)) {
        break;
      }

      try {
        const description = strategy.getDescription(lastError, context);
        if (!context.metadata?.quiet) {
          ui.log.warning(`${description}...`);
        }

        const data = await strategy.attempt(task, context);

        return {
          success: true,
          data,
          strategy: strategy.name,
          attempts: context.attemptCount + 1,
          duration: Date.now() - context.startTime,
        };
      } catch (error: any) {
        if (error.message === "USER_ABORTED") {
          throw error;
        }

        if (error.message === "SKIP_REQUESTED") {
          return {
            success: false,
            error,
            strategy: strategy.name,
            attempts: context.attemptCount + 1,
            duration: Date.now() - context.startTime,
          };
        }

        lastError = error;
        context.lastError = error;
        context.attemptCount++;

        if (!(await this.shouldContinue(error, strategy, context))) {
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError,
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

  async executeBatch<T>(
    tasks: Task<T>[],
    options: RetryOptions = {},
  ): Promise<RetryResult<T>[]> {
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
