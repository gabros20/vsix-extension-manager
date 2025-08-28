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
