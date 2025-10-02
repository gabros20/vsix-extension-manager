/**
 * Configuration Schema v2.0
 * Enhanced YAML-based configuration with profiles and better organization
 */

import { z } from "zod";

/**
 * Editor configuration
 */
const EditorConfigSchema = z.object({
  prefer: z.enum(["cursor", "vscode", "auto"]).default("auto"),
  "cursor-binary": z.string().optional(),
  "vscode-binary": z.string().optional(),
});

/**
 * Safety features configuration
 */
const SafetyConfigSchema = z.object({
  "check-compatibility": z.boolean().default(true),
  "auto-backup": z.boolean().default(true),
  "verify-checksums": z.boolean().default(true),
  "allow-mismatch": z.boolean().default(false),
});

/**
 * Performance configuration
 */
const PerformanceConfigSchema = z.object({
  "parallel-downloads": z.number().int().min(1).max(10).default(3),
  "parallel-installs": z.number().int().min(1).max(5).default(1),
  timeout: z.number().int().min(5000).default(30000),
  retry: z.number().int().min(0).max(5).default(2),
  "retry-delay": z.number().int().min(100).default(1000),
});

/**
 * Behavior configuration
 */
const BehaviorConfigSchema = z.object({
  "skip-installed": z.enum(["ask", "always", "never"]).default("ask"),
  "update-check": z.enum(["never", "daily", "weekly", "always"]).default("weekly"),
  "auto-retry": z.boolean().default(true),
  "download-dir": z.string().default("./downloads"),
  "cache-dir": z.string().optional(),
});

/**
 * Network configuration
 */
const NetworkConfigSchema = z.object({
  source: z.enum(["marketplace", "open-vsx", "auto"]).default("auto"),
  "user-agent": z.string().optional(),
  proxy: z.string().optional(),
});

/**
 * Output configuration
 */
const OutputConfigSchema = z.object({
  format: z.enum(["auto", "json", "table", "quiet"]).default("auto"),
  colors: z.boolean().default(true),
  "show-progress": z.boolean().default(true),
});

/**
 * Complete configuration schema v2
 */
// Profile schema (without version and profiles to avoid recursion)
const ProfileSchema = z.object({
  editor: EditorConfigSchema.partial().optional(),
  safety: SafetyConfigSchema.partial().optional(),
  performance: PerformanceConfigSchema.partial().optional(),
  behavior: BehaviorConfigSchema.partial().optional(),
  network: NetworkConfigSchema.partial().optional(),
  output: OutputConfigSchema.partial().optional(),
});

export const ConfigV2Schema = z.object({
  version: z.literal("2.0").default("2.0"),
  editor: EditorConfigSchema,
  safety: SafetyConfigSchema,
  performance: PerformanceConfigSchema,
  behavior: BehaviorConfigSchema,
  network: NetworkConfigSchema.optional(),
  output: OutputConfigSchema.optional(),
  "active-profile": z.string().optional(),
  profiles: z.record(z.string(), ProfileSchema).optional(),
});

/**
 * Type inference
 */
export type ConfigV2 = z.infer<typeof ConfigV2Schema>;

// Deep partial for recursive config types
export type PartialConfigV2 = {
  version?: "2.0";
  editor?: Partial<z.infer<typeof EditorConfigSchema>>;
  safety?: Partial<z.infer<typeof SafetyConfigSchema>>;
  performance?: Partial<z.infer<typeof PerformanceConfigSchema>>;
  behavior?: Partial<z.infer<typeof BehaviorConfigSchema>>;
  network?: Partial<z.infer<typeof NetworkConfigSchema>>;
  output?: Partial<z.infer<typeof OutputConfigSchema>>;
  "active-profile"?: string;
  profiles?: Record<string, Profile>;
};

export type EditorConfig = z.infer<typeof EditorConfigSchema>;
export type SafetyConfig = z.infer<typeof SafetyConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type BehaviorConfig = z.infer<typeof BehaviorConfigSchema>;
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG_V2: ConfigV2 = {
  version: "2.0",
  editor: {
    prefer: "auto",
  },
  safety: {
    "check-compatibility": true,
    "auto-backup": true,
    "verify-checksums": true,
    "allow-mismatch": false,
  },
  performance: {
    "parallel-downloads": 3,
    "parallel-installs": 1,
    timeout: 30000,
    retry: 2,
    "retry-delay": 1000,
  },
  behavior: {
    "skip-installed": "ask",
    "update-check": "weekly",
    "auto-retry": true,
    "download-dir": "./downloads",
  },
  network: {
    source: "auto",
  },
  output: {
    format: "auto",
    colors: true,
    "show-progress": true,
  },
};

/**
 * Configuration file names (in search order)
 */
export const CONFIG_V2_FILE_NAMES = [
  ".vsix.yml",
  ".vsix.yaml",
  "vsix.config.yml",
  "vsix.config.yaml",
  ".vsixrc", // Legacy JSON format
  ".vsixrc.json",
];

/**
 * Configuration search paths
 */
export function getConfigSearchPaths(): string[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
  return [
    process.cwd(),
    `${homeDir}/.vsix`,
    `${homeDir}/.config/vsix-extension-manager`,
    homeDir,
  ];
}

/**
 * Environment variable mappings for v2
 */
export const ENV_VAR_MAP_V2: Record<string, string> = {
  VSIX_EDITOR: "editor.prefer",
  VSIX_CURSOR_BIN: "editor.cursor-binary",
  VSIX_VSCODE_BIN: "editor.vscode-binary",
  VSIX_CODE_BIN: "editor.vscode-binary",
  VSIX_CHECK_COMPAT: "safety.check-compatibility",
  VSIX_AUTO_BACKUP: "safety.auto-backup",
  VSIX_VERIFY_CHECKSUM: "safety.verify-checksums",
  VSIX_ALLOW_MISMATCH: "safety.allow-mismatch",
  VSIX_PARALLEL_DOWNLOADS: "performance.parallel-downloads",
  VSIX_PARALLEL_INSTALLS: "performance.parallel-installs",
  VSIX_TIMEOUT: "performance.timeout",
  VSIX_RETRY: "performance.retry",
  VSIX_RETRY_DELAY: "performance.retry-delay",
  VSIX_SKIP_INSTALLED: "behavior.skip-installed",
  VSIX_UPDATE_CHECK: "behavior.update-check",
  VSIX_AUTO_RETRY: "behavior.auto-retry",
  VSIX_DOWNLOAD_DIR: "behavior.download-dir",
  VSIX_CACHE_DIR: "behavior.cache-dir",
  VSIX_SOURCE: "network.source",
  VSIX_PROXY: "network.proxy",
  VSIX_FORMAT: "output.format",
  VSIX_COLORS: "output.colors",
  VSIX_PROFILE: "active-profile",
};

/**
 * Sample configuration file content
 */
export const SAMPLE_CONFIG_V2 = `# VSIX Extension Manager v2.0 Configuration
# See: https://github.com/username/vsix-extension-manager/docs/configuration

version: "2.0"

# Editor preferences
editor:
  prefer: auto # auto | cursor | vscode
  # cursor-binary: /path/to/cursor
  # vscode-binary: /path/to/code

# Safety features (recommended)
safety:
  check-compatibility: true
  auto-backup: true
  verify-checksums: true
  allow-mismatch: false

# Performance tuning
performance:
  parallel-downloads: 3 # 1-10
  parallel-installs: 1 # 1-5
  timeout: 30000 # milliseconds
  retry: 2 # attempts
  retry-delay: 1000 # milliseconds

# Behavior preferences
behavior:
  skip-installed: ask # ask | always | never
  update-check: weekly # never | daily | weekly | always
  auto-retry: true
  download-dir: ./downloads
  # cache-dir: ~/.vsix/cache

# Network settings (optional)
# network:
#   source: auto # auto | marketplace | open-vsx
#   proxy: http://proxy:8080

# Output preferences (optional)
# output:
#   format: auto # auto | json | table | quiet
#   colors: true
#   show-progress: true

# Active profile (optional)
# active-profile: production

# Configuration profiles (optional)
# profiles:
#   production:
#     safety:
#       check-compatibility: true
#     performance:
#       parallel-installs: 1
#   
#   development:
#     safety:
#       check-compatibility: false
#     performance:
#       parallel-installs: 3
#   
#   ci:
#     output:
#       format: json
#       show-progress: false
#     behavior:
#       skip-installed: always
`;
