import { getEditorService, getInstallService } from "../../install";
import { getDirectInstallService } from "../../install/services/directInstallService";
import { getInstalledExtensions } from "../../export";
import type { EditorType } from "../../../core/types";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { ExtensionStateManager } from "../../install/services/ExtensionStateManager";
import { ExtensionEntry } from "../../install/services/ExtensionStateManager";

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
  private directInstallService = getDirectInstallService();

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

    // Ensure extensions folder is in clean state before starting uninstall
    try {
      await this.ensureCleanExtensionsFolder(binPath);
    } catch {
      // Silently ignore cleanup errors
    }

    // VS Code bug workaround: Ensure file state is valid before uninstall
    // VS Code CLI has the same file management bugs during uninstall
    await this.ensureValidFileState(binPath);

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

    // After all uninstalls, re-scan the extensions directory and update extensions.json
    // to match the actual disk state
    const extensionsDir = this.getExtensionsDir(binPath);
    await this.syncExtensionsJsonWithDisk(extensionsDir);

    // Ensure extensions folder is in clean state after all uninstalls
    try {
      await this.ensureCleanExtensionsFolder(binPath);
    } catch {
      // Silently ignore cleanup errors
    }

    return summary;
  }

  /**
   * Uninstall a single extension using direct uninstall
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

    try {
      const extensionsDir = this.getExtensionsDir(binaryPath);
      const stateManager = new ExtensionStateManager(extensionsDir);
      // 1. Find all matching folders
      const foundDirs = await findAllExtensionFolders(extensionsDir, extensionId);
      for (const dir of foundDirs) {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir);
        }
      }
      // 2. Remove from extensions.json
      await stateManager.removeExtension(extensionId);
      // 3. Add to .obsolete
      await stateManager.addToObsolete(extensionId);
      // 4. If not found, report as already uninstalled
      return {
        extensionId,
        success: true,
        error: foundDirs.length === 0 ? "Already uninstalled (folder not found)" : undefined,
        elapsedMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        extensionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startTime,
      };
    }
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
      const extensionsDir = this.getExtensionsDir(binaryPath);

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
      const stateManager = new ExtensionStateManager(extensionsDir);
      await stateManager.removeExtension(extensionId);

      // 3. Add to .obsolete file (OPTIONAL - best effort)
      await stateManager.addToObsolete(extensionId);
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
      const extensionsDir = this.getExtensionsDir(binaryPath);

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

    try {
      // Always ensure the file exists and is valid before attempting to modify
      if (!(await fs.pathExists(extensionsJsonPath))) {
        await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
        return;
      }

      // Validate and fix the file if needed
      let extensions: unknown[] = [];
      try {
        const content = await fs.readFile(extensionsJsonPath, "utf-8");
        if (content && content.trim() && content.trim() !== "[]") {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            extensions = parsed;
          }
        }
      } catch {
        // File is corrupted, start with empty array
        extensions = [];
      }

      // Filter out the extension
      const filtered = extensions.filter((ext: unknown) => {
        const extObj = ext as { identifier?: { id?: string }; id?: string };
        const id = extObj?.identifier?.id || extObj?.id;
        return id !== extensionId;
      });

      // Write the updated content
      await fs.writeFile(extensionsJsonPath, JSON.stringify(filtered, null, 2));
    } catch {
      // If all else fails, ensure we have a valid empty file
      try {
        await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
      } catch {
        // Silently fail - the extension folder removal is the critical part
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
   * Ensure extensions folder file state is valid before uninstall
   * This is a workaround for VS Code's buggy file management
   */
  private async ensureValidFileState(binaryPath: string): Promise<void> {
    try {
      const extensionsDir = this.getExtensionsDir(binaryPath);

      const extensionsJsonPath = path.join(extensionsDir, "extensions.json");
      const obsoletePath = path.join(extensionsDir, ".obsolete");

      // VS Code bug workaround: Always ensure .obsolete exists
      // VS Code deletes this file during operations and fails to recreate it
      if (!(await fs.pathExists(obsoletePath))) {
        await fs.writeFile(obsoletePath, JSON.stringify({}, null, 2));
      }

      // VS Code bug workaround: Ensure extensions.json is valid
      // VS Code sometimes creates corrupted JSON during bulk operations
      if (!(await fs.pathExists(extensionsJsonPath))) {
        await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
      } else {
        try {
          const content = await fs.readFile(extensionsJsonPath, "utf-8");
          JSON.parse(content); // Validate JSON
        } catch {
          // VS Code created corrupted JSON, fix it
          await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
        }
      }
    } catch {
      // Silently ignore file state errors - this is VS Code's problem
    }
  }

  /**
   * Utility: Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper to get the extensions directory based on binary path
   */
  private getExtensionsDir(binaryPath: string): string {
    const home = os.homedir();
    const isCursor = binaryPath.toLowerCase().includes("cursor");
    return isCursor
      ? path.join(home, ".cursor", "extensions")
      : path.join(home, ".vscode", "extensions");
  }

  /**
   * After all uninstalls, re-scan the extensions directory and update extensions.json
   * to match the actual disk state
   */
  private async syncExtensionsJsonWithDisk(extensionsDir: string): Promise<void> {
    const stateManager = new ExtensionStateManager(extensionsDir);
    const entries: ExtensionEntry[] = [];

    // Validate that the path exists and is a directory
    if (!(await fs.pathExists(extensionsDir))) {
      await stateManager.writeExtensionsJson([]);
      return;
    }

    const stats = await fs.stat(extensionsDir);
    if (!stats.isDirectory()) {
      throw new Error(`Expected a directory but got a file: ${extensionsDir}`);
    }

    const dirs = await fs.readdir(extensionsDir, { withFileTypes: true });
    for (const entry of dirs) {
      if (entry.isDirectory()) {
        const pkgPath = path.join(extensionsDir, entry.name, "package.json");
        if (await fs.pathExists(pkgPath)) {
          try {
            const pkg = await fs.readJson(pkgPath);
            if (pkg.publisher && pkg.name && pkg.version) {
              entries.push({
                identifier: { id: `${pkg.publisher}.${pkg.name}` },
                version: pkg.version,
                location: {
                  $mid: 1,
                  path: path.join(extensionsDir, entry.name),
                  scheme: "file",
                },
                relativeLocation: entry.name,
                metadata: {
                  installedTimestamp: Date.now(),
                  pinned: true,
                  source: "marketplace", // Default for existing extensions
                },
              });
            }
          } catch {}
        }
      }
    }
    await stateManager.writeExtensionsJson(entries);
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

// Helper to find all extension folders for a given extension ID (case-insensitive, all versions)
async function findAllExtensionFolders(
  extensionsDir: string,
  extensionId: string,
): Promise<string[]> {
  const found: string[] = [];
  if (!(await fs.pathExists(extensionsDir))) return found;
  const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
  const lowerId = extensionId.toLowerCase();
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dirName = entry.name;
      // Quick check: does the dirName start with publisher.name (case-insensitive)?
      if (dirName.toLowerCase().startsWith(lowerId)) {
        found.push(path.join(extensionsDir, dirName));
        continue;
      }
      // Fallback: check package.json inside
      const pkgPath = path.join(extensionsDir, dirName, "package.json");
      if (await fs.pathExists(pkgPath)) {
        try {
          const pkg = await fs.readJson(pkgPath);
          const fullId = `${pkg.publisher}.${pkg.name}`;
          if (fullId === extensionId) {
            found.push(path.join(extensionsDir, dirName));
          }
        } catch {}
      }
    }
  }
  return found;
}
