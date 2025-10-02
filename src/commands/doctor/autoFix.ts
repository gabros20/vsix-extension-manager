/**
 * Auto-fix system for common health issues
 * Provides automated repairs for fixable problems
 */

import * as fs from "fs-extra";
import type { HealthCheck } from "./healthChecker";

export interface FixResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * Auto-fix service for health issues
 */
export class AutoFixService {
  /**
   * Apply fix for a health check issue
   */
  async applyFix(issue: HealthCheck): Promise<FixResult> {
    if (!issue.fixable || !issue.fixCommand) {
      return {
        success: false,
        message: "Issue cannot be automatically fixed",
      };
    }

    switch (issue.fixCommand) {
      case "create-dir":
        return await this.createDirectory(issue);

      case "clean-corrupted":
        return await this.cleanCorruptedExtensions(issue);

      case "fix-permissions":
        return await this.fixPermissions(issue);

      default:
        return {
          success: false,
          message: `Unknown fix command: ${issue.fixCommand}`,
        };
    }
  }

  /**
   * Create missing directory
   */
  private async createDirectory(issue: HealthCheck): Promise<FixResult> {
    if (!issue.details) {
      return {
        success: false,
        message: "No directory path provided",
      };
    }

    try {
      await fs.ensureDir(issue.details);
      return {
        success: true,
        message: `Created directory: ${issue.details}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to create directory",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clean corrupted extensions
   */
  private async cleanCorruptedExtensions(issue: HealthCheck): Promise<FixResult> {
    // This would require more context about which extensions are corrupted
    // For now, return a message that manual intervention is needed
    return {
      success: false,
      message: "Manual cleanup recommended",
      details:
        "Use 'vsix list' to identify extensions and 'vsix remove <id>' to uninstall corrupted ones",
    };
  }

  /**
   * Fix directory permissions
   */
  private async fixPermissions(issue: HealthCheck): Promise<FixResult> {
    if (!issue.details) {
      return {
        success: false,
        message: "No directory path provided",
      };
    }

    try {
      // This is platform-specific and may require sudo
      // For now, just inform the user
      return {
        success: false,
        message: "Permission fix requires manual intervention",
        details: `Run: chmod 755 ${issue.details}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to fix permissions",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Apply all fixable issues
   */
  async applyAllFixes(issues: HealthCheck[]): Promise<Map<string, FixResult>> {
    const results = new Map<string, FixResult>();

    const fixableIssues = issues.filter((issue) => issue.fixable);

    for (const issue of fixableIssues) {
      const result = await this.applyFix(issue);
      results.set(issue.name, result);
    }

    return results;
  }
}

/**
 * Singleton instance
 */
export const autoFixService = new AutoFixService();
