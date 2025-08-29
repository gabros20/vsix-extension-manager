// Centralized configuration and constants for the CLI

export const DEFAULT_OUTPUT_DIR = "./downloads";

// HTTP
export const DEFAULT_USER_AGENT = "vsix-extension-manager/1.5.0";
export const DEFAULT_HTTP_TIMEOUT_MS = 30000; // 30s

// Progress / UI
export const PROGRESS_UPDATE_INTERVAL_MS = 100; // throttle updates to avoid flicker

// Bulk defaults (used by helpers; commands may override)
export const DEFAULT_BULK_PARALLEL = 3;
export const DEFAULT_BULK_RETRY = 2;
export const DEFAULT_BULK_RETRY_DELAY_MS = 1000;
