/**
 * Configuration Migration Utility
 * Automatically migrates v1 configuration to v2 format
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";
import type { Config as ConfigV1 } from "./schema";
import type { ConfigV2, PartialConfigV2 } from "./schemaV2";
import { SAMPLE_CONFIG_V2 } from "./schemaV2";
import { ui } from "../core/ui";

/**
 * Configuration migrator
 */
export class ConfigMigrator {
  /**
   * Migrate v1 config to v2 format
   */
  migrateFromV1(oldConfig: ConfigV1): PartialConfigV2 {
    const newConfig: PartialConfigV2 = {
      version: "2.0",
      editor: {
        prefer: this.mapEditor((oldConfig as any).editor),
        "cursor-binary": oldConfig.cursorBin,
        "vscode-binary": oldConfig.codeBin,
      },
      safety: {
        "check-compatibility": (oldConfig as any).checkCompatibility ?? true,
        "auto-backup": true, // New feature, enable by default
        "verify-checksums": (oldConfig as any).checksum ?? true,
        "allow-mismatch": (oldConfig as any).allowMismatchedBinary ?? false,
      },
      performance: {
        "parallel-downloads": oldConfig.parallel || 3,
        "parallel-installs": (oldConfig as any).installParallel || 1,
        timeout: (oldConfig as any).timeout || 30000,
        retry: (oldConfig as any).installRetry || 2,
        "retry-delay": oldConfig.retryDelay || 1000,
      },
      behavior: {
        "skip-installed": oldConfig.skipExisting ? "always" : "ask",
        "update-check": "weekly", // New feature
        "auto-retry": ((oldConfig as any).installRetry || 0) > 0,
        "download-dir": oldConfig.outputDir || "./downloads",
        "cache-dir": (oldConfig as any).cacheDir,
      },
      network: {
        source: this.mapSource(oldConfig.source),
        "user-agent": (oldConfig as any).userAgent,
      },
      output: {
        format: oldConfig.json ? "json" : oldConfig.quiet ? "quiet" : "auto",
        colors: !oldConfig.quiet,
        "show-progress": !oldConfig.quiet,
      },
    };

    return newConfig;
  }

  /**
   * Map v1 editor value to v2
   */
  private mapEditor(editor: string | undefined): "cursor" | "vscode" | "auto" {
    if (!editor) return "auto";

    switch (editor.toLowerCase()) {
      case "cursor":
        return "cursor";
      case "vscode":
      case "code":
        return "vscode";
      default:
        return "auto";
    }
  }

  /**
   * Map v1 source value to v2
   */
  private mapSource(source: string | undefined): "marketplace" | "open-vsx" | "auto" {
    if (!source) return "auto";

    switch (source.toLowerCase()) {
      case "marketplace":
        return "marketplace";
      case "open-vsx":
      case "openvsx":
        return "open-vsx";
      default:
        return "auto";
    }
  }

  /**
   * Auto-migrate if v1 config exists and v2 doesn't
   */
  async autoMigrateIfNeeded(options: {
    interactive?: boolean;
    dryRun?: boolean;
  } = {}): Promise<boolean> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";

    // Check for v1 config files
    const v1Paths = [
      path.join(homeDir, ".vsixrc"),
      path.join(homeDir, ".vsixrc.json"),
      path.join(homeDir, ".config", "vsix-extension-manager", "config.json"),
    ];

    const v2Paths = [
      path.join(homeDir, ".vsix", "config.yml"),
      path.join(homeDir, ".vsix.yml"),
    ];

    // Find existing v1 config
    let v1ConfigPath: string | null = null;
    for (const p of v1Paths) {
      if (await fs.pathExists(p)) {
        v1ConfigPath = p;
        break;
      }
    }

    if (!v1ConfigPath) {
      return false; // No v1 config to migrate
    }

    // Check if v2 config already exists
    for (const p of v2Paths) {
      if (await fs.pathExists(p)) {
        return false; // v2 config already exists, skip migration
      }
    }

    // Ask user for confirmation if interactive
    if (options.interactive) {
      ui.intro("🔄 Configuration Migration");
      ui.log.info(`Found v1.x configuration: ${v1ConfigPath}`);
      ui.log.info("Upgrading to v2.0 configuration format...");

      const confirm = await ui.confirm("Proceed with migration?", true);
      if (!confirm) {
        ui.outro("Migration cancelled");
        return false;
      }
    }

    // Load v1 config
    const v1Content = await fs.readFile(v1ConfigPath, "utf-8");
    const v1Config = JSON.parse(v1Content);

    // Migrate to v2
    const v2Config = this.migrateFromV1(v1Config);

    if (options.dryRun) {
      console.log("Migrated configuration (dry run):");
      console.log(yaml.stringify(v2Config));
      return false;
    }

    // Write v2 config
    const v2ConfigPath = path.join(homeDir, ".vsix", "config.yml");
    await fs.ensureDir(path.dirname(v2ConfigPath));
    await fs.writeFile(v2ConfigPath, yaml.stringify(v2Config));

    // Backup v1 config
    const backupPath = `${v1ConfigPath}.v1.backup`;
    await fs.copyFile(v1ConfigPath, backupPath);

    if (options.interactive) {
      ui.log.success("✓ Migration complete!");
      ui.log.info(`New config: ${v2ConfigPath}`);
      ui.log.info(`Backup: ${backupPath}`);
      ui.outro("Configuration upgraded to v2.0");
    }

    return true;
  }

  /**
   * Create new v2 config file with sample content
   */
  async createSampleConfig(
    targetPath?: string,
    options: { force?: boolean } = {},
  ): Promise<string> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
    const configPath = targetPath || path.join(homeDir, ".vsix", "config.yml");

    // Check if file already exists
    if ((await fs.pathExists(configPath)) && !options.force) {
      throw new Error(`Configuration file already exists: ${configPath}`);
    }

    // Ensure directory exists
    await fs.ensureDir(path.dirname(configPath));

    // Write sample config
    await fs.writeFile(configPath, SAMPLE_CONFIG_V2);

    return configPath;
  }

  /**
   * Validate existing v2 config file
   */
  async validateConfig(configPath: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const parsed = yaml.parse(content);

      const { ConfigV2Schema } = await import("./schemaV2");
      const result = ConfigV2Schema.safeParse(parsed);

      if (result.success) {
        return { valid: true, errors: [] };
      } else {
        return {
          valid: false,
          errors: result.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}

/**
 * Singleton instance
 */
export const configMigrator = new ConfigMigrator();

/**
 * Convenience function for auto-migration
 */
export async function autoMigrateConfig(
  interactive = false,
  dryRun = false,
): Promise<boolean> {
  return await configMigrator.autoMigrateIfNeeded({ interactive, dryRun });
}
