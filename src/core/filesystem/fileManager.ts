import fs from "fs-extra";
import path from "path";

/**
 * Create download directory if it doesn't exist
 */
export async function createDownloadDirectory(outputPath: string): Promise<string> {
  try {
    const absolutePath = path.resolve(outputPath);

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
 * Clean filename to be filesystem safe
 */
export function sanitizeFilename(filename: string): string {
  // Remove or replace invalid characters
  return filename
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generate unique filename if file already exists
 */
export async function generateUniqueFilename(directory: string, filename: string): Promise<string> {
  const { name, ext } = path.parse(filename);
  let counter = 1;
  let newFilename = filename;

  while (await checkFileExists(path.join(directory, newFilename))) {
    newFilename = `${name}_${counter}${ext}`;
    counter++;
  }

  return newFilename;
}

/**
 * Validate directory path
 */
export function isValidPath(dirPath: string): boolean {
  try {
    const resolved = path.resolve(dirPath);
    // Basic validation - check if it's a reasonable path
    return resolved.length > 0 && !resolved.includes("..".repeat(10));
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
