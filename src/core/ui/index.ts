/**
 * UI utilities exports
 * Centralized export point for all UI-related functionality
 */

// Clack-based components
export { UIComponents, ui } from "./components";
export type { PlanAction, EditorSelection, MultiSelectResult } from "./components";

// Prompt policy
export { PromptPolicy, promptPolicy } from "./promptPolicy";
export type { PromptContext } from "./promptPolicy";

// Progress tracking (preserved from v1.x)
export {
  ProgressTracker,
  formatBytes,
  formatSpeed,
  formatDuration,
  createProgressBar,
} from "./progress";
export type { ProgressInfo, ProgressCallback } from "./progress";
