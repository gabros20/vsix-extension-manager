/**
 * Download-only fallback strategy
 * Downloads extension without installing on install failures
 */

import { BaseRetryStrategy } from "./BaseRetryStrategy";
import type { RetryContext, Task } from "../types";

export class DownloadOnlyStrategy extends BaseRetryStrategy {
  name = "download-only";
  priority = 30;

  canHandle(error: Error, context: RetryContext): boolean {
    const isInstallError =
      error.message.toLowerCase().includes("install") ||
      error.message.toLowerCase().includes("extension");

    const hasDownloadOption = context.metadata?.supportsDownloadOnly === true;

    return isInstallError && hasDownloadOption && context.attemptCount >= 2;
  }

  async attempt<T>(task: Task<T>, context: RetryContext): Promise<T> {
    return await task.run({
      ...context,
      attemptCount: context.attemptCount + 1,
      metadata: {
        ...context.metadata,
        downloadOnly: true,
        skipInstall: true,
      },
    });
  }

  getDescription(_error: Error, _context: RetryContext): string {
    return "Installation failed. Downloading only (manual install required)";
  }
}
