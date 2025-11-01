// Update feature exports

// Main orchestrator (primary entry point)
export {
  UpdateOrchestratorService,
  getUpdateOrchestratorService,
} from "./services/updateOrchestratorService";
export type {
  UpdateOptions,
  UpdateItemResult,
  UpdateSummary,
} from "./services/updateOrchestratorService";

// Specialized services (for advanced usage)
export { VersionCheckService, getVersionCheckService } from "./services/versionCheckService";
export type { VersionCheckRequest, VersionCheckResult } from "./services/versionCheckService";

export { UpdatePlanService, getUpdatePlanService } from "./services/updatePlanService";
export type { UpdatePlan, UpdatePlanOptions, UpdatePlanResult } from "./services/updatePlanService";

export { UpdateExecutorService, getUpdateExecutorService } from "./services/updateExecutorService";
export type {
  UpdateExecutionOptions,
  UpdateExecutionResult,
} from "./services/updateExecutorService";

// Legacy service (deprecated - use orchestrator instead)
export {
  UpdateInstalledService,
  getUpdateInstalledService,
} from "./services/updateInstalledService";
