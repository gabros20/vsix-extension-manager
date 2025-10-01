import path from "node:path";
import fs from "fs-extra";
import os from "node:os";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import { InstallResult } from "./editorCliService";
import { ExtensionStateManager } from "./ExtensionStateManager";

export interface RobustInstallOptions {
  force?: boolean;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ExtensionMetadata {
  id: string;
  name: string;
  publisher: string;
  version: string;
  displayName?: string;
  description?: string;
}

/**
 * Robust VSIX installation service with advanced race condition handling
 *
 * Key innovations:
 * 1. Process-isolated temp directories outside extensions folder
 * 2. File locking for extensions.json updates
 * 3. Installation queue to serialize file operations
 * 4. Enhanced error recovery with intelligent retry
 */
export class RobustInstallService {
  private static instance: RobustInstallService;
  private installationQueue: Promise<void> = Promise.resolve();
  private fileLocks = new Map<string, Promise<void>>();

  /**
   * Install a VSIX file with robust race condition handling
   */
  async installVsix(
    vsixPath: string,
    extensionsDir: string,
    options: RobustInstallOptions = {},
  ): Promise<InstallResult> {
    const { force = false, timeout = 30000, maxRetries = 3, retryDelay = 1000 } = options;

    // Queue this installation to prevent concurrent operations
    return new Promise((resolve) => {
      this.installationQueue = this.installationQueue.then(async () => {
        try {
          const result = await this.performInstallation(vsixPath, extensionsDir, {
            force,
            timeout,
            maxRetries,
            retryDelay,
          });
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            exitCode: 1,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    });
  }

  /**
   * Perform the actual installation with retry logic
   */
  private async performInstallation(
    vsixPath: string,
    extensionsDir: string,
    options: Required<RobustInstallOptions>,
  ): Promise<InstallResult> {
    const { force, maxRetries, retryDelay } = options;
    let lastError: Error | null = null;
    let metadata: ExtensionMetadata | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create process-isolated temp directory
        const processId = process.pid;
        const sessionId = randomUUID().slice(0, 8);
        const tempBaseDir = path.join(os.tmpdir(), `vsix-install-${processId}-${sessionId}`);

        await fs.ensureDir(tempBaseDir);

        try {
          // 1. Ensure extensions directory exists first
          await fs.ensureDir(extensionsDir);

          // 2. Validate VSIX file and permissions
          if (!(await fs.pathExists(vsixPath))) {
            throw new Error(`VSIX file not found: ${vsixPath}`);
          }

          // Validate file permissions
          try {
            await fs.access(vsixPath, fs.constants.R_OK);
          } catch {
            throw new Error(`VSIX file is not readable: ${vsixPath}`);
          }

          // Validate extensions directory permissions
          try {
            await fs.access(extensionsDir, fs.constants.W_OK);
          } catch {
            throw new Error(`Extensions directory is not writable: ${extensionsDir}`);
          }

          // 3. Extract and validate metadata in isolated temp directory
          metadata = await this.extractAndValidateVsix(vsixPath, tempBaseDir);

          // 3. Check for existing extension
          const finalExtensionDir = path.join(
            extensionsDir,
            `${metadata.publisher}.${metadata.name}-${metadata.version}`,
          );

          if (await fs.pathExists(finalExtensionDir)) {
            if (!force) {
              return {
                success: false,
                exitCode: 1,
                error: `Extension ${metadata.id} already exists. Use --force to reinstall.`,
              };
            }
            // Remove existing extension atomically
            await this.removeExtensionSafely(finalExtensionDir);
          }

          // 4. Create isolated temp extension directory
          const tempExtensionDir = path.join(
            tempBaseDir,
            `extension-${metadata.publisher}.${metadata.name}`,
          );
          await fs.ensureDir(tempExtensionDir);

          // 5. Extract VSIX contents to isolated temp directory
          await this.extractVsixContents(vsixPath, tempExtensionDir);

          // 6. Atomic move to final location with retry
          await this.atomicMove(tempExtensionDir, finalExtensionDir, 3);

          // 7. Update extensions metadata with file locking
          await this.updateExtensionsJsonWithLock(extensionsDir, metadata, "add");

          // 8. Ensure .obsolete file exists (VS Code requirement)
          await this.ensureObsoleteFile(extensionsDir);

          return {
            success: true,
            exitCode: 0,
            stdout: `Successfully installed ${metadata.id}`,
          };
        } finally {
          // Always clean up temp directory
          await this.cleanupTempDirectory(tempBaseDir);

          // Clean up any partial installation artifacts on error
          try {
            if (lastError && metadata) {
              await this.cleanupPartialInstallation(extensionsDir, metadata);
            }
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
          await this.delay(delay);
        }
      }
    }

    return {
      success: false,
      exitCode: 1,
      error: lastError?.message || "Installation failed after all retries",
    };
  }

  /**
   * Extract and validate VSIX file in isolated temp directory
   */
  private async extractAndValidateVsix(
    vsixPath: string,
    tempBaseDir: string,
  ): Promise<ExtensionMetadata> {
    const tempExtractDir = path.join(tempBaseDir, "extract");
    await fs.ensureDir(tempExtractDir);

    try {
      // Extract VSIX to isolated temp directory
      await this.extractZip(vsixPath, tempExtractDir);

      // Read and validate package.json
      const packageJsonPath = path.join(tempExtractDir, "extension", "package.json");
      if (!(await fs.pathExists(packageJsonPath))) {
        throw new Error("VSIX file is invalid: missing package.json");
      }

      const packageJson = await fs.readJson(packageJsonPath);

      if (!packageJson.name || !packageJson.publisher) {
        throw new Error("VSIX file is invalid: missing name or publisher");
      }

      // Additional validation for critical fields
      if (typeof packageJson.name !== "string" || packageJson.name.trim() === "") {
        throw new Error("VSIX file is invalid: name must be a non-empty string");
      }

      if (typeof packageJson.publisher !== "string" || packageJson.publisher.trim() === "") {
        throw new Error("VSIX file is invalid: publisher must be a non-empty string");
      }

      if (packageJson.version && typeof packageJson.version !== "string") {
        throw new Error("VSIX file is invalid: version must be a string");
      }

      // Validate extension ID format
      const extensionId = `${packageJson.publisher}.${packageJson.name}`;
      if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_]*\.[a-zA-Z0-9][a-zA-Z0-9\-_]*$/.test(extensionId)) {
        throw new Error("VSIX file is invalid: invalid extension ID format");
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
      // Clean up extraction temp directory
      await this.cleanupTempDirectory(tempExtractDir);
    }
  }

  /**
   * Extract VSIX contents to extension directory
   */
  private async extractVsixContents(vsixPath: string, extensionDir: string): Promise<void> {
    const tempExtractDir = path.join(path.dirname(extensionDir), "temp-extract");
    await fs.ensureDir(tempExtractDir);

    try {
      // Extract VSIX to temp directory
      await this.extractZip(vsixPath, tempExtractDir);

      // Create final extension directory
      await fs.ensureDir(extensionDir);

      // Move contents from extension/ subdirectory to final directory
      const sourceDir = path.join(tempExtractDir, "extension");
      if (await fs.pathExists(sourceDir)) {
        await this.moveDirectoryContents(sourceDir, extensionDir);
      } else {
        throw new Error("VSIX file is invalid: missing extension directory");
      }
    } finally {
      // Clean up temp extraction directory
      await this.cleanupTempDirectory(tempExtractDir);
    }
  }

  /**
   * Move directory contents with retry logic
   */
  private async moveDirectoryContents(sourceDir: string, destDir: string): Promise<void> {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      try {
        if (entry.isDirectory()) {
          await fs.move(sourcePath, destPath);
        } else {
          await fs.move(sourcePath, destPath);
        }
      } catch {
        // If move fails, try copy + remove
        if (entry.isDirectory()) {
          await fs.copy(sourcePath, destPath);
          await fs.remove(sourcePath);
        } else {
          await fs.copyFile(sourcePath, destPath);
          await fs.remove(sourcePath);
        }
      }
    }
  }

  /**
   * Atomic move with retry logic
   */
  private async atomicMove(source: string, dest: string, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.move(source, dest);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries - 1) {
          // Wait before retry
          await this.delay(500 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error("Failed to move directory after all retries");
  }

  /**
   * Remove extension safely with retry
   */
  private async removeExtensionSafely(extensionDir: string): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.remove(extensionDir);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries - 1) {
          // Wait before retry
          await this.delay(500 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error("Failed to remove extension directory");
  }

  /**
   * Update extensions.json with file locking
   */
  private async updateExtensionsJsonWithLock(
    extensionsDir: string,
    metadata: ExtensionMetadata,
    action: "add" | "remove",
  ): Promise<void> {
    const extensionsJsonPath = path.join(extensionsDir, "extensions.json");
    const lockKey = extensionsJsonPath;

    // Wait for any existing lock to be released with timeout protection
    let lockWaitTime = 0;
    const maxLockWaitTime = 30000; // 30 seconds max wait

    while (this.fileLocks.has(lockKey) && lockWaitTime < maxLockWaitTime) {
      try {
        await Promise.race([
          this.fileLocks.get(lockKey),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Lock timeout")), 1000)),
        ]);
      } catch {
        // Lock timed out or failed, continue
      }
      lockWaitTime += 1000;
    }

    if (lockWaitTime >= maxLockWaitTime) {
      throw new Error("File lock timeout - extensions.json may be locked by another process");
    }

    // Create new lock atomically
    const lockPromise = this.performExtensionsJsonUpdate(extensionsJsonPath, metadata, action);
    this.fileLocks.set(lockKey, lockPromise);

    try {
      await lockPromise;
    } finally {
      this.fileLocks.delete(lockKey);
    }
  }

  /**
   * Perform extensions.json update with retry logic
   */
  private async performExtensionsJsonUpdate(
    extensionsJsonPath: string,
    metadata: ExtensionMetadata,
    action: "add" | "remove",
  ): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tempExtensionsJsonPath = path.join(
          path.dirname(extensionsJsonPath),
          `.temp-extensions-${randomUUID()}.json`,
        );

        try {
          // Read current extensions
          let extensions: unknown[] = [];
          if (await fs.pathExists(extensionsJsonPath)) {
            try {
              const content = await fs.readFile(extensionsJsonPath, "utf-8");
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                extensions = parsed;
              }
            } catch {
              // File is corrupted, start fresh
              extensions = [];
            }
          }

          if (action === "add") {
            // Add extension to list
            const existingIndex = extensions.findIndex(
              (ext) =>
                ((ext as Record<string, unknown>).identifier as Record<string, unknown>)?.id ===
                metadata.id,
            );

            const relativeLocation = `${metadata.publisher}.${metadata.name}-${metadata.version}`;
            const absolutePath = path.join(path.dirname(extensionsJsonPath), relativeLocation);

            const extensionEntry = {
              identifier: { id: metadata.id },
              version: metadata.version,
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
            extensions = extensions.filter(
              (ext) =>
                ((ext as Record<string, unknown>).identifier as Record<string, unknown>)?.id !==
                metadata.id,
            );
          }

          // Validate extensions structure before writing
          this.validateExtensionsStructure(extensions);

          // Write to temporary file first (atomic operation)
          await fs.writeFile(tempExtensionsJsonPath, JSON.stringify(extensions, null, 2));

          // Atomic operation: copy temp file to final location
          await fs.copyFile(tempExtensionsJsonPath, extensionsJsonPath);
          await fs.remove(tempExtensionsJsonPath);

          return;
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries - 1) {
          // Wait before retry
          await this.delay(200 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error("Failed to update extensions.json after all retries");
  }

  /**
   * Extract ZIP file with security validation
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
   * Ensure .obsolete file exists (VS Code requirement)
   */
  private async ensureObsoleteFile(extensionsDir: string): Promise<void> {
    try {
      const stateManager = new ExtensionStateManager(extensionsDir);
      await stateManager.ensureObsoleteFile();
    } catch {
      // Silently ignore - this is not critical for installation
    }
  }

  /**
   * Validate extensions.json structure matches VS Code format
   */
  private validateExtensionsStructure(extensions: unknown[]): void {
    if (!Array.isArray(extensions)) {
      throw new Error("Extensions must be an array");
    }

    for (const ext of extensions) {
      if (!ext || typeof ext !== "object") {
        throw new Error("Each extension must be an object");
      }

      const extObj = ext as Record<string, unknown>;
      if (!extObj.identifier || typeof extObj.identifier !== "object") {
        throw new Error("Extension must have identifier object");
      }

      if (
        !(extObj.identifier as Record<string, unknown>).id ||
        typeof (extObj.identifier as Record<string, unknown>).id !== "string"
      ) {
        throw new Error("Extension identifier must have id string");
      }

      if (!extObj.version || typeof extObj.version !== "string") {
        throw new Error("Extension must have version string");
      }

      if (!extObj.location || typeof extObj.location !== "object") {
        throw new Error("Extension must have location object");
      }
    }
  }

  /**
   * Clean up partial installation artifacts
   */
  private async cleanupPartialInstallation(
    extensionsDir: string,
    metadata: ExtensionMetadata,
  ): Promise<void> {
    try {
      const finalExtensionDir = path.join(
        extensionsDir,
        `${metadata.publisher}.${metadata.name}-${metadata.version}`,
      );

      // Remove any partial extension directory
      if (await fs.pathExists(finalExtensionDir)) {
        await fs.remove(finalExtensionDir);
      }

      // Remove any temporary directories that might be left behind
      const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
      const tempDirs = entries.filter(
        (entry) =>
          entry.isDirectory() && (entry.name.includes(".temp-") || entry.name.includes(".tmp-")),
      );

      for (const tempDir of tempDirs) {
        try {
          await fs.remove(path.join(extensionsDir, tempDir.name));
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }

  /**
   * Clean up temporary directory safely
   */
  private async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
    } catch {
      // Ignore cleanup errors - temp directories will be cleaned up by OS
    }
  }

  /**
   * Utility: Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RobustInstallService {
    if (!RobustInstallService.instance) {
      RobustInstallService.instance = new RobustInstallService();
    }
    return RobustInstallService.instance;
  }
}

// Export singleton instance
export const robustInstallService = RobustInstallService.getInstance();
