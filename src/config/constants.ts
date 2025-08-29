// Centralized configuration and constants for the CLI
// Re-export configuration system

export { loadConfig, convertCliToConfig, createSampleConfigFile, ConfigError } from "./loader";
export { ConfigSchema, DEFAULT_CONFIG, ENV_VAR_MAP, CONFIG_FILE_NAMES } from "./schema";
export type { Config, PartialConfig } from "./schema";

// Legacy constants for backward compatibility
export const DEFAULT_OUTPUT_DIR = "./downloads";
export const DEFAULT_USER_AGENT = "vsix-extension-manager/1.5.0";
export const DEFAULT_HTTP_TIMEOUT_MS = 30000; // 30s
export const PROGRESS_UPDATE_INTERVAL_MS = 100; // throttle updates to avoid flicker
export const DEFAULT_BULK_PARALLEL = 3;
export const DEFAULT_BULK_RETRY = 2;
export const DEFAULT_BULK_RETRY_DELAY_MS = 1000;
