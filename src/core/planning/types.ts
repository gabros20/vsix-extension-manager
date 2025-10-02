/**
 * Type definitions for the plan generation system
 * Plans show users what will happen before execution
 */

import type { EditorInfo } from "../../features/install";
import type { InputType } from "../../commands/add/inputDetector";
import type { SourceRegistry } from "../types";

/**
 * Extension information for planning
 */
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  source: SourceRegistry | "local";
  url?: string;
  filePath?: string;
  size?: number;
}

/**
 * Preflight check status
 */
export type CheckStatus = "pass" | "warning" | "fail";

/**
 * Preflight check result
 */
export interface PreflightCheck {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Plan execution step
 */
export interface PlanStep {
  id: string;
  description: string;
  estimatedDuration?: number; // milliseconds
  optional?: boolean;
}

/**
 * Safety configuration for the plan
 */
export interface SafetyConfig {
  checkCompatibility: boolean;
  createBackup: boolean;
  verifyChecksums: boolean;
  allowMismatch: boolean;
}

/**
 * Performance configuration for the plan
 */
export interface PerformanceConfig {
  parallel: number;
  timeout: number;
  retry: number;
  retryDelay: number;
}

/**
 * Complete installation plan
 */
export interface InstallPlan {
  input: {
    type: InputType;
    value: string;
  };
  extension: ExtensionInfo;
  target: EditorInfo;
  steps: PlanStep[];
  checks: PreflightCheck[];
  estimates: {
    downloadSize: number;
    downloadTime: number; // milliseconds
    installTime: number; // milliseconds
    totalTime: number; // milliseconds
  };
  safety: SafetyConfig;
  performance: PerformanceConfig;
  warnings: string[];
}

/**
 * Plan action options
 */
export type PlanAction = "confirm" | "customize" | "cancel";
