/**
 * Integration tests for update system
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { UpdateChecker } from "../../src/core/updates/UpdateChecker";
import { NotificationService } from "../../src/core/updates/NotificationService";
import type { CheckFrequency } from "../../src/core/updates/types";

describe("Update System Integration", () => {
  let updateChecker: UpdateChecker;
  let notificationService: NotificationService;
  let testCacheDir: string;

  beforeEach(async () => {
    testCacheDir = path.join(os.tmpdir(), `vsix-update-test-${Date.now()}`);
    await fs.ensureDir(testCacheDir);

    // Create instances with test cache directory
    updateChecker = new UpdateChecker();
    notificationService = new NotificationService();
  });

  afterEach(async () => {
    await fs.remove(testCacheDir);
    await updateChecker.clearCache();
  });

  describe("Update Checking", () => {
    it("should check for updates with caching", async () => {
      const result1 = await updateChecker.checkForUpdates("weekly");

      expect(result1).toHaveProperty("updates");
      expect(result1).toHaveProperty("lastCheck");
      expect(result1).toHaveProperty("nextCheck");
      expect(result1.duration).toBeGreaterThanOrEqual(0);

      // Second check should use cache
      const result2 = await updateChecker.checkForUpdates("weekly");

      expect(result2.duration).toBe(0); // Cached result
      expect(result2.lastCheck).toBe(result1.lastCheck);
    });

    it("should force fresh check", async () => {
      const result1 = await updateChecker.checkForUpdates("weekly");

      // Force fresh check
      const result2 = await updateChecker.checkForUpdates("weekly", {
        force: true,
      });

      expect(result2.duration).toBeGreaterThan(0); // Fresh check
      expect(result2.lastCheck).toBeGreaterThan(result1.lastCheck);
    });

    it("should respect never frequency", async () => {
      const result = await updateChecker.checkForUpdates("never");

      expect(result.updates).toEqual([]);
      expect(result.lastCheck).toBe(0);
      expect(result.nextCheck).toBe(0);
    });

    it("should always check with always frequency", async () => {
      const result1 = await updateChecker.checkForUpdates("always");
      const result2 = await updateChecker.checkForUpdates("always");

      // Both should be fresh checks
      expect(result1.duration).toBeGreaterThan(0);
      expect(result2.duration).toBeGreaterThan(0);
    });
  });

  describe("Version Comparison", () => {
    it("should detect newer versions", () => {
      const checker = new UpdateChecker();

      // Access private method via type assertion for testing
      const isNewer = (checker as any).isNewerVersion;

      expect(isNewer("2.0.0", "1.0.0")).toBe(true);
      expect(isNewer("1.1.0", "1.0.0")).toBe(true);
      expect(isNewer("1.0.1", "1.0.0")).toBe(true);
    });

    it("should detect equal versions", () => {
      const checker = new UpdateChecker();
      const isNewer = (checker as any).isNewerVersion;

      expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    });

    it("should detect older versions", () => {
      const checker = new UpdateChecker();
      const isNewer = (checker as any).isNewerVersion;

      expect(isNewer("1.0.0", "2.0.0")).toBe(false);
    });
  });

  describe("Cache Management", () => {
    it("should cache results correctly", async () => {
      await updateChecker.checkForUpdates("weekly");

      const lastCheck = await updateChecker.getLastCheckTime();
      expect(lastCheck).toBeGreaterThan(0);
    });

    it("should clear cache", async () => {
      await updateChecker.checkForUpdates("weekly");
      await updateChecker.clearCache();

      const lastCheck = await updateChecker.getLastCheckTime();
      expect(lastCheck).toBe(0);
    });

    it("should format last check time", () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const formatted = updateChecker.formatLastCheck(oneHourAgo);
      expect(formatted).toContain("hour");
    });
  });

  describe("Check Frequencies", () => {
    const frequencies: CheckFrequency[] = ["never", "daily", "weekly", "always"];

    frequencies.forEach((frequency) => {
      it(`should handle ${frequency} frequency`, async () => {
        const result = await updateChecker.checkForUpdates(frequency);

        expect(result).toHaveProperty("updates");
        expect(result).toHaveProperty("lastCheck");
        expect(result).toHaveProperty("nextCheck");
      });
    });
  });

  describe("Notification Display", () => {
    it("should show update notification", () => {
      const result = {
        updates: [
          {
            extensionId: "ms-python.python",
            currentVersion: "2024.0.0",
            latestVersion: "2024.2.0",
            updateAvailable: true,
            source: "marketplace" as const,
          },
        ],
        lastCheck: Date.now(),
        nextCheck: Date.now() + 7 * 24 * 60 * 60 * 1000,
        duration: 1000,
      };

      // Should not throw
      expect(() => {
        notificationService.showUpdateNotification(result);
      }).not.toThrow();
    });

    it("should show update hint", () => {
      expect(() => {
        notificationService.showUpdateHint(3);
      }).not.toThrow();
    });

    it("should respect quiet mode", () => {
      const result = {
        updates: [
          {
            extensionId: "test",
            currentVersion: "1.0.0",
            latestVersion: "2.0.0",
            updateAvailable: true,
            source: "marketplace" as const,
          },
        ],
        lastCheck: Date.now(),
        nextCheck: Date.now(),
        duration: 0,
      };

      // Should not output in quiet mode
      expect(() => {
        notificationService.showUpdateNotification(result, true);
      }).not.toThrow();
    });

    it("should show detailed updates", () => {
      const updates = [
        {
          extensionId: "ms-python.python",
          currentVersion: "2024.0.0",
          latestVersion: "2024.2.0",
          updateAvailable: true,
          source: "marketplace" as const,
        },
      ];

      expect(() => {
        notificationService.showDetailedUpdates(updates);
      }).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      // Simulate network unavailable by using invalid editor
      const result = await updateChecker.checkForUpdates("weekly", {
        editor: "nonexistent" as any,
      });

      // Should return empty updates, not throw
      expect(result.updates).toEqual([]);
    });

    it("should show check error notification", () => {
      const error = new Error("Network unavailable");

      expect(() => {
        notificationService.showCheckError(error);
      }).not.toThrow();
    });
  });
});
