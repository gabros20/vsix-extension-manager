import { getEditorService, getInstallService } from "../../install";
import { getInstalledExtensions } from "../../export";
import type { EditorType } from "../../../core/types";
import * as fs from "fs-extra";
import * as path from "path";

export interface UninstallOptions {
  editor?: EditorType;
  codeBin?: string;
  cursorBin?: string;
  allowMismatchedBinary?: boolean;
  selectedExtensions?: string[]; // Specific extension IDs to uninstall
  uninstallAll?: boolean; // Flag to uninstall all extensions
  parallel?: number;
  retry?: number;
  retryDelay?: number;
  quiet?: boolean;
  json?: boolean;
  dryRun?: boolean;
}

export interface UninstallTaskResult {
  extensionId: string;
  success: boolean;
  error?: string;
  elapsedMs: number;
}

export interface UninstallSummary {
  totalExtensions: number;
  uninstalled: number;
  failed: number;
  results: UninstallTaskResult[];
  elapsedMs: number;
}

/**
 * Service for uninstalling extensions from editors
 */
export class UninstallExtensionsService {
  private editorService = getEditorService();
  private installService = getInstallService();

  /**
   * Uninstall extensions based on provided options
   */
  async uninstallExtensions(
    options: UninstallOptions = {},
    progressCallback?: (message: string) => void,
  ): Promise<UninstallSummary> {
    const startTime = Date.now();
    const editorPref = options.editor || "auto";
    const retry = Number(options.retry ?? 2);
    const retryDelay = Number(options.retryDelay ?? 1000);
    const parallel = Math.max(1, Number(options.parallel ?? 1));
    const quiet = Boolean(options.quiet);
    const dryRun = Boolean(options.dryRun);

    const summary: UninstallSummary = {
      totalExtensions: 0,
      uninstalled: 0,
      failed: 0,
      results: [],
      elapsedMs: 0,
    };

    // Detect editor and resolve binary
    const available = await this.editorService.getAvailableEditors();
    if (available.length === 0) {
      throw new Error("No editors found. Please install VS Code or Cursor.");
    }

    const chosenEditor =
      editorPref === "auto"
        ? (available.find((e) => e.name === "cursor") || available[0]).name
        : editorPref;
    const explicitBin = chosenEditor === "vscode" ? options.codeBin : options.cursorBin;
    const binPath = await this.editorService.resolveEditorBinary(
      chosenEditor,
      explicitBin,
      Boolean(options.allowMismatchedBinary),
    );

    // Get installed extensions
    progressCallback?.("Scanning installed extensions...");
    const installed = await getInstalledExtensions(chosenEditor);

    if (installed.length === 0) {
      summary.elapsedMs = Date.now() - startTime;
      return summary;
    }

    // Determine which extensions to uninstall
    let extensionsToUninstall = installed;
    if (options.selectedExtensions && options.selectedExtensions.length > 0) {
      extensionsToUninstall = installed.filter((ext) =>
        options.selectedExtensions!.includes(ext.id),
      );
    }

    summary.totalExtensions = extensionsToUninstall.length;

    if (extensionsToUninstall.length === 0) {
      summary.elapsedMs = Date.now() - startTime;
      return summary;
    }

    // Uninstall extensions with bounded concurrency
    progressCallback?.("Uninstalling extensions...");
    const results: UninstallTaskResult[] = [];

    if (parallel <= 1) {
      // Sequential processing
      for (const ext of extensionsToUninstall) {
        const result = await this.uninstallSingleExtension(binPath, ext.id, {
          retry,
          retryDelay,
          dryRun,
        });
        results.push(result);

        if (result.success) {
          summary.uninstalled++;
        } else {
          summary.failed++;
        }

        if (!quiet) {
          const status = result.success ? "Uninstalled" : "Failed";
          progressCallback?.(`${status}: ${ext.id}`);
        }
      }
    } else {
      // Parallel processing with concurrency limit
      let index = 0;
      const workers: Promise<void>[] = [];

      for (let w = 0; w < parallel; w++) {
        workers.push(
          (async () => {
            while (true) {
              const currentIndex = index++;
              if (currentIndex >= extensionsToUninstall.length) break;

              const ext = extensionsToUninstall[currentIndex];
              const result = await this.uninstallSingleExtension(binPath, ext.id, {
                retry,
                retryDelay,
                dryRun,
              });
              results.push(result);

              if (result.success) {
                summary.uninstalled++;
              } else {
                summary.failed++;
              }

              if (!quiet) {
                const status = result.success ? "Uninstalled" : "Failed";
                progressCallback?.(`${status}: ${ext.id}`);
              }
            }
          })(),
        );
      }

      await Promise.all(workers);
    }

    summary.results = results;
    summary.elapsedMs = Date.now() - startTime;

    return summary;
  }

  /**
   * Uninstall a single extension with retry logic
   */
  private async uninstallSingleExtension(
    binaryPath: string,
    extensionId: string,
    options: { retry: number; retryDelay: number; dryRun: boolean },
  ): Promise<UninstallTaskResult> {
    const startTime = Date.now();

    if (options.dryRun) {
      return {
        extensionId,
        success: true,
        elapsedMs: Date.now() - startTime,
      };
    }

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= options.retry; attempt++) {
      try {
        const result = await this.editorService.uninstallExtension(binaryPath, extensionId);

        // If CLI reports failure, verify if extension is actually gone
        if (!result.success) {
          try {
            const isStillInstalled = await this.installService.isExtensionInstalled(
              binaryPath,
              extensionId,
            );
            if (!isStillInstalled.installed) {
              // Extension was actually uninstalled despite CLI failure
              return {
                extensionId,
                success: true,
                elapsedMs: Date.now() - startTime,
              };
            }
          } catch {
            // Verification failed, stick with original result
          }
        }

        // If CLI uninstall succeeded, perform additional cleanup
        if (result.success) {
          await this.performPostUninstallCleanup(binaryPath, extensionId);
        }

        return {
          extensionId,
          success: result.success,
          error: result.success ? undefined : result.error || result.stderr || "Unknown error",
          elapsedMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < options.retry) {
          // Wait before retry with exponential backoff
          await this.delay(options.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // All retries failed
    return {
      extensionId,
      success: false,
      error: lastError,
      elapsedMs: Date.now() - startTime,
    };
  }

  /**
   * Perform post-uninstall cleanup for complete removal
   */
  private async performPostUninstallCleanup(
    binaryPath: string,
    extensionId: string,
  ): Promise<void> {
    try {
      // Determine editor type from binary path
      const isCursor = binaryPath.toLowerCase().includes("cursor");
      const extensionsDir = isCursor
        ? path.join(process.env.HOME || "~", ".cursor", "extensions")
        : path.join(process.env.HOME || "~", ".vscode", "extensions");

      // Ensure extensions directory exists
      if (!(await fs.pathExists(extensionsDir))) {
        return;
      }

      // 1. Remove extension folder if it exists (CRITICAL)
      try {
        const extensionFolders = await fs.readdir(extensionsDir);
        const extensionFolder = extensionFolders.find(
          (folder) => folder.startsWith(extensionId) || folder.includes(extensionId),
        );

        if (extensionFolder && !extensionFolder.startsWith(".")) {
          const fullPath = path.join(extensionsDir, extensionFolder);
          await fs.remove(fullPath);
        }
      } catch {
        // Extension folder already removed or not found
      }

      // 2. Update extensions.json (OPTIONAL - best effort)
      await this.removeFromExtensionsJson(extensionsDir, extensionId);

      // 3. Add to .obsolete file (OPTIONAL - best effort)
      await this.addToObsoleteFile(extensionsDir, extensionId);
    } catch {
      // Silently ignore cleanup errors - the CLI uninstall already succeeded
    }
  }

  /**
   * Remove extension entry from extensions.json
   */
  private async removeFromExtensionsJson(
    extensionsDir: string,
    extensionId: string,
  ): Promise<void> {
    const extensionsJsonPath = path.join(extensionsDir, "extensions.json");

    if (!(await fs.pathExists(extensionsJsonPath))) {
      return; // File doesn't exist, nothing to update
    }

    try {
      const content = await fs.readFile(extensionsJsonPath, "utf-8");

      // Handle empty or nearly empty files
      if (!content || content.trim() === "" || content.trim() === "[]") {
        return;
      }

      const extensions = JSON.parse(content);

      if (Array.isArray(extensions)) {
        const filtered = extensions.filter((ext: unknown) => {
          const extObj = ext as { identifier?: { id?: string }; id?: string };
          const id = extObj?.identifier?.id || extObj?.id;
          return id !== extensionId;
        });

        // Only write if content actually changed
        if (filtered.length !== extensions.length) {
          await fs.writeFile(extensionsJsonPath, JSON.stringify(filtered));
        }
      }
    } catch {
      // Silently fail - extensions.json format might be corrupt or proprietary
      // The extension folder removal is the critical part anyway
    }
  }

  /**
   * Add extension to .obsolete file
   */
  private async addToObsoleteFile(extensionsDir: string, extensionId: string): Promise<void> {
    const obsoletePath = path.join(extensionsDir, ".obsolete");

    try {
      let obsolete: Record<string, boolean> = {};

      if (await fs.pathExists(obsoletePath)) {
        const content = await fs.readFile(obsoletePath, "utf-8");
        try {
          obsolete = JSON.parse(content);
        } catch {
          // If parsing fails, start fresh
          obsolete = {};
        }
      }

      obsolete[extensionId] = true;
      await fs.writeFile(obsoletePath, JSON.stringify(obsolete));
    } catch {
      // Silently fail - .obsolete is optional metadata
    }
  }

  /**
   * Utility: Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global instance accessor
let globalUninstallService: UninstallExtensionsService | null = null;

export function getUninstallExtensionsService(): UninstallExtensionsService {
  if (!globalUninstallService) {
    globalUninstallService = new UninstallExtensionsService();
  }
  return globalUninstallService;
}
