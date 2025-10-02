/**
 * Doctor Command - Health check and diagnostics
 * Comprehensive system health check with auto-fix capabilities
 */

import { BaseCommand } from "../base/BaseCommand";
import type { CommandResult, CommandHelp, GlobalOptions } from "../base/types";
import { CommandResultBuilder } from "../../core/output/CommandResultBuilder";
import { healthChecker } from "./healthChecker";
import { autoFixService } from "./autoFix";
import { ui, promptPolicy } from "../../core/ui";

/**
 * Doctor command options
 */
export interface DoctorOptions extends GlobalOptions {
  fix?: boolean;
}

/**
 * Doctor command implementation
 */
class DoctorCommand extends BaseCommand {
  async execute(_args: string[], options: GlobalOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("doctor");
    const context = this.createContext(options);
    const doctorOptions = options as DoctorOptions;

    ui.intro("🏥 VSIX Extension Manager Health Check");

    try {
      // Run health checks
      if (promptPolicy.isInteractive(options)) {
        ui.log.info("Running diagnostics...");
      }

      const report = await healthChecker.runChecks();

      // Display results in interactive mode
      if (promptPolicy.isInteractive(options)) {
        this.displayHealthReport(report);
      }

      // Auto-fix if requested
      if (doctorOptions.fix) {
        await this.applyFixes(report, options);
      }

      // Add checks to builder
      report.checks.forEach((check) => {
        const item = {
          id: check.name,
          name: check.name,
        };

        if (check.status === "pass") {
          builder.addSuccess(item);
        } else if (check.status === "warning") {
          builder.addSkipped(item);
          builder.addWarningItem({
            code: "CHECK_WARNING",
            message: check.message,
          });
        } else {
          builder.addFailure(item);
        }
      });

      return builder.setSummary(this.getSummaryMessage(report)).build();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (promptPolicy.isInteractive(options)) {
        ui.log.error(`Failed to run health check: ${message}`);
      }

      return CommandResultBuilder.fromError(
        "doctor",
        error instanceof Error ? error : new Error(message),
      );
    }
  }

  /**
   * Display health report
   */
  private displayHealthReport(report: import("./healthChecker").HealthReport): void {
    console.log(""); // Empty line

    // Display each check
    for (const check of report.checks) {
      const icon = this.getStatusIcon(check.status);
      const statusText = check.status.toUpperCase().padEnd(8);

      ui.log.message(`${icon} ${statusText} ${check.name}`);
      ui.log.message(`         ${check.message}`);

      if (check.details) {
        ui.log.message(`         ${check.details}`);
      }

      if (check.fixable) {
        ui.log.message(`         💡 Auto-fix available (use --fix)`);
      }

      console.log(""); // Empty line
    }

    // Display summary
    this.displaySummary(report);
  }

  /**
   * Display summary
   */
  private displaySummary(report: import("./healthChecker").HealthReport): void {
    const lines = [
      `✅ Passed: ${report.summary.passed}`,
      `⚠️  Warnings: ${report.summary.warnings}`,
      `❌ Failed: ${report.summary.failed}`,
    ];

    ui.note(lines.join("\n"), "Summary");

    // Show fix suggestion if there are fixable issues
    const fixableCount = report.checks.filter((c) => c.fixable).length;
    if (fixableCount > 0) {
      console.log(""); // Empty line
      ui.log.info(`💡 ${fixableCount} issue(s) can be auto-fixed`);
      ui.log.info(`   Run 'vsix doctor --fix' to apply fixes`);
    }

    // Overall status
    console.log(""); // Empty line
    if (report.overall === "pass") {
      ui.log.success("✓ Overall health: PASS");
    } else if (report.overall === "warning") {
      ui.log.warning("⚠ Overall health: WARNING");
    } else {
      ui.log.error("✗ Overall health: FAIL");
    }
  }

  /**
   * Apply auto-fixes
   */
  private async applyFixes(
    report: import("./healthChecker").HealthReport,
    options: GlobalOptions,
  ): Promise<void> {
    const fixableIssues = report.checks.filter((c) => c.fixable);

    if (fixableIssues.length === 0) {
      if (promptPolicy.isInteractive(options)) {
        ui.log.info("No fixable issues found");
      }
      return;
    }

    if (promptPolicy.isInteractive(options)) {
      console.log(""); // Empty line
      ui.log.info(`🔧 Applying ${fixableIssues.length} fix(es)...`);
      console.log(""); // Empty line
    }

    const results = await autoFixService.applyAllFixes(fixableIssues);

    // Display fix results
    if (promptPolicy.isInteractive(options)) {
      for (const [name, result] of results) {
        if (result.successful) {
          ui.log.success(`✓ ${name}: ${result.message}`);
        } else {
          ui.log.warning(`⚠ ${name}: ${result.message}`);
          if (result.details) {
            ui.log.message(`  ${result.details}`);
          }
        }
      }

      const successCount = Array.from(results.values()).filter((r) => r.successful).length;

      console.log(""); // Empty line
      ui.log.info(`Fixed ${successCount} of ${fixableIssues.length} issue(s)`);

      if (successCount < fixableIssues.length) {
        ui.log.info("Re-run 'vsix doctor' to verify remaining issues");
      }
    }
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: "pass" | "warning" | "fail"): string {
    switch (status) {
      case "pass":
        return "✅";
      case "warning":
        return "⚠️ ";
      case "fail":
        return "❌";
      default:
        return "❓";
    }
  }

  /**
   * Get summary message
   */
  private getSummaryMessage(report: import("./healthChecker").HealthReport): string {
    const { passed, warnings, failed } = report.summary;

    if (failed > 0) {
      return `Health check completed: ${passed} passed, ${warnings} warnings, ${failed} failed`;
    } else if (warnings > 0) {
      return `Health check completed: ${passed} passed, ${warnings} warnings`;
    } else {
      return `Health check completed: All ${passed} checks passed`;
    }
  }

  getHelp(): CommandHelp {
    return {
      name: "doctor",
      description: "Run health check and diagnostics",
      usage: "vsix doctor [options]",
      options: [
        {
          flag: "--fix",
          description: "Automatically fix issues when possible",
        },
        {
          flag: "--quiet",
          description: "Minimal output",
        },
        {
          flag: "--json",
          description: "Output in JSON format",
        },
      ],
      examples: ["vsix doctor", "vsix doctor --fix"],
    };
  }
}

/**
 * Export default instance for command registry
 */
export default new DoctorCommand();
