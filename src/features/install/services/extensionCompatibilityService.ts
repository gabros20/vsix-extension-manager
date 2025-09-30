import axios from "axios";
import { DEFAULT_USER_AGENT } from "../../../config/constants";
import { getEditorService } from "./editorCliService";

export interface ExtensionMetadata {
  id: string;
  name: string;
  publisher: string;
  version: string;
  engine?: {
    vscode?: string;
  };
  engines?: {
    vscode?: string;
  };
  displayName?: string;
  description?: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  editorVersion: string;
  requiredVersion?: string;
  reason?: string;
  severity: "error" | "warning" | "info";
}

export interface CompatibilityCheckResult {
  extensionId: string;
  version: string;
  compatible: boolean;
  result: CompatibilityResult;
  metadata?: ExtensionMetadata;
}

/**
 * Service for checking extension compatibility with VS Code/Cursor versions
 */
export class ExtensionCompatibilityService {
  private editorService = getEditorService();

  /**
   * Get detailed extension metadata from Marketplace API
   */
  async getExtensionMetadata(
    extensionId: string,
    version: string,
    source: "marketplace" | "open-vsx" = "marketplace",
  ): Promise<ExtensionMetadata | null> {
    try {
      if (source === "marketplace") {
        return await this.getMarketplaceMetadata(extensionId, version);
      } else {
        return await this.getOpenVsxMetadata(extensionId, version);
      }
    } catch (error) {
      console.warn(`Failed to fetch metadata for ${extensionId}:`, error);
      return null;
    }
  }

  /**
   * Get extension metadata from VS Code Marketplace
   */
  private async getMarketplaceMetadata(
    extensionId: string,
    version: string,
  ): Promise<ExtensionMetadata | null> {
    const url =
      "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1";

    const body = {
      filters: [
        {
          criteria: [
            { filterType: 7, value: extensionId }, // exact match on publisher.extension
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: 103, // Include version properties and metadata
    };

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json;api-version=3.0-preview.1",
      "User-Agent": DEFAULT_USER_AGENT,
    };

    const response = await axios.post(url, body, { headers });
    const results = (response.data?.results ?? [])[0];
    const ext = results?.extensions?.[0];

    if (!ext) {
      return null;
    }

    // Find the specific version in the versions array
    const versionInfo = ext.versions?.find((v: { version: string }) => v.version === version);
    if (!versionInfo) {
      // If exact version not found, use the latest version
      const latestVersion = ext.versions?.[0];
      if (!latestVersion) {
        return null;
      }

      // Try to fetch engine requirements from manifest
      const engineRequirements = await this.fetchEngineRequirements(latestVersion);

      return {
        id: extensionId,
        name: ext.extensionName || ext.displayName || extensionId.split(".")[1],
        publisher: ext.publisher?.publisherName || extensionId.split(".")[0],
        version: latestVersion.version,
        engine: engineRequirements,
        engines: engineRequirements ? { vscode: engineRequirements.vscode } : undefined,
        displayName: ext.displayName,
        description: ext.shortDescription,
      };
    }

    // Try to fetch engine requirements from manifest
    const engineRequirements = await this.fetchEngineRequirements(versionInfo);

    return {
      id: extensionId,
      name: ext.extensionName || ext.displayName || extensionId.split(".")[1],
      publisher: ext.publisher?.publisherName || extensionId.split(".")[0],
      version: versionInfo.version,
      engine: engineRequirements,
      engines: engineRequirements ? { vscode: engineRequirements.vscode } : undefined,
      displayName: ext.displayName,
      description: ext.shortDescription,
    };
  }

  /**
   * Fetch engine requirements from extension manifest
   */
  private async fetchEngineRequirements(versionInfo: {
    files?: Array<{ assetType: string; source: string }>;
  }): Promise<{ vscode: string } | undefined> {
    try {
      // Find the manifest file URL
      const manifestFile = versionInfo.files?.find(
        (f: { assetType: string; source: string }) =>
          f.assetType === "Microsoft.VisualStudio.Code.Manifest",
      );

      if (!manifestFile?.source) {
        return undefined;
      }

      // Fetch the manifest
      const manifestResponse = await axios.get(manifestFile.source, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        timeout: 10000,
      });

      const manifest = manifestResponse.data;
      if (manifest?.engines?.vscode) {
        return { vscode: manifest.engines.vscode };
      }

      return undefined;
    } catch {
      // Silently fail - engine requirements are optional
      return undefined;
    }
  }

  /**
   * Get extension metadata from OpenVSX
   */
  private async getOpenVsxMetadata(
    extensionId: string,
    version: string,
  ): Promise<ExtensionMetadata | null> {
    const [publisher, extension] = extensionId.split(".");
    const url = `https://open-vsx.org/api/${publisher}/${extension}/${version}`;
    const headers = {
      Accept: "application/json",
      "User-Agent": DEFAULT_USER_AGENT,
    };

    const response = await axios.get(url, { headers });
    const data = response.data;

    if (!data) {
      return null;
    }

    return {
      id: extensionId,
      name: data.name || extension,
      publisher: data.namespace || publisher,
      version: data.version,
      engine: data.engines?.vscode ? { vscode: data.engines.vscode } : undefined,
      engines: data.engines,
      displayName: data.displayName,
      description: data.description,
    };
  }

  /**
   * Get current editor version
   */
  async getEditorVersion(binaryPath: string): Promise<string> {
    return await this.editorService.getEditorVersion(binaryPath);
  }

  /**
   * Check if an extension version is compatible with the current editor
   */
  async checkCompatibility(
    extensionId: string,
    version: string,
    binaryPath: string,
    source: "marketplace" | "open-vsx" = "marketplace",
  ): Promise<CompatibilityCheckResult> {
    try {
      // Get editor version
      const editorVersion = await this.getEditorVersion(binaryPath);
      const editorVersionClean = this.cleanVersion(editorVersion);

      // Get extension metadata
      const metadata = await this.getExtensionMetadata(extensionId, version, source);

      if (!metadata) {
        return {
          extensionId,
          version,
          compatible: true, // Assume compatible if we can't check
          result: {
            compatible: true,
            editorVersion: editorVersionClean,
            reason: "Could not fetch extension metadata",
            severity: "warning",
          },
        };
      }

      // Check engine compatibility
      const engineRequirement = metadata.engine?.vscode || metadata.engines?.vscode;
      if (!engineRequirement) {
        return {
          extensionId,
          version,
          compatible: true,
          result: {
            compatible: true,
            editorVersion: editorVersionClean,
            reason: "No engine requirements specified",
            severity: "info",
          },
          metadata,
        };
      }

      // Parse and compare versions
      const isCompatible = this.compareVersions(editorVersionClean, engineRequirement);

      return {
        extensionId,
        version,
        compatible: isCompatible,
        result: {
          compatible: isCompatible,
          editorVersion: editorVersionClean,
          requiredVersion: engineRequirement,
          reason: isCompatible
            ? `Compatible with VS Code ${engineRequirement}+`
            : `Requires VS Code ${engineRequirement}+, but editor is ${editorVersionClean}`,
          severity: isCompatible ? "info" : "error",
        },
        metadata,
      };
    } catch (error) {
      return {
        extensionId,
        version,
        compatible: true, // Assume compatible on error
        result: {
          compatible: true,
          editorVersion: "unknown",
          reason: `Compatibility check failed: ${error instanceof Error ? error.message : String(error)}`,
          severity: "warning",
        },
      };
    }
  }

  /**
   * Check compatibility for multiple extensions
   */
  async checkBulkCompatibility(
    extensions: Array<{ id: string; version: string; source?: "marketplace" | "open-vsx" }>,
    binaryPath: string,
  ): Promise<CompatibilityCheckResult[]> {
    const results: CompatibilityCheckResult[] = [];

    for (const ext of extensions) {
      try {
        const result = await this.checkCompatibility(
          ext.id,
          ext.version,
          binaryPath,
          ext.source || "marketplace",
        );
        results.push(result);
      } catch (error) {
        results.push({
          extensionId: ext.id,
          version: ext.version,
          compatible: true,
          result: {
            compatible: true,
            editorVersion: "unknown",
            reason: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
            severity: "warning",
          },
        });
      }
    }

    return results;
  }

  /**
   * Clean version string to extract just the version number
   */
  private cleanVersion(version: string): string {
    // Remove common prefixes and suffixes
    return version
      .replace(/^v/i, "") // Remove 'v' prefix
      .replace(/\s.*$/, "") // Remove everything after first space
      .replace(/[^\d.]/g, "") // Keep only digits and dots
      .split(".")
      .slice(0, 3) // Take only major.minor.patch
      .join(".");
  }

  /**
   * Compare editor version with required version
   */
  private compareVersions(editorVersion: string, requiredVersion: string): boolean {
    try {
      const editor = this.parseVersion(editorVersion);
      const required = this.parseVersion(requiredVersion);

      if (!editor || !required) {
        return true; // Assume compatible if we can't parse
      }

      // Compare major.minor.patch
      if (editor.major !== required.major) {
        return editor.major > required.major;
      }
      if (editor.minor !== required.minor) {
        return editor.minor > required.minor;
      }
      return editor.patch >= required.patch;
    } catch {
      return true; // Assume compatible if comparison fails
    }
  }

  /**
   * Parse version string into major.minor.patch
   */
  private parseVersion(version: string): { major: number; minor: number; patch: number } | null {
    const parts = version.split(".").map((p) => parseInt(p, 10));
    if (parts.length < 3 || parts.some((p) => isNaN(p))) {
      return null;
    }
    return {
      major: parts[0],
      minor: parts[1],
      patch: parts[2],
    };
  }
}

// Global instance
let globalCompatibilityService: ExtensionCompatibilityService | null = null;

export function getExtensionCompatibilityService(): ExtensionCompatibilityService {
  if (!globalCompatibilityService) {
    globalCompatibilityService = new ExtensionCompatibilityService();
  }
  return globalCompatibilityService;
}
