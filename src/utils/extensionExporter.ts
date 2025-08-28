import fs from "fs";
import path from "path";
import os from "os";

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

export type ExportFormat = "json" | "txt" | "extensions.json";

export type EditorType = "vscode" | "cursor" | "auto";

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

    // Default to Cursor if neither exists (most likely scenario for this tool's users)
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
 * Read package.json from an extension directory
 */
function readExtensionPackageJson(extensionPath: string): InstalledExtension | null {
  try {
    const packageJsonPath = path.join(extensionPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    // Parse extension ID from directory name (publisher.name-version)
    const dirName = path.basename(extensionPath);
    const match = dirName.match(/^(.+)\.(.+)-(.+)$/);

    if (!match) {
      return null;
    }

    const [, publisher, name, version] = match;

    return {
      id: `${publisher}.${name}`,
      displayName: packageJson.displayName || packageJson.name || name,
      version,
      publisher,
      name,
      description: packageJson.description,
      repository: packageJson.repository,
    };
  } catch {
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
    case "json":
      return JSON.stringify(extensions, null, 2);

    case "txt":
      return extensions.map((ext) => ext.id).join("\n");

    case "extensions.json": {
      const recommendations = extensions.map((ext) => ext.id);
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
 * Parse extensions from different input formats
 */
export function parseExtensionsList(content: string, format?: ExportFormat): string[] {
  const trimmedContent = content.trim();

  // Auto-detect format if not specified
  if (!format) {
    if (trimmedContent.startsWith("{") || trimmedContent.startsWith("[")) {
      format = "json";
    } else {
      format = "txt";
    }
  }

  switch (format) {
    case "json":
      try {
        const parsed = JSON.parse(trimmedContent);

        // Handle VS Code extensions.json format
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          return parsed.recommendations;
        }

        // Handle array of extension IDs
        if (Array.isArray(parsed)) {
          return parsed;
        }

        // Handle array of extension objects
        if (Array.isArray(parsed) && parsed[0]?.id) {
          return parsed.map((ext: { id: string }) => ext.id);
        }

        throw new Error("Invalid JSON format");
      } catch (error) {
        throw new Error(
          `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

    case "txt":
      return trimmedContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")); // Support comments

    case "extensions.json":
      try {
        const parsed = JSON.parse(trimmedContent) as VSCodeExtensionsJson;
        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
          throw new Error("Invalid extensions.json format: missing recommendations array");
        }
        return parsed.recommendations;
      } catch (error) {
        throw new Error(
          `Failed to parse extensions.json: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Find workspace extensions.json file
 */
export function findWorkspaceExtensionsJson(workspacePath?: string): string | null {
  const searchPath = workspacePath || process.cwd();
  const extensionsJsonPath = path.join(searchPath, ".vscode", "extensions.json");

  return fs.existsSync(extensionsJsonPath) ? extensionsJsonPath : null;
}
