/**
 * Update Plan Service
 * Creates and validates update plans
 */

import { getInstalledExtensions } from "../../export";
import { getVersionCheckService, type VersionCheckResult } from "./versionCheckService";

export interface UpdatePlan {
  id: string;
  currentVersion: string;
  targetVersion: string;
}

export interface UpdatePlanOptions {
  editor: "vscode" | "cursor";
  selectedExtensions?: string[];
  preRelease?: boolean;
  source?: "marketplace" | "open-vsx" | "auto";
  retry?: number;
  retryDelay?: number;
  onProgress?: (completed: number, total: number, extensionId?: string) => void;
}

export interface UpdatePlanResult {
  plans: UpdatePlan[];
  upToDate: VersionCheckResult[];
  failed: VersionCheckResult[];
  totalScanned: number;
}

/**
 * Service for creating update plans
 */
export class UpdatePlanService {
  private versionCheckService = getVersionCheckService();

  /**
   * Create update plan for installed extensions
   */
  async createUpdatePlan(options: UpdatePlanOptions): Promise<UpdatePlanResult> {
    // Get installed extensions
    const installed = await getInstalledExtensions(options.editor);

    // Filter to selected extensions if specified
    const extensionsToCheck = options.selectedExtensions
      ? installed.filter((ext) => options.selectedExtensions!.includes(ext.id))
      : installed;

    // Deduplicate by ID (keep newer version)
    const deduplicated = this.deduplicateExtensions(extensionsToCheck);

    if (deduplicated.length === 0) {
      return {
        plans: [],
        upToDate: [],
        failed: [],
        totalScanned: 0,
      };
    }

    // Check versions in parallel
    const versionChecks = deduplicated.map((ext) => ({
      id: ext.id,
      currentVersion: ext.version,
      preRelease: options.preRelease || false,
      source: options.source || "auto",
    }));

    const results = await this.versionCheckService.checkVersions(versionChecks, {
      retry: options.retry,
      retryDelay: options.retryDelay,
      onProgress: options.onProgress,
    });

    // Separate into categories
    const plans: UpdatePlan[] = [];
    const upToDate: VersionCheckResult[] = [];
    const failed: VersionCheckResult[] = [];

    for (const result of results) {
      if (result.error) {
        failed.push(result);
      } else if (result.needsUpdate && result.latestVersion) {
        plans.push({
          id: result.id,
          currentVersion: result.currentVersion,
          targetVersion: result.latestVersion,
        });
      } else {
        upToDate.push(result);
      }
    }

    // Validate plan
    this.validatePlan(plans);

    return {
      plans,
      upToDate,
      failed,
      totalScanned: deduplicated.length,
    };
  }

  /**
   * Deduplicate extensions by ID, keeping the one with newer version
   */
  private deduplicateExtensions(
    extensions: Array<{ id: string; version: string; displayName?: string }>,
  ): Array<{ id: string; version: string; displayName?: string }> {
    const extensionMap = new Map<string, { id: string; version: string; displayName?: string }>();

    for (const ext of extensions) {
      const existing = extensionMap.get(ext.id);
      if (!existing) {
        extensionMap.set(ext.id, ext);
      } else {
        // Keep the extension with the newer version (simple string comparison for now)
        if (ext.version > existing.version) {
          extensionMap.set(ext.id, ext);
        }
      }
    }

    return Array.from(extensionMap.values());
  }

  /**
   * Validate update plan
   */
  private validatePlan(plans: UpdatePlan[]): void {
    if (plans.length === 0) {
      return;
    }

    // Validate extension ID formats
    const invalidIds = plans.filter(
      (p) => !/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-.]*$/.test(p.id),
    );
    if (invalidIds.length > 0) {
      throw new Error(`Invalid extension IDs: ${invalidIds.map((p) => p.id).join(", ")}`);
    }

    // Validate version formats
    const invalidVersions = plans.filter((p) => !p.targetVersion || p.targetVersion.trim() === "");
    if (invalidVersions.length > 0) {
      throw new Error(`Missing target versions: ${invalidVersions.map((p) => p.id).join(", ")}`);
    }
  }
}

// Global instance
let globalUpdatePlanService: UpdatePlanService | null = null;

export function getUpdatePlanService(): UpdatePlanService {
  if (!globalUpdatePlanService) {
    globalUpdatePlanService = new UpdatePlanService();
  }
  return globalUpdatePlanService;
}
