/**
 * Plan display utilities using Clack UI
 * Provides beautiful, informative plan previews before execution
 */

import { ui } from "../ui";
import type { InstallPlan, PlanAction, PreflightCheck } from "./types";
import { formatBytes } from "../ui/progress";

/**
 * Plan display service
 */
export class PlanDisplay {
  /**
   * Show full installation plan with confirmation
   */
  async showPlan(
    plan: InstallPlan,
    options: { allowCustomize?: boolean } = {},
  ): Promise<PlanAction> {
    ui.intro("📦 Installation Plan");

    // Show plan details
    const planMessage = this.formatPlan(plan);
    ui.log.message(planMessage);

    // Show warnings if any
    if (plan.warnings.length > 0) {
      ui.note(plan.warnings.map((w) => `⚠️  ${w}`).join("\n"), "Warnings");
    }

    // Get user action
    if (options.allowCustomize) {
      return await ui.select({
        message: "How would you like to proceed?",
        options: [
          { value: "confirm", label: "✓ Continue with installation" },
          { value: "customize", label: "⚙  Customize settings" },
          { value: "cancel", label: "✕ Cancel" },
        ],
      });
    }

    // Simple confirmation
    const confirmed = await ui.confirm("Continue with installation?", true);
    return confirmed ? "confirm" : "cancel";
  }

  /**
   * Format complete plan as readable text
   */
  private formatPlan(plan: InstallPlan): string {
    const sections: string[] = [];

    // Extension info
    sections.push(this.formatExtensionInfo(plan));

    // Target info
    sections.push(this.formatTargetInfo(plan));

    // Preflight checks
    sections.push(this.formatChecks(plan.checks));

    // Execution steps
    sections.push(this.formatSteps(plan));

    // Estimates
    sections.push(this.formatEstimates(plan));

    // Configuration
    sections.push(this.formatConfiguration(plan));

    return sections.join("\n\n");
  }

  /**
   * Format extension information
   */
  private formatExtensionInfo(plan: InstallPlan): string {
    const lines: string[] = ["📦 Extension"];

    lines.push(`   Name: ${plan.extension.name}`);
    lines.push(`   ID: ${plan.extension.id}`);
    lines.push(`   Version: ${plan.extension.version}`);
    lines.push(`   Source: ${this.formatSource(plan.extension.source)}`);

    if (plan.extension.url) {
      lines.push(`   URL: ${plan.extension.url}`);
    }

    if (plan.extension.size) {
      lines.push(`   Size: ${formatBytes(plan.extension.size)}`);
    }

    return lines.join("\n");
  }

  /**
   * Format target editor information
   */
  private formatTargetInfo(plan: InstallPlan): string {
    const lines: string[] = ["🎯 Target"];

    lines.push(`   Editor: ${plan.target.name === "cursor" ? "Cursor" : "VS Code"}`);

    if (plan.target.version) {
      lines.push(`   Version: ${plan.target.version}`);
    }

    lines.push(`   Binary: ${plan.target.binaryPath}`);
    lines.push(`   Extensions: ${plan.target.extensionsPath}`);

    return lines.join("\n");
  }

  /**
   * Format preflight checks
   */
  private formatChecks(checks: PreflightCheck[]): string {
    const lines: string[] = ["🔍 Preflight Checks"];

    for (const check of checks) {
      const icon = this.getCheckIcon(check.status);
      lines.push(`   ${icon} ${check.name}: ${check.message}`);
    }

    return lines.join("\n");
  }

  /**
   * Format execution steps
   */
  private formatSteps(plan: InstallPlan): string {
    const lines: string[] = ["📋 Steps"];

    plan.steps.forEach((step, index) => {
      const duration = step.estimatedDuration
        ? ` (~${Math.ceil(step.estimatedDuration / 1000)}s)`
        : "";
      const optional = step.optional ? " [optional]" : "";
      lines.push(`   ${index + 1}. ${step.description}${duration}${optional}`);
    });

    return lines.join("\n");
  }

  /**
   * Format time/size estimates
   */
  private formatEstimates(plan: InstallPlan): string {
    const lines: string[] = ["⏱️  Estimates"];

    if (plan.estimates.downloadSize > 0) {
      lines.push(`   Download: ${formatBytes(plan.estimates.downloadSize)}`);
    }

    if (plan.estimates.downloadTime > 0) {
      lines.push(`   Download time: ~${Math.ceil(plan.estimates.downloadTime / 1000)}s`);
    }

    if (plan.estimates.installTime > 0) {
      lines.push(`   Install time: ~${Math.ceil(plan.estimates.installTime / 1000)}s`);
    }

    lines.push(`   Total time: ~${Math.ceil(plan.estimates.totalTime / 1000)}s`);

    return lines.join("\n");
  }

  /**
   * Format configuration settings
   */
  private formatConfiguration(plan: InstallPlan): string {
    const lines: string[] = ["⚙️  Configuration"];

    // Safety
    const safety = [];
    if (plan.safety.checkCompatibility) safety.push("Compatibility check");
    if (plan.safety.createBackup) safety.push("Auto-backup");
    if (plan.safety.verifyChecksums) safety.push("Verify checksums");
    if (plan.safety.allowMismatch) safety.push("Allow binary mismatch");

    if (safety.length > 0) {
      lines.push(`   Safety: ${safety.join(", ")}`);
    }

    // Performance
    const perf = [];
    if (plan.performance.parallel > 1) perf.push(`${plan.performance.parallel}x parallel`);
    perf.push(`${plan.performance.timeout / 1000}s timeout`);
    perf.push(`${plan.performance.retry} retries`);

    lines.push(`   Performance: ${perf.join(", ")}`);

    return lines.join("\n");
  }

  /**
   * Show compact plan summary (for quick mode)
   */
  showCompactPlan(plan: InstallPlan): void {
    const parts = [
      `📦 ${plan.extension.name} v${plan.extension.version}`,
      `→ ${plan.target.name === "cursor" ? "Cursor" : "VS Code"}`,
      `(~${Math.ceil(plan.estimates.totalTime / 1000)}s)`,
    ];

    ui.log.info(parts.join(" "));

    // Show critical warnings only
    const criticalWarnings = plan.warnings.filter((w) => w.includes("fail") || w.includes("error"));
    if (criticalWarnings.length > 0) {
      ui.log.warning(criticalWarnings.join("; "));
    }
  }

  /**
   * Export plan as JSON
   */
  exportPlanAsJson(plan: InstallPlan): string {
    return JSON.stringify(plan, null, 2);
  }

  /**
   * Get icon for check status
   */
  private getCheckIcon(status: PreflightCheck["status"]): string {
    switch (status) {
      case "pass":
        return "✅";
      case "warning":
        return "⚠️";
      case "fail":
        return "❌";
      default:
        return "❓";
    }
  }

  /**
   * Format source registry name
   */
  private formatSource(source: string): string {
    switch (source) {
      case "marketplace":
        return "VS Code Marketplace";
      case "open-vsx":
        return "Open VSX Registry";
      case "local":
        return "Local File";
      default:
        return source;
    }
  }
}

/**
 * Singleton instance
 */
export const planDisplay = new PlanDisplay();
