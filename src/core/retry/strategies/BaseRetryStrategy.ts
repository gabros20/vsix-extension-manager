/**
 * Base retry strategy class
 */

import type { RetryStrategy, RetryContext, Task } from "../types";

export abstract class BaseRetryStrategy implements RetryStrategy {
  abstract name: string;
  abstract priority: number;

  abstract canHandle(error: Error, context: RetryContext): boolean;
  abstract attempt<T>(task: Task<T>, context: RetryContext): Promise<T>;
  abstract getDescription(error: Error, context: RetryContext): string;

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected calculateBackoff(attemptCount: number, baseDelay = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attemptCount - 1), 30000);
  }
}
