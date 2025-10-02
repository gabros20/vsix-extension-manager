/**
 * User intervention strategy
 * Prompts user for action when all automatic strategies fail
 */

import { BaseRetryStrategy } from "./BaseRetryStrategy";
import type { RetryContext, Task } from "../types";
import { ui } from "../../ui";

export class UserInterventionStrategy extends BaseRetryStrategy {
  name = "user-intervention";
  priority = 100; // Lowest priority (last resort)

  canHandle(error: Error, context: RetryContext): boolean {
    return context.attemptCount >= 2 && !context.metadata?.quiet;
  }

  async attempt<T>(task: Task<T>, context: RetryContext): Promise<T> {
    const lastError = context.lastError || new Error("Unknown error");
    const action = await this.promptForAction(lastError, task, context);

    switch (action) {
      case "retry":
        await this.delay(1000);
        return await task.run({
          ...context,
          attemptCount: context.attemptCount + 1,
        });

      case "skip":
        throw new Error("SKIP_REQUESTED");

      case "abort":
        throw new Error("USER_ABORTED");

      default:
        throw lastError;
    }
  }

  private async promptForAction(
    error: Error,
    task: Task,
    context: RetryContext,
  ): Promise<"retry" | "skip" | "abort"> {
    const message = `Operation "${task.name}" failed: ${error.message}\n\nHow would you like to proceed?`;

    const result = await ui.select<"retry" | "skip" | "abort">({
      message,
      options: [
        { value: "retry" as const, label: "Retry operation" },
        { value: "skip" as const, label: "Skip this item" },
        { value: "abort" as const, label: "Abort all operations" },
      ],
    });

    return result;
  }

  getDescription(error: Error, context: RetryContext): string {
    return "Requesting user intervention";
  }
}
