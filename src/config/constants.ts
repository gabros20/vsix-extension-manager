// Centralized configuration and constants for the CLI
// Re-export v2.0 configuration system (clean slate - no v1 compatibility)

// v2.0 Configuration (YAML-based with profiles)
export { ConfigLoaderV2, configLoaderV2, loadConfigV2 } from "./loaderV2";
export { ConfigV2Schema, DEFAULT_CONFIG_V2, CONFIG_V2_FILE_NAMES } from "./schemaV2";
export type { ConfigV2, PartialConfigV2 } from "./schemaV2";

// Legacy constants for backward compatibility
export const DEFAULT_OUTPUT_DIR = "./downloads";
export const DEFAULT_USER_AGENT = "vsix-extension-manager/1.5.0";

// Timeout Configuration
// Centralized timeout values for consistent behavior across the application
export const DEFAULT_HTTP_TIMEOUT_MS = 30000; // 30s - HTTP downloads
export const DEFAULT_EDITOR_CLI_TIMEOUT_MS = 30000; // 30s - Editor CLI operations (install/uninstall)
export const DEFAULT_EDITOR_VERIFICATION_TIMEOUT_MS = 15000; // 15s - Quick binary verification (--version check)
export const DEFAULT_EDITOR_LIST_TIMEOUT_MS = 10000; // 10s - Listing installed extensions

// UI and Progress
export const PROGRESS_UPDATE_INTERVAL_MS = 100; // Balance between smooth UX and CPU usage

// Bulk Operations
export const DEFAULT_BULK_PARALLEL = 3;
export const DEFAULT_BULK_RETRY = 2;
export const DEFAULT_BULK_RETRY_DELAY_MS = 1000; // Initial retry delay (exponential backoff applied)

// File System Operation Delays
export const FS_SETTLE_DELAY_MS = 500; // Wait for VS Code to finish file operations
export const FS_SETTLE_CHECK_DELAY_MS = 100; // Additional delay after temp file check

// Retry Delays
export const RETRY_DELAY_MS = 1000; // Standard retry delay for network operations
export const RETRY_DELAY_CONSERVATIVE_MS = 2000; // Conservative retry delay after errors
