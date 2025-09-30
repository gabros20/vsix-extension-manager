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

    // Ensure extensions folder is in clean state after all uninstalls
    try {
      await this.ensureCleanExtensionsFolder(binPath);
    } catch {
      // Silently ignore cleanup errors
    }

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
   * Ensure extensions folder is in clean, default state for VS Code
   * This is called after all uninstalls to ensure the folder is ready for new installations
   */
  async ensureCleanExtensionsFolder(binaryPath: string): Promise<void> {
    try {
      const isCursor = binaryPath.toLowerCase().includes("cursor");
      const extensionsDir = isCursor
        ? path.join(process.env.HOME || "~", ".cursor", "extensions")
        : path.join(process.env.HOME || "~", ".vscode", "extensions");

      // Ensure extensions directory exists
      if (!(await fs.pathExists(extensionsDir))) {
        await fs.ensureDir(extensionsDir);
      }

      // 1. Ensure extensions.json exists and is valid
      await this.ensureValidExtensionsJson(extensionsDir);

      // 2. Ensure .obsolete exists and is valid
      await this.ensureValidObsoleteFile(extensionsDir);

      // 3. Clean up any temporary files that might interfere
      await this.cleanupTemporaryFiles(extensionsDir);

      // 4. Remove any corrupted extension directories
      await this.removeCorruptedExtensions(extensionsDir);
    } catch {
      // Silently ignore cleanup errors
    }
  }

  /**
   * Ensure extensions.json exists and is in valid VS Code format
   */
  private async ensureValidExtensionsJson(extensionsDir: string): Promise<void> {
    const extensionsJsonPath = path.join(extensionsDir, "extensions.json");

    try {
      if (await fs.pathExists(extensionsJsonPath)) {
        // Validate existing file
        const content = await fs.readFile(extensionsJsonPath, "utf-8");
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            throw new Error("Invalid format");
          }
          // File is valid, no action needed
          return;
        } catch {
          // File is corrupted, recreate it
        }
      }

      // Create or recreate extensions.json in VS Code standard format
      const defaultExtensionsJson: unknown[] = [];
      await fs.writeFile(extensionsJsonPath, JSON.stringify(defaultExtensionsJson, null, 2));
    } catch {
      // Silently fail if we can't create the file
    }
  }

  /**
   * Ensure .obsolete exists and is in valid VS Code format
   */
  private async ensureValidObsoleteFile(extensionsDir: string): Promise<void> {
    const obsoletePath = path.join(extensionsDir, ".obsolete");

    try {
      if (await fs.pathExists(obsoletePath)) {
        // Validate existing file
        const content = await fs.readFile(obsoletePath, "utf-8");
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Invalid format");
          }
          // File is valid, no action needed
          return;
        } catch {
          // File is corrupted, recreate it
        }
      }

      // Create or recreate .obsolete in VS Code standard format
      const defaultObsolete = {};
      await fs.writeFile(obsoletePath, JSON.stringify(defaultObsolete, null, 2));
    } catch {
      // Silently fail if we can't create the file
    }
  }

  /**
   * Clean up temporary files that might interfere with installations
   */
  private async cleanupTemporaryFiles(extensionsDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });

      // Remove temporary files (usually have .tmp, .temp, or .vsctmp extensions)
      const tempFiles = entries.filter(
        (entry) =>
          entry.isFile() &&
          (entry.name.endsWith(".tmp") ||
            entry.name.endsWith(".temp") ||
            entry.name.endsWith(".vsctmp")),
      );

      for (const entry of tempFiles) {
        try {
          await fs.remove(path.join(extensionsDir, entry.name));
        } catch {
          // Ignore cleanup errors
        }
      }

      // Remove temporary directories (UUID-like names starting with .)
      const tempDirs = entries.filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(".") &&
          entry.name.length > 8 &&
          !entry.name.startsWith(".obsolete"),
      );

      for (const entry of tempDirs) {
        try {
          const tempPath = path.join(extensionsDir, entry.name);
          const contents = await fs.readdir(tempPath);

          // Only remove if it doesn't contain important files
          const hasImportantFiles = contents.some(
            (file) => file === "package.json" || file.endsWith(".js") || file.endsWith(".json"),
          );

          if (!hasImportantFiles) {
            await fs.remove(tempPath);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }

  /**
   * Remove corrupted extension directories that might cause installation issues
   */
  private async removeCorruptedExtensions(extensionsDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
      const extensionDirs = entries.filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("."),
      );

      for (const entry of extensionDirs) {
        const extensionPath = path.join(extensionsDir, entry.name);
        const packageJsonPath = path.join(extensionPath, "package.json");

        // Remove extensions without valid package.json
        if (!(await fs.pathExists(packageJsonPath))) {
          try {
            await fs.remove(extensionPath);
          } catch {
            // Ignore cleanup errors
          }
        } else {
          // Validate package.json
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            if (!packageJson.name || !packageJson.publisher) {
              // Invalid package.json, remove the extension
              await fs.remove(extensionPath);
            }
          } catch {
            // Corrupted package.json, remove the extension
            await fs.remove(extensionPath);
          }
        }
      }
    } catch {
      // Silently ignore cleanup errors
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
      // File doesn't exist - create it as empty array to prevent VS Code errors
      try {
        await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
      } catch {
        // Ignore if we can't create the file
      }
      return;
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
          await fs.writeFile(extensionsJsonPath, JSON.stringify(filtered, null, 2));
        }
      }
    } catch {
      // If file is corrupt, recreate it as empty array
      try {
        await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
      } catch {
        // Silently fail - extensions.json format might be corrupt or proprietary
        // The extension folder removal is the critical part anyway
      }
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
      await fs.writeFile(obsoletePath, JSON.stringify(obsolete, null, 2));
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
