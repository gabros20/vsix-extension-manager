/**
 * Version Check Service
 * Handles parallel version resolution with caching and rate limiting
 */

import { resolveVersion } from "../../../core/registry";

export interface VersionCheckRequest {
  id: string;
  currentVersion: string;
  preRelease: boolean;
  source: "marketplace" | "open-vsx" | "auto";
}

export interface VersionCheckResult {
  id: string;
  currentVersion: string;
  latestVersion?: string;
  error?: string;
  needsUpdate: boolean;
  cached: boolean;
}

/**
 * Service for checking extension versions in parallel
 */
export class VersionCheckService {
  /**
   * Check versions for multiple extensions in parallel with rate limiting
   */
  async checkVersions(
    requests: VersionCheckRequest[],
    options: {
      concurrency?: number;
      retry?: number;
      retryDelay?: number;
      rateLimitDelay?: number;
      onProgress?: (completed: number, total: number, extensionId?: string) => void;
    } = {},
  ): Promise<VersionCheckResult[]> {
    const {
      concurrency = 5,
      retry = 2,
      retryDelay = 1000,
      rateLimitDelay = 100,
      onProgress,
    } = options;

    const results: VersionCheckResult[] = [];
    let checkIndex = 0;
    let checkCompleted = 0;
    const total = requests.length;

    if (total === 0) {
      return [];
    }

    onProgress?.(0, total);

    // Process version checks in parallel with bounded concurrency
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(concurrency, requests.length); w++) {
      workers.push(
        (async () => {
          while (true) {
            const myIndex = checkIndex++;
            if (myIndex >= requests.length) break;

            const request = requests[myIndex];
            onProgress?.(checkCompleted, total, request.id);

            const result = await this.checkSingleVersion(request, retry, retryDelay);
            results.push(result);

            checkCompleted++;
            onProgress?.(checkCompleted, total);

            // Rate limiting delay to avoid API throttling
            if (myIndex < requests.length - 1) {
              await new Promise((r) => setTimeout(r, rateLimitDelay));
            }
          }
        })(),
      );
    }

    await Promise.all(workers);
    return results;
  }

  /**
   * Check version for a single extension
   */
  private async checkSingleVersion(
    request: VersionCheckRequest,
    retry: number,
    retryDelay: number,
  ): Promise<VersionCheckResult> {
    try {
      const latest = await this.withRetry(
        async () => resolveVersion(request.id, "latest", request.preRelease, request.source),
        retry,
        retryDelay,
      );

      if (!latest) {
        return {
          id: request.id,
          currentVersion: request.currentVersion,
          error: "Could not resolve latest version",
          needsUpdate: false,
          cached: false,
        };
      }

      const needsUpdate = this.isVersionNewer(latest, request.currentVersion);

      return {
        id: request.id,
        currentVersion: request.currentVersion,
        latestVersion: latest,
        needsUpdate,
        cached: false, // TODO: Track if result came from cache
      };
    } catch (error) {
      return {
        id: request.id,
        currentVersion: request.currentVersion,
        error: error instanceof Error ? error.message : String(error),
        needsUpdate: false,
        cached: false,
      };
    }
  }

  /**
   * Compare versions semantically - returns true if newVersion > currentVersion
   * Supports both 3-part (X.Y.Z) and 4-part (X.Y.Z.W) version formats with optional prerelease
   */
  private isVersionNewer(newVersion: string, currentVersion: string): boolean {
    if (newVersion === currentVersion) {
      return false;
    }

    const parseVersion = (v: string) => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
      if (!match) return null;
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        build: match[4] ? parseInt(match[4], 10) : 0,
        prerelease: match[5] || null,
      };
    };

    const newParsed = parseVersion(newVersion);
    const currentParsed = parseVersion(currentVersion);

    if (!newParsed || !currentParsed) {
      return newVersion !== currentVersion;
    }

    // Compare major.minor.patch.build
    if (newParsed.major !== currentParsed.major) {
      return newParsed.major > currentParsed.major;
    }
    if (newParsed.minor !== currentParsed.minor) {
      return newParsed.minor > currentParsed.minor;
    }
    if (newParsed.patch !== currentParsed.patch) {
      return newParsed.patch > currentParsed.patch;
    }
    if (newParsed.build !== currentParsed.build) {
      return newParsed.build > currentParsed.build;
    }

    // Same major.minor.patch.build - check prerelease
    if (!newParsed.prerelease && currentParsed.prerelease) {
      return true;
    }
    if (newParsed.prerelease && !currentParsed.prerelease) {
      return false;
    }

    if (newParsed.prerelease && currentParsed.prerelease) {
      return newParsed.prerelease > currentParsed.prerelease;
    }

    return false;
  }

  /**
   * Retry helper with exponential backoff
   */
  private async withRetry<T>(fn: () => Promise<T>, retry: number, delayMs: number): Promise<T> {
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
}

// Global instance
let globalVersionCheckService: VersionCheckService | null = null;

export function getVersionCheckService(): VersionCheckService {
  if (!globalVersionCheckService) {
    globalVersionCheckService = new VersionCheckService();
  }
  return globalVersionCheckService;
}
