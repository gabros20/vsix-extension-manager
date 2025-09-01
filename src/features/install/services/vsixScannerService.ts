import fs from "fs-extra";
import path from "path";
import { ValidationError } from "../../../core/errors";

export interface VsixFile {
  path: string;
  filename: string;
  size: number;
  modified: Date;
  isValid: boolean;
  error?: string;
  extensionId?: string;
  version?: string;
}

export interface ScanResult {
  totalFiles: number;
  validVsixFiles: VsixFile[];
  invalidFiles: VsixFile[];
  errors: string[];
}

/**
 * Service for scanning and validating VSIX files
 */
export class VsixScannerService {
  /**
   * Scan a directory for VSIX files recursively
   */
  async scanDirectory(
    directory: string,
    options: {
      recursive?: boolean;
      validateFiles?: boolean;
      maxDepth?: number;
    } = {},
  ): Promise<ScanResult> {
    const { recursive = true, validateFiles = true, maxDepth = 10 } = options;

    if (!(await fs.pathExists(directory))) {
      throw new ValidationError(
        `Directory does not exist: ${directory}`,
        "SCAN_DIR_NOT_FOUND",
        [
          { action: "Check path", description: "Verify the directory path is correct" },
          { action: "Create directory", description: "Create the directory if it should exist" },
        ],
        { directory },
      );
    }

    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) {
      throw new ValidationError(
        `Path is not a directory: ${directory}`,
        "SCAN_NOT_DIRECTORY",
        [
          { action: "Check path", description: "Ensure the path points to a directory" },
          {
            action: "Use file path",
            description: "Use --vsix for single files instead of --vsix-dir",
          },
        ],
        { directory },
      );
    }

    const result: ScanResult = {
      totalFiles: 0,
      validVsixFiles: [],
      invalidFiles: [],
      errors: [],
    };

    try {
      await this.scanDirectoryRecursive(directory, result, {
        recursive,
        validateFiles,
        maxDepth,
        currentDepth: 0,
      });
    } catch (error) {
      result.errors.push(`Scan error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Recursively scan directory for VSIX files
   */
  private async scanDirectoryRecursive(
    directory: string,
    result: ScanResult,
    options: {
      recursive: boolean;
      validateFiles: boolean;
      maxDepth: number;
      currentDepth: number;
    },
  ): Promise<void> {
    const { recursive, validateFiles, maxDepth, currentDepth } = options;

    if (currentDepth > maxDepth) {
      return; // Prevent infinite recursion
    }

    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await this.scanDirectoryRecursive(fullPath, result, {
            ...options,
            currentDepth: currentDepth + 1,
          });
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".vsix")) {
        result.totalFiles++;
        const vsixFile = await this.processVsixFile(fullPath, validateFiles);
        if (vsixFile.isValid) {
          result.validVsixFiles.push(vsixFile);
        } else {
          result.invalidFiles.push(vsixFile);
        }
      }
    }
  }

  /**
   * Process a single VSIX file
   */
  private async processVsixFile(filePath: string, validate: boolean): Promise<VsixFile> {
    const filename = path.basename(filePath);

    try {
      const stats = await fs.stat(filePath);

      const vsixFile: VsixFile = {
        path: filePath,
        filename,
        size: stats.size,
        modified: stats.mtime,
        isValid: false,
      };

      // Basic validation
      if (stats.size === 0) {
        vsixFile.error = "File is empty";
        return vsixFile;
      }

      if (stats.size < 1024) {
        vsixFile.error = "File is too small to be a valid VSIX";
        return vsixFile;
      }

      // Try to extract extension info from filename
      const extracted = this.extractExtensionInfoFromFilename(filename);
      if (extracted) {
        vsixFile.extensionId = extracted.id;
        vsixFile.version = extracted.version;
      }

      // Optional deep validation
      if (validate) {
        const validationResult = await this.validateVsixFile(filePath);
        if (!validationResult.isValid) {
          vsixFile.error = validationResult.error;
          return vsixFile;
        }
      }

      vsixFile.isValid = true;
      return vsixFile;
    } catch (error) {
      return {
        path: filePath,
        filename,
        size: 0,
        modified: new Date(),
        isValid: false,
        error: `Failed to process file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract extension ID and version from filename
   * Expected patterns:
   * - publisher.extension-version.vsix
   * - publisher-extension-vversion.vsix
   * - publisher.extension.vsix (no version)
   */
  private extractExtensionInfoFromFilename(
    filename: string,
  ): { id: string; version?: string } | null {
    const nameWithoutExt = filename.replace(/\.vsix$/i, "");

    // Try pattern: publisher.extension-version
    const dashMatch = nameWithoutExt.match(/^(.+)-(.+)$/);
    if (dashMatch) {
      const potentialId = dashMatch[1];
      const potentialVersion = dashMatch[2];

      // Check if potentialId looks like publisher.extension
      if (potentialId.includes(".")) {
        // Validate version format
        if (this.isValidVersion(potentialVersion)) {
          return { id: potentialId, version: potentialVersion };
        }
      }
    }

    // Try pattern: just publisher.extension (no version)
    if (nameWithoutExt.includes(".")) {
      return { id: nameWithoutExt };
    }

    return null;
  }

  /**
   * Basic version validation
   */
  private isValidVersion(version: string): boolean {
    // Allow semantic versions, dates, or other common patterns
    return /^\d+[\d\.\-_a-zA-Z]*$/.test(version);
  }

  /**
   * Validate VSIX file structure (basic checks)
   */
  private async validateVsixFile(filePath: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Check if file is readable
      const buffer = await fs.readFile(filePath);

      // VSIX files are ZIP archives, check for ZIP signature
      if (buffer.length < 4) {
        return { isValid: false, error: "File too small" };
      }

      // ZIP files start with PK\x03\x04
      const zipSignature = buffer.readUInt32LE(0);
      if (zipSignature !== 0x04034b50) {
        return { isValid: false, error: "Not a valid ZIP archive (missing ZIP signature)" };
      }

      // Additional checks could include:
      // - Checking for [Content_Types].xml
      // - Validating extension manifest
      // But for now, basic ZIP signature check is sufficient

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Find best matching VSIX file for an extension ID
   */
  findBestMatchForExtension(
    vsixFiles: VsixFile[],
    extensionId: string,
    targetVersion?: string,
  ): VsixFile | null {
    // Filter by extension ID
    const matchingFiles = vsixFiles.filter((file) => file.extensionId === extensionId);

    if (matchingFiles.length === 0) {
      return null;
    }

    if (matchingFiles.length === 1) {
      return matchingFiles[0];
    }

    // Multiple matches - try to find version match
    if (targetVersion) {
      const versionMatch = matchingFiles.find((file) => file.version === targetVersion);
      if (versionMatch) {
        return versionMatch;
      }
    }

    // Return the most recently modified file
    return matchingFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];
  }

  /**
   * Group VSIX files by extension ID
   */
  groupByExtensionId(vsixFiles: VsixFile[]): Map<string, VsixFile[]> {
    const groups = new Map<string, VsixFile[]>();

    for (const file of vsixFiles) {
      if (file.extensionId) {
        const existing = groups.get(file.extensionId) || [];
        existing.push(file);
        groups.set(file.extensionId, existing);
      }
    }

    return groups;
  }

  /**
   * Get scan summary
   */
  getScanSummary(result: ScanResult): {
    total: number;
    valid: number;
    invalid: number;
    uniqueExtensions: number;
  } {
    const uniqueExtensions = new Set(
      result.validVsixFiles.map((f) => f.extensionId).filter(Boolean),
    ).size;

    return {
      total: result.totalFiles,
      valid: result.validVsixFiles.length,
      invalid: result.invalidFiles.length,
      uniqueExtensions,
    };
  }
}

// Global instance
let globalVsixScanner: VsixScannerService | null = null;

export function getVsixScanner(): VsixScannerService {
  if (!globalVsixScanner) {
    globalVsixScanner = new VsixScannerService();
  }
  return globalVsixScanner;
}
