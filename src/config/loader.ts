// Configuration loader for VSIX Extension Manager
// Supports configuration files, environment variables, and CLI arguments

import fs from "fs-extra";
import path from "path";
import * as yaml from "yaml";
import { ConfigSchema, DEFAULT_CONFIG, CONFIG_FILE_NAMES, ENV_VAR_MAP } from "./schema";
import type { Config, PartialConfig } from "./schema";

/**
 * Configuration loading error types
 */
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
 * Find configuration file in search paths
 */
async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
  const searchPaths = [
    startDir,
    path.join(startDir, ".config"),
    path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".config",
      "vsix-extension-manager",
    ),
    path.join(process.env.HOME || process.env.USERPROFILE || "~"),
  ];

  for (const searchPath of searchPaths) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = path.join(searchPath, fileName);
      if (await fs.pathExists(filePath)) {
        return filePath;
      }
    }
  }

  return null;
}

/**
 * Load and parse configuration file
 */
async function loadConfigFile(filePath: string): Promise<PartialConfig> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();

    let parsed: unknown;

    if (ext === ".json" || filePath.endsWith(".vsixrc")) {
      try {
        parsed = JSON.parse(content);
      } catch (jsonError) {
        throw new ConfigError(
          `Invalid JSON in config file: ${filePath}`,
          jsonError as Error,
          "INVALID_JSON",
        );
      }
    } else if (ext === ".yaml" || ext === ".yml") {
      try {
        parsed = yaml.parse(content);
      } catch (yamlError) {
        throw new ConfigError(
          `Invalid YAML in config file: ${filePath}`,
          yamlError as Error,
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

    // Validate parsed config against schema
    const result = ConfigSchema.partial().safeParse(parsed);
    if (!result.success) {
      const errorDetails = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new ConfigError(
        `Invalid configuration in ${filePath}: ${errorDetails}`,
        undefined,
        "INVALID_CONFIG",
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `Failed to load config file: ${filePath}`,
      error as Error,
      "FILE_READ_ERROR",
    );
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): PartialConfig {
  const envConfig: Record<string, unknown> = {};

  for (const [envVar, configKey] of Object.entries(ENV_VAR_MAP)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      // Type conversion based on schema - simple heuristic approach
      if (typeof DEFAULT_CONFIG[configKey as keyof typeof DEFAULT_CONFIG] === "boolean") {
        envConfig[configKey] = value.toLowerCase() === "true" || value === "1";
      } else if (typeof DEFAULT_CONFIG[configKey as keyof typeof DEFAULT_CONFIG] === "number") {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          envConfig[configKey] = numValue;
        }
      } else {
        envConfig[configKey] = value;
      }
    }
  }

  // Validate env config
  const result = ConfigSchema.partial().safeParse(envConfig);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new ConfigError(
      `Invalid environment configuration: ${errorDetails}`,
      undefined,
      "INVALID_ENV_CONFIG",
    );
  }

  return result.data;
}

/**
 * Convert CLI arguments to configuration format
 */
export function convertCliToConfig(cliArgs: Record<string, unknown>): PartialConfig {
  const config: Record<string, unknown> = {};

  // Map CLI argument names to config keys
  const cliMap: Record<string, string> = {
    output: "outputDir",
    cacheDir: "cacheDir",
    parallel: "parallel",
    retry: "retry",
    retryDelay: "retryDelay",
    skipExisting: "skipExisting",
    overwrite: "overwrite",
    filenameTemplate: "filenameTemplate",
    quiet: "quiet",
    json: "json",
    source: "source",
    preRelease: "preRelease",
    checksum: "checksum",
    editor: "editor",

    // Install options
    installParallel: "installParallel",
    installRetry: "installRetry",
    installRetryDelay: "installRetryDelay",
    skipInstalled: "skipInstalled",
    forceReinstall: "forceReinstall",
    dryRun: "dryRun",
    allowMismatchedBinary: "allowMismatchedBinary",
    codeBin: "codeBin",
    cursorBin: "cursorBin",
  };

  for (const [cliKey, configKey] of Object.entries(cliMap)) {
    if (cliArgs[cliKey] !== undefined) {
      config[configKey] = cliArgs[cliKey];
    }
  }

  // Validate CLI config
  const result = ConfigSchema.partial().safeParse(config);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new ConfigError(
      `Invalid CLI configuration: ${errorDetails}`,
      undefined,
      "INVALID_CLI_CONFIG",
    );
  }

  return result.data;
}

/**
 * Load complete configuration with priority: CLI > ENV > FILE > DEFAULTS
 */
export async function loadConfig(
  cliOverrides: PartialConfig = {},
  configFilePath?: string,
): Promise<Config> {
  try {
    // 1. Start with defaults
    let config = { ...DEFAULT_CONFIG };

    // 2. Load file configuration
    let fileConfig: PartialConfig = {};
    const resolvedConfigPath = configFilePath || (await findConfigFile());

    if (resolvedConfigPath) {
      try {
        fileConfig = await loadConfigFile(resolvedConfigPath);
        config = { ...config, ...fileConfig };
      } catch (error) {
        if (configFilePath) {
          // If user explicitly specified config file, throw error
          throw error;
        }
        // If auto-discovered, warn but continue
        console.warn(
          `Warning: Could not load config file ${resolvedConfigPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 3. Load environment configuration
    try {
      const envConfig = loadEnvConfig();
      config = { ...config, ...envConfig };
    } catch (error) {
      throw new ConfigError(
        `Failed to load environment configuration: ${error instanceof Error ? error.message : String(error)}`,
        error as Error,
        "ENV_CONFIG_ERROR",
      );
    }

    // 4. Apply CLI overrides
    config = { ...config, ...cliOverrides };

    // 5. Final validation
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      const errorDetails = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new ConfigError(
        `Final configuration validation failed: ${errorDetails}`,
        undefined,
        "FINAL_VALIDATION_ERROR",
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
      error as Error,
      "GENERAL_CONFIG_ERROR",
    );
  }
}

/**
 * Create a sample configuration file
 */
export async function createSampleConfigFile(
  filePath: string,
  format: "json" | "yaml" = "json",
): Promise<void> {
  const sampleConfig = {
    // Output settings
    outputDir: "./downloads",
    cacheDir: undefined,

    // Download settings
    parallel: 3,
    retry: 2,
    retryDelay: 1000,

    // File handling
    skipExisting: false,
    overwrite: false,
    filenameTemplate: "{name}-{version}.vsix",

    // Output preferences
    quiet: false,
    json: false,

    // Source preferences
    source: "marketplace",
    preRelease: false,

    // Security
    checksum: false,

    // Editor preferences
    editor: "auto",
  };

  let content: string;
  if (format === "yaml") {
    content = yaml.stringify(sampleConfig, {
      lineWidth: 80,
    });
  } else {
    content = JSON.stringify(sampleConfig, null, 2);
  }

  await fs.outputFile(filePath, content);
}

/**
 * Get configuration info for debugging
 */
export function getConfigInfo(config: Config): {
  sources: string[];
  values: Record<string, unknown>;
} {
  return {
    sources: ["defaults", "file", "environment", "cli"],
    values: { ...config },
  };
}
