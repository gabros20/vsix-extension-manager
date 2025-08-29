// Configuration schema and types for VSIX Extension Manager

import { z } from "zod";

/**
 * Configuration schema using Zod for validation
 */
export const ConfigSchema = z.object({
  // Output and caching
  outputDir: z.string().default("./downloads"),
  cacheDir: z.string().optional(),

  // Download behavior
  parallel: z.number().int().min(1).max(20).default(3),
  retry: z.number().int().min(0).max(10).default(2),
  retryDelay: z.number().int().min(0).max(30000).default(1000), // ms

  // File handling
  skipExisting: z.boolean().default(false),
  overwrite: z.boolean().default(false),
  filenameTemplate: z.string().default("{name}-{version}.vsix"),

  // Output formatting
  quiet: z.boolean().default(false),
  json: z.boolean().default(false),

  // Source preferences
  source: z.enum(["marketplace", "open-vsx", "auto"]).default("marketplace"),
  preRelease: z.boolean().default(false),

  // Security and verification
  checksum: z.boolean().default(false),

  // HTTP settings
  timeout: z.number().int().min(1000).max(300000).default(30000), // ms
  userAgent: z.string().default("vsix-extension-manager/1.5.0"),

  // UI settings
  progressUpdateInterval: z.number().int().min(50).max(5000).default(100), // ms

  // Workspace settings
  editor: z.enum(["vscode", "cursor", "auto"]).default("auto"),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Partial configuration for overrides
 */
export type PartialConfig = Partial<Config>;

/**
 * Environment variable mappings
 */
export const ENV_VAR_MAP = {
  VSIX_OUTPUT_DIR: "outputDir",
  VSIX_CACHE_DIR: "cacheDir",
  VSIX_PARALLEL: "parallel",
  VSIX_RETRY: "retry",
  VSIX_RETRY_DELAY: "retryDelay",
  VSIX_SKIP_EXISTING: "skipExisting",
  VSIX_OVERWRITE: "overwrite",
  VSIX_FILENAME_TEMPLATE: "filenameTemplate",
  VSIX_QUIET: "quiet",
  VSIX_JSON: "json",
  VSIX_SOURCE: "source",
  VSIX_PRE_RELEASE: "preRelease",
  VSIX_CHECKSUM: "checksum",
  VSIX_TIMEOUT: "timeout",
  VSIX_USER_AGENT: "userAgent",
  VSIX_PROGRESS_INTERVAL: "progressUpdateInterval",
  VSIX_EDITOR: "editor",
} as const;

/**
 * Configuration file names to search for
 */
export const CONFIG_FILE_NAMES = [
  ".vsixrc",
  ".vsixrc.json",
  ".vsixrc.yaml",
  ".vsixrc.yml",
  "vsix.config.json",
  "vsix.config.yaml",
  "vsix.config.yml",
] as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
