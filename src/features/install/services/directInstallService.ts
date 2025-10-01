import path from "node:path";
import fs from "fs-extra";
import AdmZip from "adm-zip";
import { InstallResult } from "./editorCliService";
import { ExtensionStateManager } from "./ExtensionStateManager";

export interface DirectInstallOptions {
  force?: boolean;
  timeout?: number;
}

export interface ExtensionMetadata {
  id: string;
  name: string;
  publisher: string;
  version: string;
  displayName?: string;
  description?: string;
}

interface ExtensionEntry {
  identifier: { id: string };
  version: string;
  location: {
    $mid: number;
    path: string;
    scheme: string;
  };
  relativeLocation: string;
  metadata: {
    installedTimestamp: number;
    pinned: boolean;
    source: string;
  };
}

/**
 * Direct VSIX installation service - bypasses VS Code CLI entirely
 * This eliminates VS Code's buggy file management and race conditions
 */
export class DirectInstallService {
  /**
   * Install a VSIX file directly to the extensions folder
   */
  async installVsix(
    vsixPath: string,
    extensionsDir: string,
    options: DirectInstallOptions = {},
  ): Promise<InstallResult> {
    let tempExtensionDir: string | null = null;

    try {
      // 1. Validate inputs
      if (!(await fs.pathExists(vsixPath))) {
        throw new Error(`VSIX file not found: ${vsixPath}`);
      }

      if (!(await fs.pathExists(extensionsDir))) {
        await fs.ensureDir(extensionsDir);
      }

      // 2. Extract and validate VSIX
      const metadata = await this.extractAndValidateVsix(vsixPath, extensionsDir);

      // 3. Check if extension already exists
      const finalExtensionDir = path.join(
        extensionsDir,
        `${metadata.publisher}.${metadata.name}-${metadata.version}`,
      );

      if (await fs.pathExists(finalExtensionDir)) {
        if (!options.force) {
          return {
            success: false,
            exitCode: 1,
            error: `Extension ${metadata.id} already exists. Use --force to reinstall.`,
          };
        }
        // Remove existing extension
        await fs.remove(finalExtensionDir);
      }

      // 4. Create temporary extension directory for atomic operation
      tempExtensionDir = path.join(
        extensionsDir,
        `.temp-${metadata.publisher}.${metadata.name}-${Date.now()}`,
      );
      await fs.ensureDir(tempExtensionDir);

      // 5. Extract VSIX contents to temporary directory
      await this.extractVsixContents(vsixPath, tempExtensionDir);

      // 6. Atomic move to final location
      await fs.move(tempExtensionDir, finalExtensionDir);
      tempExtensionDir = null; // Mark as successfully moved

      // 7. Update extensions metadata
      const stateManager = new ExtensionStateManager(extensionsDir);
      const relativeLocation = path.basename(finalExtensionDir);

      await stateManager.addExtension({
        identifier: { id: metadata.id },
        version: metadata.version,
        location: {
          $mid: 1,
          path: finalExtensionDir,
          scheme: "file",
        },
        relativeLocation: relativeLocation,
        metadata: {
          installedTimestamp: Date.now(),
          pinned: true,
          source: "vsix",
        },
      });

      return {
        success: true,
        exitCode: 0,
        stdout: `Successfully installed ${metadata.id}`,
      };
    } catch (error) {
      // Clean up temporary directory if it exists
      if (tempExtensionDir && (await fs.pathExists(tempExtensionDir))) {
        try {
          await fs.remove(tempExtensionDir);
        } catch {
          // Ignore cleanup errors
        }
      }

      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Uninstall an extension directly
   */
  async uninstallExtension(extensionId: string, extensionsDir: string): Promise<InstallResult> {
    try {
      // 1. Find extension directory
      const extensionDir = await this.findExtensionDirectory(extensionsDir, extensionId);

      if (!extensionDir) {
        return {
          success: false,
          exitCode: 1,
          error: `Extension ${extensionId} not found`,
        };
      }

      // 2. Remove extension directory
      if (await fs.pathExists(extensionDir)) {
        await fs.remove(extensionDir);
      }

      // 3. Small delay to prevent race conditions during bulk uninstalls
      await this.delay(50);

      // 4. Update extensions metadata (best effort - don't fail if this fails)
      try {
        const stateManager = new ExtensionStateManager(extensionsDir);
        await stateManager.removeExtension(extensionId);
      } catch (metadataError) {
        // Log but don't fail the uninstall if metadata update fails
        console.warn(`Warning: Failed to update extensions.json: ${metadataError}`);
      }

      return {
        success: true,
        exitCode: 0,
        stdout: `Successfully uninstalled ${extensionId}`,
      };
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract and validate VSIX file
   */
  private async extractAndValidateVsix(
    vsixPath: string,
    extensionsDir: string,
  ): Promise<ExtensionMetadata> {
    // Create temporary extraction directory
    const tempDir = path.join(extensionsDir, ".temp-extract");
    await fs.ensureDir(tempDir);

    try {
      // Extract VSIX (it's a ZIP file)
      await this.extractZip(vsixPath, tempDir);

      // Read and validate package.json (VSIX files have it in extension/ subdirectory)
      const packageJsonPath = path.join(tempDir, "extension", "package.json");
      if (!(await fs.pathExists(packageJsonPath))) {
        throw new Error("VSIX file is invalid: missing package.json");
      }

      const packageJson = await fs.readJson(packageJsonPath);

      if (!packageJson.name || !packageJson.publisher) {
        throw new Error("VSIX file is invalid: missing name or publisher");
      }

      return {
        id: `${packageJson.publisher}.${packageJson.name}`,
        name: packageJson.name,
        publisher: packageJson.publisher,
        version: packageJson.version || "1.0.0",
        displayName: packageJson.displayName,
        description: packageJson.description,
      };
    } finally {
      // Clean up temp directory
      await fs.remove(tempDir);
    }
  }

  /**
   * Extract VSIX contents to extension directory
   */
  private async extractVsixContents(vsixPath: string, extensionDir: string): Promise<void> {
    // Create unique temporary extraction directory per extension
    const extensionName = path.basename(extensionDir);
    const tempDir = path.join(
      path.dirname(extensionDir),
      `.temp-extract-${extensionName}-${Date.now()}`,
    );
    await fs.ensureDir(tempDir);

    try {
      // Extract VSIX to temporary directory
      await this.extractZip(vsixPath, tempDir);

      // Create final extension directory
      await fs.ensureDir(extensionDir);

      // Move contents from extension/ subdirectory to final directory
      const sourceDir = path.join(tempDir, "extension");
      if (await fs.pathExists(sourceDir)) {
        // Move all contents from extension/ to the final directory
        const entries = await fs.readdir(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
          const sourcePath = path.join(sourceDir, entry.name);
          const destPath = path.join(extensionDir, entry.name);

          if (entry.isDirectory()) {
            await fs.move(sourcePath, destPath);
          } else {
            await fs.move(sourcePath, destPath);
          }
        }
      } else {
        throw new Error("VSIX file is invalid: missing extension directory");
      }
    } finally {
      // Clean up temporary directory
      await fs.remove(tempDir);
    }
  }

  /**
   * Extract ZIP file (VSIX is a ZIP) with security validation
   * Only blocks actual security threats, not legitimate extension files
   */
  private async extractZip(zipPath: string, extractTo: string): Promise<void> {
    try {
      const zip = new AdmZip(zipPath);
      const extractToResolved = path.resolve(extractTo);

      // Security: Validate all entries before extraction
      // ONLY block actual path traversal attacks, not legitimate files
      for (const entry of zip.getEntries()) {
        const entryName = entry.entryName;

        // Block absolute paths first
        if (entryName.startsWith("/") || entryName.startsWith("\\")) {
          throw new Error(`Absolute path not allowed: ${entryName}`);
        }

        // Block Windows drive letters (C:, D:, etc.)
        if (/^[a-zA-Z]:/.test(entryName)) {
          throw new Error(`Drive letter not allowed: ${entryName}`);
        }

        // Block path traversal attacks (../ as path components, not in filenames)
        // Split by both forward and back slashes to check path components
        const pathParts = entryName.split(/[/\\]/);
        for (const part of pathParts) {
          // Check if any path component is exactly ".." or URL-encoded variants
          if (
            part === ".." ||
            part === "..%2f" ||
            part === "..%5c" ||
            part === "%2e%2e" ||
            part === "%2e%2e%2f" ||
            part === "%2e%2e%5c"
          ) {
            throw new Error(`Path traversal attempt detected: ${entryName}`);
          }
        }

        // Verify the resolved path stays within extraction directory
        // This is the ultimate safety check - even if something slips through above,
        // path.normalize will resolve .. sequences and we can verify containment
        const normalizedPath = path.normalize(entryName);
        const fullPath = path.resolve(extractTo, normalizedPath);

        if (!fullPath.startsWith(extractToResolved + path.sep) && fullPath !== extractToResolved) {
          throw new Error(`Path would escape extraction directory: ${entryName}`);
        }
      }

      // Extract all entries
      zip.extractAllTo(extractTo, true);
    } catch (error) {
      throw new Error(
        `Failed to extract VSIX: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update extensions.json file atomically
   */
  private async updateExtensionsJson(
    extensionsDir: string,
    metadata: Partial<ExtensionMetadata>,
    action: "add" | "remove",
  ): Promise<void> {
    const extensionsJsonPath = path.join(extensionsDir, "extensions.json");
    const tempExtensionsJsonPath = path.join(extensionsDir, ".temp-extensions.json");

    try {
      // Read current extensions
      let extensions: ExtensionEntry[] = [];
      if (await fs.pathExists(extensionsJsonPath)) {
        try {
          const content = await fs.readFile(extensionsJsonPath, "utf-8");
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            extensions = parsed as ExtensionEntry[];
          }
        } catch {
          // File is corrupted, start fresh
          extensions = [];
        }
      }

      if (action === "add") {
        // Add extension to list
        const existingIndex = extensions.findIndex((ext) => ext.identifier?.id === metadata.id);
        const relativeLocation = `${metadata.publisher}.${metadata.name}-${metadata.version}`;
        const absolutePath = path.join(path.dirname(extensionsJsonPath), relativeLocation);

        const extensionEntry = {
          identifier: { id: metadata.id! },
          version: metadata.version!,
          location: {
            $mid: 1,
            path: absolutePath,
            scheme: "file",
          },
          relativeLocation: relativeLocation,
          metadata: {
            installedTimestamp: Date.now(),
            pinned: true,
            source: "vsix",
          },
        };

        if (existingIndex >= 0) {
          extensions[existingIndex] = extensionEntry;
        } else {
          extensions.push(extensionEntry);
        }
      } else {
        // Remove extension from list
        extensions = extensions.filter((ext) => ext.identifier?.id !== metadata.id);
      }

      // Write to temporary file first (atomic operation)
      await fs.writeFile(tempExtensionsJsonPath, JSON.stringify(extensions, null, 2));

      // Atomic operation: copy temp file to final location, then remove temp
      await fs.copyFile(tempExtensionsJsonPath, extensionsJsonPath);
      await fs.remove(tempExtensionsJsonPath);
    } catch (error) {
      // Clean up temporary file if it exists
      if (await fs.pathExists(tempExtensionsJsonPath)) {
        try {
          await fs.remove(tempExtensionsJsonPath);
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Find extension directory by ID with better matching
   */
  private async findExtensionDirectory(
    extensionsDir: string,
    extensionId: string,
  ): Promise<string | null> {
    try {
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });

      // VS Code extension directories are named: publisher.name-version (lowercase)
      // Extension IDs are case-sensitive, so we need case-insensitive matching
      const lowerExtensionId = extensionId.toLowerCase();

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;

          // Check if directory starts with the extension ID (case-insensitive)
          if (dirName.toLowerCase().startsWith(lowerExtensionId)) {
            // Verify this is actually the right extension by checking package.json
            const packageJsonPath = path.join(extensionsDir, dirName, "package.json");
            if (await fs.pathExists(packageJsonPath)) {
              try {
                const packageJson = await fs.readJson(packageJsonPath);
                const fullId = `${packageJson.publisher}.${packageJson.name}`;
                // Case-sensitive comparison for the final verification
                if (fullId === extensionId) {
                  return path.join(extensionsDir, dirName);
                }
              } catch {
                // Invalid package.json, skip this directory
                continue;
              }
            }
          }
        }
      }

      return null;
    } catch {
      // If we can't read the directory, return null
      return null;
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
let globalDirectInstallService: DirectInstallService | null = null;

export function getDirectInstallService(): DirectInstallService {
  if (!globalDirectInstallService) {
    globalDirectInstallService = new DirectInstallService();
  }
  return globalDirectInstallService;
}
