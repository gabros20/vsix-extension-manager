/**
 * Background update checker service
 * Non-intrusive update notifications with configurable frequency
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import type {
  UpdateInfo,
  UpdateCheckResult,
  UpdateCache,
  CheckFrequency,
  UpdateCheckerOptions,
} from "./types";
import { getInstalledExtensions } from "../../features/export";
import { resolveVersion } from "../registry";

export class UpdateChecker {
  private cacheFile: string;
  private cacheDuration: Record<CheckFrequency, number> = {
    never: Infinity,
    daily: 24 * 60 * 60 * 1000, // 24 hours
    weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
    always: 0, // No cache
  };

  constructor() {
    const cacheDir = path.join(os.homedir(), ".vsix");
    this.cacheFile = path.join(cacheDir, "update-cache.json");
  }

  /**
   * Check for extension updates
   */
  async checkForUpdates(
    frequency: CheckFrequency = "weekly",
    options: UpdateCheckerOptions = {},
  ): Promise<UpdateCheckResult> {
    const startTime = Date.now();

    // Never check if disabled
    if (frequency === "never" && !options.force) {
      return {
        updates: [],
        lastCheck: 0,
        nextCheck: 0,
        duration: 0,
      };
    }

    // Check if we should use cache
    if (!options.force && frequency !== "always") {
      const cached = await this.getCachedResults(frequency);
      if (cached) {
        return cached;
      }
    }

    // Fetch updates
    const updates = await this.fetchUpdates(options);

    // Cache results
    await this.cacheResults(updates, frequency);

    const now = Date.now();
    const cacheDuration = this.cacheDuration[frequency];

    return {
      updates,
      lastCheck: now,
      nextCheck: cacheDuration === Infinity ? 0 : now + cacheDuration,
      duration: now - startTime,
    };
  }

  /**
   * Fetch available updates for installed extensions
   */
  private async fetchUpdates(options: UpdateCheckerOptions): Promise<UpdateInfo[]> {
    const updates: UpdateInfo[] = [];

    try {
      // Get installed extensions
      const editor = options.editor as "cursor" | "vscode" | "auto" | undefined;
      const installed = await getInstalledExtensions(editor || "auto");

      // Check each extension for updates
      for (const extension of installed) {
        try {
          const latestVersion = await resolveVersion(
            extension.id,
            "latest",
            false,
            "auto",
          );

          if (this.isNewerVersion(latestVersion, extension.version)) {
            updates.push({
              extensionId: extension.id,
              currentVersion: extension.version,
              latestVersion,
              updateAvailable: true,
              source: "marketplace",
            });
          }
        } catch (error) {
          // Skip extensions that fail to check (might be local-only)
          continue;
        }
      }
    } catch (error) {
      // Silently fail - don't interrupt user workflow
      console.error("Update check failed:", error instanceof Error ? error.message : String(error));
    }

    return updates;
  }

  /**
   * Check if we should use cached results
   */
  private async getCachedResults(frequency: CheckFrequency): Promise<UpdateCheckResult | null> {
    try {
      if (!(await fs.pathExists(this.cacheFile))) {
        return null;
      }

      const cache: UpdateCache = await fs.readJSON(this.cacheFile);
      const now = Date.now();
      const cacheDuration = this.cacheDuration[frequency];

      // Check if cache is still valid
      if (now - cache.lastCheck < cacheDuration) {
        return {
          updates: cache.updates,
          lastCheck: cache.lastCheck,
          nextCheck: cache.lastCheck + cacheDuration,
          duration: 0, // Cached result
        };
      }
    } catch (error) {
      // Cache read error - fetch fresh
      return null;
    }

    return null;
  }

  /**
   * Cache update results
   */
  private async cacheResults(updates: UpdateInfo[], frequency: CheckFrequency): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.cacheFile));

      const cache: UpdateCache = {
        lastCheck: Date.now(),
        updates,
        frequency,
      };

      await fs.writeJSON(this.cacheFile, cache, { spaces: 2 });
    } catch (error) {
      // Silently fail - caching is not critical
    }
  }

  /**
   * Compare versions (simple semantic version comparison)
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split(".").map(Number);
    const currentParts = current.split(".").map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }

    return false;
  }

  /**
   * Get last check time
   */
  async getLastCheckTime(): Promise<number> {
    try {
      if (!(await fs.pathExists(this.cacheFile))) {
        return 0;
      }

      const cache: UpdateCache = await fs.readJSON(this.cacheFile);
      return cache.lastCheck;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format last check time for display
   */
  formatLastCheck(timestamp: number): string {
    if (timestamp === 0) return "never";

    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        await fs.remove(this.cacheFile);
      }
    } catch (error) {
      // Silently fail
    }
  }
}

export const updateChecker = new UpdateChecker();
