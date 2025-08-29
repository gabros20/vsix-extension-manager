import type { ExportFormat } from "../../../core/types";

export interface VSCodeExtensionsJson {
  recommendations: string[];
  unwantedRecommendations?: string[];
}

/**
 * Parse extensions from different input formats for importing/installing
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
