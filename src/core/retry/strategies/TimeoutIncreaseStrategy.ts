/**
 * Timeout increase retry strategy
 * Doubles timeout on timeout errors
 */

import { BaseRetryStrategy } from "./BaseRetryStrategy";
import type { RetryContext, Task } from "../types";

export class TimeoutIncreaseStrategy extends BaseRetryStrategy {
  name = "timeout-increase";
  priority = 10;

  canHandle(error: Error, context: RetryContext): boolean {
    const isTimeout =
      error.name === "TimeoutError" ||
      error.message.toLowerCase().includes("timeout") ||
      error.message.toLowerCase().includes("timed out");

    return isTimeout && context.attemptCount < 3;
  }

  async attempt<T>(task: Task<T>, context: RetryContext): Promise<T> {
    const newTimeout = (context.timeout || 30000) * 2;

    await this.delay(2000); // Brief delay before retry

    return await task.run({
      ...context,
      timeout: newTimeout,
      attemptCount: context.attemptCount + 1,
    });
  }

  getDescription(error: Error, context: RetryContext): string {
    const newTimeout = ((context.timeout || 30000) * 2) / 1000;
    return `Increasing timeout to ${newTimeout}s and retrying`;
  }
}
