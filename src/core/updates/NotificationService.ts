/**
 * Non-intrusive notification service
 * Shows update notifications without blocking user workflow
 */

import type { UpdateInfo, UpdateCheckResult, CheckFrequency } from "./types";
import { ui } from "../ui";
import chalk from "chalk";

export class NotificationService {
  /**
   * Show update notification (non-blocking)
   */
  showUpdateNotification(result: UpdateCheckResult, quiet = false): void {
    if (quiet || result.updates.length === 0) {
      return;
    }

    const count = result.updates.length;
    const plural = count !== 1;

    console.log(""); // Empty line for spacing
    ui.log.info(
      chalk.cyan(
        `💡 ${count} extension update${plural ? "s" : ""} available`,
      ),
    );

    if (count <= 3) {
      // Show individual extensions for small counts
      for (const update of result.updates) {
        ui.log.info(
          chalk.gray(
            `   ${update.extensionId}: ${update.currentVersion} → ${update.latestVersion}`,
          ),
        );
      }
    }

    ui.log.info(chalk.gray(`   Run 'vsix update' to install updates`));
    console.log(""); // Empty line for spacing
  }

  /**
   * Show passive update hint (minimal, one-line)
   */
  showUpdateHint(count: number, quiet = false): void {
    if (quiet || count === 0) {
      return;
    }

    const plural = count !== 1;
    ui.log.info(
      chalk.gray(
        `💡 ${count} update${plural ? "s" : ""} available (run 'vsix update')`,
      ),
    );
  }

  /**
   * Show update check summary
   */
  showCheckSummary(result: UpdateCheckResult, frequency: CheckFrequency): void {
    const count = result.updates.length;
    const plural = count !== 1;

    if (count > 0) {
      ui.log.success(
        `Found ${count} extension${plural ? "s" : ""} with updates available`,
      );
    } else {
      ui.log.success("All extensions are up to date");
    }

    ui.log.info(
      chalk.gray(
        `Check frequency: ${frequency} (${this.formatNextCheck(result.nextCheck)})`,
      ),
    );
  }

  /**
   * Show detailed update list
   */
  showDetailedUpdates(updates: UpdateInfo[]): void {
    if (updates.length === 0) {
      return;
    }

    console.log(""); // Empty line
    ui.log.info(chalk.bold("Available Updates:"));
    console.log(""); // Empty line

    for (const update of updates) {
      ui.log.info(
        `${chalk.cyan("●")} ${chalk.bold(update.extensionId)}`,
      );
      ui.log.info(
        chalk.gray(
          `  ${update.currentVersion} → ${chalk.green(update.latestVersion)}`,
        ),
      );

      if (update.releaseNotes) {
        ui.log.info(chalk.gray(`  ${update.releaseNotes}`));
      }

      console.log(""); // Empty line between updates
    }
  }

  /**
   * Format next check time
   */
  private formatNextCheck(nextCheck: number): string {
    if (nextCheck === 0) return "disabled";

    const now = Date.now();
    const diff = nextCheck - now;

    if (diff <= 0) return "now";

    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (hours < 24) return `next check in ${hours}h`;
    return `next check in ${days}d`;
  }

  /**
   * Show update check error (non-intrusive)
   */
  showCheckError(error: Error, quiet = false): void {
    if (quiet) return;

    ui.log.warning(
      chalk.yellow(`Update check failed: ${error.message}`),
    );
  }
}

export const notificationService = new NotificationService();
