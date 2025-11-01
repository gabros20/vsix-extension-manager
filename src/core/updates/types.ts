/**
 * Update checker type definitions
 */

export interface UpdateInfo {
  extensionId: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseDate?: string;
  releaseNotes?: string;
  source: "marketplace" | "open-vsx";
}

export interface UpdateCheckResult {
  updates: UpdateInfo[];
  lastCheck: number;
  nextCheck: number;
  duration: number;
}

export interface UpdateCache {
  lastCheck: number;
  updates: UpdateInfo[];
  frequency: CheckFrequency;
}

export type CheckFrequency = "never" | "daily" | "weekly" | "always";

export interface UpdateCheckerOptions {
  force?: boolean;
  quiet?: boolean;
  editor?: string;
}
