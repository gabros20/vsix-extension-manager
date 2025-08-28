import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";

/**
 * Download a file from URL to the specified directory
 */
export async function downloadFile(
  url: string,
  outputDir: string,
  filename: string,
): Promise<string> {
  try {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    const filePath = path.join(outputDir, filename);

    // Create axios instance with response type stream
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 30000, // 30 second timeout
      headers: {
        "User-Agent": "vsix-downloader/1.0.0",
      },
    });

    // Check if the request was successful
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to download file`);
    }

    // Create write stream
    const writeStream = fs.createWriteStream(filePath);

    // Pipe the response data to file
    await pipeline(response.data, writeStream);

    // Verify file was created and has content
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      await fs.remove(filePath);
      throw new Error("Downloaded file is empty");
    }

    return filePath;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error("Extension version not found. Please check the version number.");
      } else if (error.response?.status === 403) {
        throw new Error("Access denied. The extension might be private or unavailable.");
      } else if (error.code === "ECONNABORTED") {
        throw new Error("Download timeout. Please try again.");
      } else {
        throw new Error(`Download failed: ${error.message}`);
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unknown download error occurred");
  }
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Validate if URL is accessible
 */
export async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      headers: {
        "User-Agent": "vsix-downloader/1.0.0",
      },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
