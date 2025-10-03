import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

/**
 * Create download directory if it doesn't exist
 * @param outputPath - Path to create
 * @param baseDir - Optional base directory to restrict access to
 */
export async function createDownloadDirectory(
  outputPath: string,
  baseDir?: string,
): Promise<string> {
  try {
    const absolutePath = path.resolve(outputPath);

    // Validate path to prevent traversal attacks
    if (!isValidPath(absolutePath, baseDir)) {
      throw new Error(`Invalid or unsafe path: ${outputPath}`);
    }

    // Check if path exists
    const exists = await fs.pathExists(absolutePath);

    if (!exists) {
      await fs.ensureDir(absolutePath);
    } else {
      // Check if it's actually a directory
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error(`Path exists but is not a directory: ${absolutePath}`);
      }
    }

    return absolutePath;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
    throw new Error("Failed to create directory");
  }
}

/**
 * Check if file already exists and prompt for overwrite
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats if file exists
 */
export async function getFileInfo(
  filePath: string,
): Promise<{ size: number; modified: Date } | null> {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Clean filename to be filesystem safe while preserving valid Unicode
 * Uses Unicode normalization to handle combining characters properly
 */
export function sanitizeFilename(filename: string): string {
  // Normalize Unicode to composed form (NFC) to handle combining characters
  let normalized = filename.normalize("NFC");

  // Remove or replace filesystem-invalid characters only
  // Preserves valid Unicode characters (e.g., Japanese, Chinese, Arabic)
  normalized = normalized
    .replace(/[<>:"/\\|?*]/g, "_") // Invalid on Windows/Linux
    .replace(/[\x00-\x1F\x7F]/g, "_") // Control characters
    .replace(/^\.+/, "_") // Leading dots (hidden files)
    .replace(/\s+/g, "_") // Whitespace to underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // Trim underscores

  // Ensure filename isn't empty after sanitization
  if (normalized.length === 0) {
    return "untitled";
  }

  // Handle Windows reserved names (CON, PRN, AUX, etc.)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reservedNames.test(normalized)) {
    normalized = `_${normalized}`;
  }

  return normalized;
}

/**
 * Generate unique filename if file already exists
 * Uses timestamp + random suffix for O(1) performance instead of sequential counter
 */
export async function generateUniqueFilename(directory: string, filename: string): Promise<string> {
  const { name, ext } = path.parse(filename);

  // Check if original filename is available
  if (!(await checkFileExists(path.join(directory, filename)))) {
    return filename;
  }

  // Generate unique filename with timestamp + random suffix
  // This is O(1) instead of O(n) with sequential counter
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(3).toString("hex"); // 6 hex chars
  const newFilename = `${name}_${timestamp}_${randomSuffix}${ext}`;

  return newFilename;
}

/**
 * Validate directory path and prevent path traversal attacks
 * @param dirPath - Path to validate
 * @param baseDir - Optional base directory to restrict access to (defaults to cwd)
 */
export function isValidPath(dirPath: string, baseDir?: string): boolean {
  try {
    const resolved = path.resolve(dirPath);

    // Check for empty path
    if (!resolved || resolved.length === 0) {
      return false;
    }

    // If base directory specified, ensure resolved path is within it
    if (baseDir) {
      const resolvedBase = path.resolve(baseDir);
      const relative = path.relative(resolvedBase, resolved);

      // Path is invalid if it starts with ".." or is absolute (outside base)
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * File existence handling strategy
 */
export enum FileExistsAction {
  SKIP = "skip",
  OVERWRITE = "overwrite",
  PROMPT = "prompt",
  ERROR = "error",
}

/**
 * Handle file existence based on strategy
 * Returns true if download should proceed, false if it should be skipped
 */
export async function handleFileExists(
  filePath: string,
  action: FileExistsAction,
  promptCallback?: () => Promise<boolean>,
): Promise<boolean> {
  const exists = await checkFileExists(filePath);

  if (!exists) {
    return true; // File doesn't exist, proceed with download
  }

  switch (action) {
    case FileExistsAction.SKIP:
      return false; // Skip download

    case FileExistsAction.OVERWRITE:
      return true; // Proceed with download (will overwrite)

    case FileExistsAction.PROMPT:
      if (promptCallback) {
        return await promptCallback();
      }
      // Fall back to overwrite if no prompt callback
      return true;

    case FileExistsAction.ERROR:
      throw new Error(`File already exists: ${filePath}`);

    default:
      return true;
  }
}

/**
 * Determine output directory, preferring cache directory over regular output
 */
export function resolveOutputDirectory(cacheDir?: string, outputDir?: string): string {
  if (cacheDir && cacheDir.trim()) {
    return cacheDir.trim();
  }

  if (outputDir && outputDir.trim()) {
    return outputDir.trim();
  }

  return "./downloads";
}
