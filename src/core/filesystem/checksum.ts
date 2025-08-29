import crypto from "crypto";
import fs from "fs-extra";

/**
 * Generate SHA256 hash for a file
 */
export async function generateSHA256(filePath: string): Promise<string> {
  try {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  } catch (error) {
    throw new Error(
      `Failed to generate checksum: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Verify a file against a provided SHA256 hash
 */
export async function verifySHA256(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await generateSHA256(filePath);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  } catch (error) {
    throw new Error(
      `Failed to verify checksum: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Format hash for display (first 8 and last 8 characters)
 */
export function formatHashForDisplay(hash: string): string {
  if (hash.length <= 16) {
    return hash;
  }
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * Validate SHA256 hash format
 */
export function isValidSHA256(hash: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(hash);
}
