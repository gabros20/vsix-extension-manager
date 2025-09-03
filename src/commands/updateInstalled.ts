import * as p from "@clack/prompts";
import { formatBytes, createProgressBar, type ProgressInfo } from "../core/ui/progress";
import { shouldUpdateProgress, truncateMiddle } from "../core/helpers";
import { getUpdateInstalledService } from "../features/update";
import { getEditorService } from "../features/install";
import { getInstalledExtensions } from "../features/export";

interface UpdateInstalledOptions {
  editor?: string;
  preRelease?: boolean;
  source?: string;
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;
  quiet?: boolean;
  json?: boolean;
  dryRun?: boolean;
  summary?: string;
  codeBin?: string;
  cursorBin?: string;
  allowMismatchedBinary?: boolean;
}

export async function updateInstalled(options: UpdateInstalledOptions) {
  console.clear();
  p.intro("⬆️  Update Installed Extensions");

  try {
    const quiet = Boolean(options.quiet);
    const json = Boolean(options.json);
    const service = getUpdateInstalledService();
    const spinner = p.spinner();

    // Interactive editor selection (like quick install)
    const editorService = getEditorService();
    const availableEditors = editorService.getAvailableEditors();
    let chosenEditor = (options.editor as "vscode" | "cursor" | "auto" | undefined) || "auto";

    if (chosenEditor === "auto") {
      if (availableEditors.length === 0) {
        throw new Error("No editors found. Please install VS Code or Cursor.");
      }
      if (availableEditors.length === 1) {
        const detected = availableEditors[0];
        if (!quiet && !json) {
          p.log.info(`🔍 Auto-detected ${detected.displayName} at ${detected.binaryPath}`);
        }
        chosenEditor = detected.name;
      } else if (quiet || json) {
        const cursor = availableEditors.find((e) => e.name === "cursor");
        chosenEditor = (cursor || availableEditors[0]).name;
      } else {
        const result = await p.select({
          message: "Multiple editors found. Select target editor:",
          options: availableEditors.map((editor) => ({
            value: editor.name,
            label: `${editor.displayName} (${editor.binaryPath})`,
          })),
        });
        if (p.isCancel(result)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
        chosenEditor = result as "vscode" | "cursor";
      }
    }
    options.editor = chosenEditor;

    // Interactive mode: Ask for update mode (all vs selected)
    let selectedExtensions: string[] | undefined;
    if (!quiet && !json) {
      const updateMode = await p.select({
        message: "Choose update mode:",
        options: [
          {
            value: "all",
            label: "Update all extensions",
            hint: "Update all installed extensions to latest",
          },
          {
            value: "selected",
            label: "Update selected extensions",
            hint: "Choose which extensions to update",
          },
        ],
      });

      if (p.isCancel(updateMode)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }

      if (updateMode === "selected") {
        // Get installed extensions for selection
        const installed = await getInstalledExtensions(chosenEditor);
        if (installed.length === 0) {
          p.log.warn("⚠️ No extensions found to update");
          return;
        }

        // Check which extensions have updates available
        spinner.start("Checking for available updates...");
        const { resolveVersion } = await import("../core/registry");
        const sourcePref = (options.source as "marketplace" | "open-vsx" | "auto") || "auto";
        const preRelease = Boolean(options.preRelease);
        const retry = Number(options.retry ?? 2);
        const retryDelay = Number(options.retryDelay ?? 1000);

        const extensionsWithUpdates = [];
        const extensionsUpToDate = [];
        let extensionsFailed = 0;

        for (const ext of installed) {
          try {
            // Use retry logic for version resolution
            const latest = await withRetry(
              async () => resolveVersion(ext.id, "latest", preRelease, sourcePref),
              retry,
              retryDelay,
            );
            const hasUpdate = latest && isVersionNewer(latest, ext.version);

            if (hasUpdate) {
              extensionsWithUpdates.push({
                value: ext.id,
                label: `${ext.displayName || ext.id} (v${ext.version} → v${latest} ⬆️)`,
              });
            } else {
              extensionsUpToDate.push({
                id: ext.id,
                name: ext.displayName || ext.id,
                version: ext.version,
              });
            }
          } catch {
            // Count failed version checks
            extensionsFailed++;
          }
        }

        spinner.stop("Version check completed");

        // Show summary of what was found
        if (extensionsWithUpdates.length === 0) {
          p.log.info("✅ All extensions are already up-to-date!");
          if (extensionsFailed > 0) {
            p.log.warn(`⚠️ ${extensionsFailed} extension(s) had version check failures`);
          }
          return;
        }

        // Show summary before selection
        p.note(
          `Extensions with updates: ${extensionsWithUpdates.length}\nUp-to-date: ${extensionsUpToDate.length}${extensionsFailed > 0 ? `\nVersion check failed: ${extensionsFailed}` : ""}`,
          "Update Status",
        );

        const extensionChoices = await p.multiselect({
          message: `Select extensions to update (${extensionsWithUpdates.length} available):`,
          options: extensionsWithUpdates,
          required: false,
        });

        if (p.isCancel(extensionChoices)) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }

        selectedExtensions = extensionChoices as string[];
        if (selectedExtensions.length === 0) {
          p.log.info("No extensions selected for update.");
          return;
        }
      }
    }

    let lastUpdateMap: Record<string, number> = {};
    if (!quiet) spinner.start("Preparing update plan...");

    const summary = await service.updateInstalled(
      {
        editor: (options.editor as "vscode" | "cursor" | "auto") || "auto",
        preRelease: options.preRelease,
        source: (options.source as "marketplace" | "open-vsx" | "auto") || "auto",
        parallel: options.parallel,
        retry: options.retry,
        retryDelay: options.retryDelay,
        quiet,
        json,
        dryRun: options.dryRun,
        summary: options.summary,
        codeBin: options.codeBin,
        cursorBin: options.cursorBin,
        allowMismatchedBinary: options.allowMismatchedBinary,
        selectedExtensions,
      },
      (message) => {
        if (!quiet) spinner.message(message);
      },
      (id: string, progress: ProgressInfo) => {
        if (quiet) return;
        const now = Date.now();
        const last = lastUpdateMap[id] || 0;
        if (!shouldUpdateProgress(last, now)) return;
        const bar = createProgressBar(progress.percentage, 20);
        spinner.message(
          `${truncateMiddle(id, 42)}  ${bar} ${formatBytes(progress.downloaded)}/${formatBytes(progress.total)}`,
        );
        lastUpdateMap[id] = now;
      },
    );

    if (!quiet) spinner.stop("Update process finished");

    const summaryLines = [
      `Detected: ${summary.totalDetected}`,
      `Up-to-date: ${summary.upToDate}`,
      `To update: ${summary.toUpdate}`,
      `Updated: ${summary.updated}`,
      `Skipped: ${summary.skipped}`,
      `Failed: ${summary.failed}`,
      `Duration: ${Math.round(summary.elapsedMs / 1000)}s`,
    ].join("\n");

    if (json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    p.note(summaryLines, "Update Summary");

    const failed = summary.items.filter((i) => i.status === "failed");
    if (failed.length > 0 && !quiet) {
      p.log.error("❌ Failed updates:");
      failed.forEach((i) => p.log.error(`  • ${i.id}: ${i.error || "Unknown error"}`));
    }

    if (!quiet) {
      if (summary.updated === 0 && summary.failed === 0) {
        p.outro("✅ All extensions are already up-to-date!");
      } else if (summary.updated > 0) {
        p.outro(`✨ Update completed! ${summary.updated} extension(s) updated.`);
      } else {
        p.outro("⚠️ Update completed with issues. Check failed updates above.");
      }
    }
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Retry helper function
 */
async function withRetry<T>(fn: () => Promise<T>, retry: number, delayMs: number): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retry) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Compare versions semantically - returns true if newVersion > currentVersion
 */
function isVersionNewer(newVersion: string, currentVersion: string): boolean {
  // If versions are identical, no update needed
  if (newVersion === currentVersion) {
    return false;
  }

  // Parse semantic versions
  const parseVersion = (v: string) => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) return null;
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4] || null,
    };
  };

  const newParsed = parseVersion(newVersion);
  const currentParsed = parseVersion(currentVersion);

  // If either version can't be parsed, fall back to string comparison
  if (!newParsed || !currentParsed) {
    return newVersion !== currentVersion;
  }

  // Compare major.minor.patch
  if (newParsed.major !== currentParsed.major) {
    return newParsed.major > currentParsed.major;
  }
  if (newParsed.minor !== currentParsed.minor) {
    return newParsed.minor > currentParsed.minor;
  }
  if (newParsed.patch !== currentParsed.patch) {
    return newParsed.patch > currentParsed.patch;
  }

  // Same major.minor.patch - check prerelease
  // Stable (no prerelease) > prerelease
  if (!newParsed.prerelease && currentParsed.prerelease) {
    return true; // new stable > current prerelease
  }
  if (newParsed.prerelease && !currentParsed.prerelease) {
    return false; // new prerelease < current stable
  }

  // Both prerelease or both stable - compare prerelease strings
  if (newParsed.prerelease && currentParsed.prerelease) {
    return newParsed.prerelease > currentParsed.prerelease;
  }

  // Same version
  return false;
}

export async function runUpdateInstalledUI(options: UpdateInstalledOptions) {
  await updateInstalled(options);
}
