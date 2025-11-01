/**
 * Direct install fallback strategy
 * Falls back to direct installation bypassing CLI
 */

import { BaseRetryStrategy } from "./BaseRetryStrategy";
import type { RetryContext, Task } from "../types";

export class DirectInstallStrategy extends BaseRetryStrategy {
  name = "direct-install";
  priority = 20;

  canHandle(error: Error, context: RetryContext): boolean {
    const isInstallError =
      error.message.toLowerCase().includes("install") ||
      error.message.toLowerCase().includes("extension") ||
      error.message.toLowerCase().includes("cli");

    const strategy = context.metadata?.strategy;
    const notAlreadyDirect =
      !(typeof strategy === "string" && strategy.includes("direct")) &&
      !(Array.isArray(strategy) && strategy.includes("direct"));

    return isInstallError && notAlreadyDirect && context.attemptCount < 2;
  }

  async attempt<T>(task: Task<T>, context: RetryContext): Promise<T> {
    await this.delay(1000);

    return await task.run({
      ...context,
      attemptCount: context.attemptCount + 1,
      metadata: {
        ...context.metadata,
        strategy: "direct",
        fallback: true,
      },
    });
  }

  getDescription(): string {
    return "Falling back to direct installation method";
  }
}
