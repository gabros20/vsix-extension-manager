/**
 * Network retry strategy
 * Handles network errors with exponential backoff
 */

import { BaseRetryStrategy } from "./BaseRetryStrategy";
import type { RetryContext, Task } from "../types";

export class NetworkRetryStrategy extends BaseRetryStrategy {
  name = "network-retry";
  priority = 5;

  canHandle(error: Error, context: RetryContext): boolean {
    const isNetworkError =
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("econnrefused") ||
      error.message.toLowerCase().includes("enotfound") ||
      error.message.toLowerCase().includes("etimedout") ||
      error.message.toLowerCase().includes("fetch failed");

    return isNetworkError && context.attemptCount < 5;
  }

  async attempt<T>(task: Task<T>, context: RetryContext): Promise<T> {
    const backoffDelay = this.calculateBackoff(context.attemptCount);

    await this.delay(backoffDelay);

    return await task.run({
      ...context,
      attemptCount: context.attemptCount + 1,
    });
  }

  getDescription(error: Error, context: RetryContext): string {
    const delay = this.calculateBackoff(context.attemptCount) / 1000;
    return `Network error detected. Retrying in ${delay}s`;
  }
}
