import fs from "fs";
import path from "path";
import os from "os";
import type { ExportFormat, EditorType } from "../../../core/types";

export interface InstalledExtension {
  id: string;
  displayName: string;
  version: string;
  publisher: string;
  name: string;
  description?: string;
  repository?: {
    type: string;
    url: string;
  };
}

export interface VSCodeExtensionsJson {
  recommendations: string[];
  unwantedRecommendations?: string[];
}

/**
 * Get extensions directory path for the specified editor and platform
 */
export function getExtensionsPath(editor: EditorType = "auto"): string {
  if (editor === "auto") {
    // Check which editors are available, prefer Cursor if both exist
    const cursorPath = getExtensionsPathForEditor("cursor");
    const vscodePath = getExtensionsPathForEditor("vscode");

    if (fs.existsSync(cursorPath)) return cursorPath;
    if (fs.existsSync(vscodePath)) return vscodePath;

    // Default to Cursor if neither exists (most likely scenario for VSIX Extension Manager users)
    return cursorPath;
  }

  return getExtensionsPathForEditor(editor);
}

function getExtensionsPathForEditor(editor: "vscode" | "cursor"): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case "win32":
      return editor === "cursor"
        ? path.join(homeDir, ".cursor", "extensions")
        : path.join(homeDir, ".vscode", "extensions");
    case "darwin":
      return editor === "cursor"
        ? path.join(homeDir, ".cursor", "extensions")
        : path.join(homeDir, ".vscode", "extensions");
    case "linux":
    default:
      return editor === "cursor"
        ? path.join(homeDir, ".cursor", "extensions")
        : path.join(homeDir, ".vscode", "extensions");
  }
}

/**
 * Validate extension ID format (publisher.name)
 */
function isValidExtensionId(id: string): boolean {
  const extensionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-.]*$/;
  return extensionIdPattern.test(id);
}

/**
 * Read package.json from an extension directory
 * Handles corrupted JSON gracefully by logging and continuing
 */
function readExtensionPackageJson(extensionPath: string): InstalledExtension | null {
  try {
    const packageJsonPath = path.join(extensionPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    // Skip if this is not an extension directory (e.g., .DS_Store, .obsolete, etc.)
    if (path.basename(extensionPath).startsWith(".")) {
      return null;
    }

    const dirName = path.basename(extensionPath);
    let packageJson: unknown;

    try {
      const fileContent = fs.readFileSync(packageJsonPath, "utf-8");
      packageJson = JSON.parse(fileContent);
    } catch (parseError) {
      // Log corrupted package.json but continue processing other extensions
      console.warn(
        `[Export] Corrupted package.json in extension '${dirName}': ${parseError instanceof Error ? parseError.message : "Parse error"}`,
      );
      console.warn(`[Export] Skipping extension at: ${extensionPath}`);
      return null;
    }

    // Validate required fields exist
    if (!packageJson || typeof packageJson !== "object") {
      console.warn(`[Export] Invalid package.json structure in extension '${dirName}'`);
      return null;
    }

    // Type-guard: now we know packageJson is an object
    const pkgJson = packageJson as Record<string, unknown>;

    // Try to get extension ID from package.json first (most reliable)
    let extensionId: string;
    let publisher: string;
    let name: string;
    let version: string;

    if (
      typeof pkgJson.publisher === "string" &&
      pkgJson.publisher &&
      typeof pkgJson.name === "string" &&
      pkgJson.name
    ) {
      // Use package.json publisher and name (most reliable)
      publisher = pkgJson.publisher;
      name = pkgJson.name;
      extensionId = `${publisher}.${name}`;
      version = typeof pkgJson.version === "string" ? pkgJson.version : "unknown";
    } else {
      // Fallback to parsing directory name (publisher.name-version)
      const match = dirName.match(/^(.+)\.(.+)-(.+)$/);

      if (!match) {
        console.warn(
          `[Export] Could not extract extension ID from directory '${dirName}' and package.json is missing publisher/name`,
        );
        return null;
      }

      [, publisher, name, version] = match;
      extensionId = `${publisher}.${name}`;
    }

    // Validate the extension ID format
    if (!isValidExtensionId(extensionId)) {
      console.warn(`[Export] Invalid extension ID format: ${extensionId} (from ${dirName})`);
      return null;
    }

    return {
      id: extensionId,
      displayName:
        (typeof pkgJson.displayName === "string" ? pkgJson.displayName : null) ||
        (typeof pkgJson.name === "string" ? pkgJson.name : null) ||
        name,
      version,
      publisher,
      name,
      description: typeof pkgJson.description === "string" ? pkgJson.description : undefined,
      repository:
        pkgJson.repository &&
        typeof pkgJson.repository === "object" &&
        pkgJson.repository !== null &&
        "type" in pkgJson.repository &&
        "url" in pkgJson.repository
          ? (pkgJson.repository as { type: string; url: string })
          : undefined,
    };
  } catch (error) {
    // Catch any other unexpected errors
    console.warn(
      `[Export] Unexpected error reading extension at ${extensionPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return null;
  }
}

/**
 * Scan extensions directory and return installed extensions
 */
export async function getInstalledExtensions(
  editor: EditorType = "auto",
): Promise<InstalledExtension[]> {
  const extensionsPath = getExtensionsPath(editor);
  const editorName =
    editor === "auto"
      ? fs.existsSync(path.join(os.homedir(), ".cursor", "extensions"))
        ? "Cursor"
        : "VS Code"
      : editor === "cursor"
        ? "Cursor"
        : "VS Code";

  if (!fs.existsSync(extensionsPath)) {
    throw new Error(`${editorName} extensions directory not found: ${extensionsPath}`);
  }

  const extensions: InstalledExtension[] = [];
  const entries = fs.readdirSync(extensionsPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const extensionPath = path.join(extensionsPath, entry.name);
      const extension = readExtensionPackageJson(extensionPath);

      if (extension) {
        extensions.push(extension);
      }
    }
  }

  // Sort by publisher.name for consistent output
  return extensions.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Format extensions for different output formats
 */
export function formatExtensions(extensions: InstalledExtension[], format: ExportFormat): string {
  switch (format) {
    case "txt":
      return extensions.map((ext) => ext.id).join("\n");

    case "extensions.json": {
      // Filter out invalid extension IDs and get valid ones
      const validExtensions = extensions.filter((ext) => isValidExtensionId(ext.id));
      const recommendations = validExtensions.map((ext) => ext.id);

      const extensionsJson: VSCodeExtensionsJson = {
        recommendations,
      };
      return JSON.stringify(extensionsJson, null, 2);
    }

    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Get export statistics for validation reporting
 */
export function getExportStats(extensions: InstalledExtension[]): {
  total: number;
  valid: number;
  invalid: number;
  invalidIds: string[];
} {
  const validExtensions = extensions.filter((ext) => isValidExtensionId(ext.id));
  const invalidExtensions = extensions.filter((ext) => !isValidExtensionId(ext.id));

  return {
    total: extensions.length,
    valid: validExtensions.length,
    invalid: invalidExtensions.length,
    invalidIds: invalidExtensions.map((ext) => ext.id),
  };
}

/**
 * Find workspace extensions.json file
 */
export function findWorkspaceExtensionsJson(workspacePath?: string): string | null {
  const searchPath = workspacePath || process.cwd();
  const extensionsJsonPath = path.join(searchPath, ".vscode", "extensions.json");

  return fs.existsSync(extensionsJsonPath) ? extensionsJsonPath : null;
}
