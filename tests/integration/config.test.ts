/**
 * Integration tests for configuration system (v2.0 - Clean Slate)
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { ConfigLoaderV2 } from "../../src/config/loaderV2";
import type { ConfigV2 } from "../../src/config/schemaV2";

describe("Configuration System Integration (v2.0)", () => {
  let testDir: string;
  let configLoader: ConfigLoaderV2;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `vsix-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    configLoader = new ConfigLoaderV2();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("Configuration Loading", () => {
    it("should load configuration with correct precedence", async () => {
      // Create config file
      const configPath = path.join(testDir, "config.yml");
      await fs.writeFile(
        configPath,
        `
editor:
  prefer: cursor
behavior:
  update-check: weekly
`,
      );

      // Load with CLI overrides
      const config = await configLoader.loadConfig({ editor: { prefer: "vscode" } }, configPath);

      // CLI should override file
      expect(config.editor.prefer).toBe("vscode");
      // File value should be preserved for other settings
      expect(config.behavior.updateCheck).toBe("weekly");
    });

    it("should merge profile configurations", async () => {
      const configPath = path.join(testDir, "config.yml");
      await fs.writeFile(
        configPath,
        `
editor:
  prefer: cursor

profiles:
  production:
    performance:
      parallel-downloads: 1
  development:
    performance:
      parallel-downloads: 5

active-profile: development
`,
      );

      const config = await configLoader.loadConfig({}, configPath);

      // Should use development profile settings
      expect(config.performance.parallelDownloads).toBe(5);
    });

    it("should handle missing config file gracefully", async () => {
      const config = await configLoader.loadConfig({}, path.join(testDir, "nonexistent.yml"));

      // Should return defaults
      expect(config.editor.prefer).toBe("auto");
      expect(config.behavior.updateCheck).toBe("weekly");
    });
  });

  // Migration tests removed - v2.0 is a clean slate without v1.x compatibility

  describe("Profile System", () => {
    it("should switch profiles correctly", async () => {
      const configPath = path.join(testDir, "config.yml");
      await fs.writeFile(
        configPath,
        `
performance:
  parallel-downloads: 3

profiles:
  ci:
    performance:
      parallel-downloads: 1
    behavior:
      update-check: never
`,
      );

      // Load with production profile
      const prodConfig = await configLoader.loadConfig({ activeProfile: "ci" }, configPath);

      expect(prodConfig.performance.parallelDownloads).toBe(1);
      expect(prodConfig.behavior.updateCheck).toBe("never");
    });

    it("should handle non-existent profile gracefully", async () => {
      const configPath = path.join(testDir, "config.yml");
      await fs.writeFile(
        configPath,
        `
editor:
  prefer: cursor
`,
      );

      const config = await configLoader.loadConfig({ activeProfile: "nonexistent" }, configPath);

      // Should use base config
      expect(config.editor.prefer).toBe("cursor");
    });
  });

  describe("Environment Variables", () => {
    it("should map environment variables to config", async () => {
      // Set environment variables
      process.env.VSIX_EDITOR = "vscode";
      process.env.VSIX_PARALLEL_DOWNLOADS = "5";

      const config = await configLoader.loadConfig({});

      expect(config.editor.prefer).toBe("vscode");
      expect(config.performance.parallelDownloads).toBe(5);

      // Cleanup
      delete process.env.VSIX_EDITOR;
      delete process.env.VSIX_PARALLEL_DOWNLOADS;
    });
  });
});
