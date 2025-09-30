import * as fs from "fs-extra";
import * as path from "path";
import { getEditorService } from "./editorCliService";

export interface PreflightResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Preflight service to check VS Code environment before installation
 */
export class InstallPreflightService {
  private editorService = getEditorService();

  /**
   * Run comprehensive preflight checks
   */
  async runPreflightChecks(editor: "vscode" | "cursor"): Promise<PreflightResult> {
    const result: PreflightResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // Check editor binary
      const availableEditors = await this.editorService.getAvailableEditors();
      const targetEditor = availableEditors.find((e) => e.name === editor);

      if (!targetEditor) {
        result.valid = false;
        result.errors.push(
          `${editor} not found. Please install ${editor === "vscode" ? "VS Code" : "Cursor"}.`,
        );
        return result;
      }

      // Check extensions directory
      const extensionsDir =
        editor === "cursor"
          ? path.join(process.env.HOME || "~", ".cursor", "extensions")
          : path.join(process.env.HOME || "~", ".vscode", "extensions");

      if (!(await fs.pathExists(extensionsDir))) {
        result.valid = false;
        result.errors.push(`Extensions directory not found: ${extensionsDir}`);
        return result;
      }

      // Ensure required files exist
      await this.ensureRequiredFiles(extensionsDir, result);

      // Check for corrupted extensions
      await this.checkCorruptedExtensions(extensionsDir, result);

      // Clean up temporary directories that might cause conflicts
      const cleanedTempDirs = await this.cleanupTemporaryDirectories(extensionsDir);
      if (cleanedTempDirs.length > 0) {
        result.suggestions.push(`Cleaned up ${cleanedTempDirs.length} temporary directory(ies)`);
      }

      // Check disk space
      await this.checkDiskSpace(extensionsDir, result);
    } catch (error) {
      result.valid = false;
      result.errors.push(
        `Preflight check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Ensure required VS Code files exist
   */
  private async ensureRequiredFiles(extensionsDir: string, result: PreflightResult): Promise<void> {
    const extensionsJsonPath = path.join(extensionsDir, "extensions.json");
    const obsoletePath = path.join(extensionsDir, ".obsolete");

    // Ensure extensions.json exists
    if (!(await fs.pathExists(extensionsJsonPath))) {
      try {
        await fs.writeFile(extensionsJsonPath, JSON.stringify([], null, 2));
        result.suggestions.push("Created missing extensions.json file");
      } catch {
        result.errors.push("Failed to create extensions.json");
      }
    }

    // Ensure .obsolete exists
    if (!(await fs.pathExists(obsoletePath))) {
      try {
        await fs.writeFile(obsoletePath, JSON.stringify({}, null, 2));
        result.suggestions.push("Created missing .obsolete file");
      } catch (error) {
        result.errors.push(
          `Failed to create .obsolete file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Check for corrupted or problematic extensions
   */
  private async checkCorruptedExtensions(
    extensionsDir: string,
    result: PreflightResult,
  ): Promise<void> {
    try {
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
      const extensionDirs = entries.filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("."),
      );

      for (const entry of extensionDirs) {
        const extensionPath = path.join(extensionsDir, entry.name);
        const packageJsonPath = path.join(extensionPath, "package.json");

        // Check if package.json exists and is valid
        if (await fs.pathExists(packageJsonPath)) {
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            if (!packageJson.name || !packageJson.publisher) {
              result.warnings.push(`Extension ${entry.name} has invalid package.json`);
            }
          } catch {
            result.warnings.push(`Extension ${entry.name} has corrupted package.json`);
          }
        } else {
          result.warnings.push(`Extension ${entry.name} is missing package.json`);
        }
      }
    } catch {
      result.warnings.push("Failed to scan extensions");
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(extensionsDir: string, result: PreflightResult): Promise<void> {
    try {
      // This is a basic check - in a real implementation, you'd use a proper disk space check
      result.suggestions.push("Consider checking available disk space before large installations");
    } catch {
      result.warnings.push("Could not check disk space");
    }
  }

  /**
   * Clean up problematic extensions that might cause installation issues
   */
  async cleanupProblematicExtensions(extensionsDir: string): Promise<string[]> {
    const cleaned: string[] = [];

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
            cleaned.push(entry.name);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    return cleaned;
  }

  /**
   * Clean up temporary directories that might cause installation conflicts
   */
  async cleanupTemporaryDirectories(extensionsDir: string): Promise<string[]> {
    const cleaned: string[] = [];

    try {
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });

      // Look for temporary directories (usually start with . and contain UUIDs)
      const tempDirs = entries.filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(".") &&
          entry.name.length > 8 && // Likely a UUID
          !entry.name.startsWith(".obsolete"), // Don't remove .obsolete
      );

      for (const entry of tempDirs) {
        const tempPath = path.join(extensionsDir, entry.name);
        try {
          // Check if directory is empty or contains only temp files
          const contents = await fs.readdir(tempPath);
          const hasImportantFiles = contents.some(
            (file) => file === "package.json" || file.endsWith(".js") || file.endsWith(".json"),
          );

          if (!hasImportantFiles) {
            await fs.remove(tempPath);
            cleaned.push(entry.name);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    return cleaned;
  }
}

// Global instance accessor
let globalPreflightService: InstallPreflightService | null = null;

export function getInstallPreflightService(): InstallPreflightService {
  if (!globalPreflightService) {
    globalPreflightService = new InstallPreflightService();
  }
  return globalPreflightService;
}
