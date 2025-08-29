import { PROGRESS_UPDATE_INTERVAL_MS } from "../config/constants";
import type { BulkOptions } from "./types";

export function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

type CliBulk = {
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;
  quiet?: boolean;
  json?: boolean;
  summary?: string;
  source?: string;
  filenameTemplate?: string;
  cacheDir?: string;
  skipExisting?: boolean;
  overwrite?: boolean;
  checksum?: boolean;
  verifyChecksum?: string;
};

export function buildBulkOptionsFromCli(
  cli: CliBulk,
  defaults?: { parallel?: number; retry?: number; retryDelay?: number },
): BulkOptions {
  const normalizedSource =
    cli.source === "marketplace" || cli.source === "open-vsx" ? cli.source : undefined;
  return {
    parallel: cli.parallel !== undefined ? Number(cli.parallel) : defaults?.parallel,
    retry: cli.retry !== undefined ? Number(cli.retry) : defaults?.retry,
    retryDelay: cli.retryDelay !== undefined ? Number(cli.retryDelay) : defaults?.retryDelay,
    quiet: cli.quiet,
    json: cli.json,
    summaryPath: cli.summary,
    source: normalizedSource,
    filenameTemplate: cli.filenameTemplate,
    cacheDir: cli.cacheDir,
    skipExisting: cli.skipExisting,
    overwrite: cli.overwrite,
    checksum: cli.checksum,
    verifyChecksum: cli.verifyChecksum,
  };
}

export function shouldUpdateProgress(last: number, now: number): boolean {
  return now - last >= PROGRESS_UPDATE_INTERVAL_MS;
}
