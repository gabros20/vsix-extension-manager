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

  // Install settings
  installParallel: z.number().int().min(1).max(20).default(1),
  installRetry: z.number().int().min(0).max(10).default(2),
  installRetryDelay: z.number().int().min(0).max(30000).default(1000), // ms
  skipInstalled: z.boolean().default(false),
  forceReinstall: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  allowMismatchedBinary: z.boolean().default(false),

  // Editor binary paths
  codeBin: z.string().optional(),
  cursorBin: z.string().optional(),
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

  // Install settings
  VSIX_INSTALL_PARALLEL: "installParallel",
  VSIX_INSTALL_RETRY: "installRetry",
  VSIX_INSTALL_RETRY_DELAY: "installRetryDelay",
  VSIX_SKIP_INSTALLED: "skipInstalled",
  VSIX_FORCE_REINSTALL: "forceReinstall",
  VSIX_DRY_RUN: "dryRun",
  VSIX_ALLOW_MISMATCHED_BINARY: "allowMismatchedBinary",

  // Editor binary paths
  VSIX_CODE_BIN: "codeBin",
  VSIX_CURSOR_BIN: "cursorBin",
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
