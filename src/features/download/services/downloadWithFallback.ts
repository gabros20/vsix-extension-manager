import path from "path";
import { downloadSingleExtension } from "./singleDownloadService";
import { FileExistsAction } from "../../../core/filesystem";
import type { ProgressInfo } from "../../../core/ui/progress";

interface DownloadWithFallbackOptions {
  preRelease: boolean;
  sourcePref: "marketplace" | "open-vsx" | "auto";
  quiet: boolean;
  retry: number;
  retryDelay: number;
  progressCallback?: (progress: ProgressInfo) => void;
}

/**
 * Download extension with intelligent source fallback
 * Tries marketplace first, then falls back to OpenVSX (or vice versa based on preference)
 */
export async function downloadWithFallback(
  extensionId: string,
  version: string,
  outputDir: string,
  options: DownloadWithFallbackOptions,
): Promise<string> {
  const url = `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;
  const sources: ("marketplace" | "open-vsx")[] =
    options.sourcePref === "open-vsx"
      ? ["open-vsx", "marketplace"]
      : options.sourcePref === "marketplace"
        ? ["marketplace", "open-vsx"]
        : ["marketplace", "open-vsx"]; // auto: prefer marketplace

  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      const dl = await withRetry(
        async () => {
          return downloadSingleExtension({
            url,
            requestedVersion: version,
            preferPreRelease: options.preRelease,
            source,
            outputDir,
            fileExistsAction: FileExistsAction.OVERWRITE,
            quiet: options.quiet,
            progressCallback: options.progressCallback,
          });
        },
        options.retry,
        options.retryDelay,
      );
      return dl.filePath || path.join(dl.outputDir, dl.filename);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next source
    }
  }

  throw lastError || new Error(`Failed to download ${extensionId} from all sources`);
}

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, retry: number, delayMs: number): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retry) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
