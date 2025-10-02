/**
 * Smart input type detection for the unified 'add' command
 * Determines whether input is URL, file, directory, list, or extension ID
 */

import * as fs from "fs-extra";
import * as path from "path";
import { UserInputError } from "../../core/errors";

/**
 * Input types supported by the add command
 */
export type InputType = "url" | "vsix-file" | "vsix-directory" | "extension-list" | "extension-id";

/**
 * Detection result with type and metadata
 */
export interface DetectionResult {
  type: InputType;
  value: string;
  metadata?: {
    fileCount?: number;
    isJson?: boolean;
    isTxt?: boolean;
  };
}

/**
 * Input detector service
 */
export class InputDetector {
  /**
   * Detect the type of input provided
   * @param input - User input string
   * @returns Detection result
   */
  async detectInputType(input: string): Promise<DetectionResult> {
    // Priority 1: URL detection (marketplace or open-vsx)
    if (this.isUrl(input)) {
      return {
        type: "url",
        value: input,
      };
    }

    // Priority 2: File system paths (if they exist)
    if (await fs.pathExists(input)) {
      const stats = await fs.stat(input);

      if (stats.isFile()) {
        const ext = path.extname(input).toLowerCase();

        // VSIX file
        if (ext === ".vsix") {
          return {
            type: "vsix-file",
            value: input,
          };
        }

        // Extension list file (JSON or TXT)
        if (ext === ".json" || ext === ".txt") {
          const isJson = ext === ".json";
          return {
            type: "extension-list",
            value: input,
            metadata: {
              isJson,
              isTxt: !isJson,
            },
          };
        }

        throw new UserInputError(`Unsupported file type: ${ext}. Expected .vsix, .json, or .txt`);
      }

      // Directory containing VSIX files
      if (stats.isDirectory()) {
        const files = await fs.readdir(input);
        const vsixFiles = files.filter((f) => path.extname(f).toLowerCase() === ".vsix");

        if (vsixFiles.length === 0) {
          throw new UserInputError(`No VSIX files found in directory: ${input}`);
        }

        return {
          type: "vsix-directory",
          value: input,
          metadata: {
            fileCount: vsixFiles.length,
          },
        };
      }
    }

    // Priority 3: Extension ID pattern (publisher.name)
    if (this.isExtensionId(input)) {
      return {
        type: "extension-id",
        value: input,
      };
    }

    // Unable to determine type
    throw new UserInputError(
      `Unable to determine input type for: ${input}\n` +
        `Expected one of:\n` +
        `  - Marketplace/OpenVSX URL\n` +
        `  - Extension ID (publisher.name)\n` +
        `  - Path to .vsix file\n` +
        `  - Path to directory with .vsix files\n` +
        `  - Path to extension list (.json or .txt)`,
    );
  }

  /**
   * Check if input is a URL
   */
  private isUrl(input: string): boolean {
    try {
      const url = new URL(input);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        (url.hostname.includes("marketplace.visualstudio.com") ||
          url.hostname.includes("open-vsx.org") ||
          url.hostname.includes("vscode.dev"))
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if input matches extension ID pattern (publisher.name)
   */
  private isExtensionId(input: string): boolean {
    // Pattern: lowercase alphanumeric + hyphens, dot separator
    // Example: ms-python.python, dbaeumer.vscode-eslint
    const pattern = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i;
    return pattern.test(input);
  }
}

/**
 * Singleton instance
 */
export const inputDetector = new InputDetector();
