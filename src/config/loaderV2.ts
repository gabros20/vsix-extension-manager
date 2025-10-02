/**
 * Configuration Loader v2.0
 * Simple, flat configuration with YAML support
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";
import { ConfigV2Schema, DEFAULT_CONFIG_V2, type ConfigV2, type PartialConfigV2 } from "./schemaV2";
import { CONFIG_V2_FILE_NAMES, getConfigSearchPaths, ENV_VAR_MAP_V2 } from "./schemaV2";
// ConfigError class definition (moved from deleted loader.ts)
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Configuration loader for v2
 */
export class ConfigLoaderV2 {
  /**
   * Load complete configuration with precedence: CLI > ENV > File > Defaults
   */
  async loadConfig(
    cliConfig: PartialConfigV2 = {},
    options: {
      configPath?: string;
      skipEnv?: boolean;
      skipFile?: boolean;
    } = {},
  ): Promise<ConfigV2> {
    const configs: PartialConfigV2[] = [];

    // 1. Load defaults
    configs.push(DEFAULT_CONFIG_V2);

    // 2. Load file config
    if (!options.skipFile) {
      const fileConfig = await this.loadFileConfig(options.configPath);
      if (fileConfig) {
        configs.push(fileConfig);
      }
    }

    // 3. Load environment variables
    if (!options.skipEnv) {
      const envConfig = this.loadEnvConfig();
      if (Object.keys(envConfig).length > 0) {
        configs.push(envConfig);
      }
    }

    // 4. Apply CLI config (highest priority)
    if (Object.keys(cliConfig).length > 0) {
      configs.push(cliConfig);
    }

    // Merge all configs with precedence
    const merged = this.mergeConfigs(...configs);

    // Validate merged config
    return this.validateConfig(merged);
  }

  /**
   * Load configuration from file
   */
  private async loadFileConfig(explicitPath?: string): Promise<PartialConfigV2 | null> {
    try {
      const filePath = explicitPath || (await this.findConfigFile());

      if (!filePath) {
        return null;
      }

      const content = await fs.readFile(filePath, "utf-8");
      const ext = path.extname(filePath).toLowerCase();

      let parsed: unknown;

      // Parse based on file extension
      if (ext === ".json" || filePath.endsWith(".vsixrc")) {
        try {
          parsed = JSON.parse(content);
        } catch (error) {
          throw new ConfigError(
            `Invalid JSON in ${filePath}`,
            error instanceof Error ? error : undefined,
            "INVALID_JSON",
          );
        }
      } else if (ext === ".yml" || ext === ".yaml") {
        try {
          parsed = yaml.parse(content);
        } catch (error) {
          throw new ConfigError(
            `Invalid YAML in ${filePath}`,
            error instanceof Error ? error : undefined,
            "INVALID_YAML",
          );
        }
      } else {
        throw new ConfigError(
          `Unsupported config file format: ${filePath}`,
          undefined,
          "UNSUPPORTED_FORMAT",
        );
      }

      // Validate structure (partial validation)
      const result = ConfigV2Schema.partial().safeParse(parsed);
      if (!result.success) {
        const errors = result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
        throw new ConfigError(
          `Invalid configuration in ${filePath}: ${errors}`,
          undefined,
          "INVALID_CONFIG",
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      // File not found is not an error
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw new ConfigError(
        `Failed to load config file`,
        error instanceof Error ? error : undefined,
        "LOAD_ERROR",
      );
    }
  }

  /**
   * Find configuration file in search paths
   */
  private async findConfigFile(): Promise<string | null> {
    const searchPaths = getConfigSearchPaths();

    for (const searchPath of searchPaths) {
      for (const fileName of CONFIG_V2_FILE_NAMES) {
        const filePath = path.join(searchPath, fileName);
        if (await fs.pathExists(filePath)) {
          return filePath;
        }
      }
    }

    return null;
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvConfig(): PartialConfigV2 {
    const config: any = {};

    for (const [envVar, configPath] of Object.entries(ENV_VAR_MAP_V2)) {
      const value = process.env[envVar];
      if (value !== undefined && value !== "") {
        this.setNestedValue(config, configPath, this.parseEnvValue(value));
      }
    }

    return config;
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): any {
    // Try to parse as JSON for complex values
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    // Parse boolean
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Parse number
    const num = Number(value);
    if (!isNaN(num) && value === num.toString()) {
      return num;
    }

    return value;
  }

  /**
   * Set nested value in object using dot notation path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Deep merge multiple configs with precedence (later overrides earlier)
   */
  private mergeConfigs(...configs: PartialConfigV2[]): PartialConfigV2 {
    const result: any = {};

    for (const config of configs) {
      this.deepMerge(result, config);
    }

    return result;
  }

  /**
   * Deep merge helper
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Validate and fill in defaults for complete config
   */
  private validateConfig(config: PartialConfigV2): ConfigV2 {
    const result = ConfigV2Schema.safeParse(config);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new ConfigError(`Invalid configuration: ${errors}`, undefined, "VALIDATION_ERROR");
    }

    return result.data;
  }

  /**
   * Get effective configuration
   */
  async getEffectiveConfig(
    options: {
      configPath?: string;
      cliOverrides?: PartialConfigV2;
    } = {},
  ): Promise<ConfigV2> {
    return await this.loadConfig(options.cliOverrides || {}, {
      configPath: options.configPath,
    });
  }

  /**
   * Check if config file exists
   */
  async configExists(configPath?: string): Promise<boolean> {
    if (configPath) {
      return await fs.pathExists(configPath);
    }

    const found = await this.findConfigFile();
    return found !== null;
  }
}

/**
 * Singleton instance
 */
export const configLoaderV2 = new ConfigLoaderV2();

/**
 * Convenience function for loading config
 */
export async function loadConfigV2(
  cliConfig: PartialConfigV2 = {},
  options: {
    configPath?: string;
  } = {},
): Promise<ConfigV2> {
  return await configLoaderV2.loadConfig(cliConfig, options);
}
