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
 * Find workspace extensions.json file
 */
export function findWorkspaceExtensionsJson(workspacePath?: string): string | null {
  const searchPath = workspacePath || process.cwd();
  const extensionsJsonPath = path.join(searchPath, ".vscode", "extensions.json");

  return fs.existsSync(extensionsJsonPath) ? extensionsJsonPath : null;
}
