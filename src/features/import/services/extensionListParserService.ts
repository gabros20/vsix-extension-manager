import type { ExportFormat } from "../../../core/types";
import { validate } from "../../../core/validation";
import { ParsingErrors } from "../../../core/errors";

export interface VSCodeExtensionsJson {
  recommendations: string[];
  unwantedRecommendations?: string[];
}

/**
 * Parse extensions from different input formats for importing/installing
 */
export function parseExtensionsList(
  content: string,
  format?: ExportFormat,
  filePath?: string,
): string[] {
  const trimmedContent = content.trim();

  // Disallow JSON arrays of IDs; only txt or VS Code extensions.json are supported
  if (!format && trimmedContent.startsWith("[")) {
    throw ParsingErrors.invalidJson(
      filePath || "input",
      "JSON arrays of IDs are no longer supported; use txt or extensions.json",
    );
  }

  // Auto-detect format if not specified (json arrays no longer supported)
  if (!format) {
    if (trimmedContent.startsWith("{") && trimmedContent.includes("recommendations")) {
      format = "extensions.json";
    } else {
      format = "txt";
    }
  }

  switch (format) {
    case "txt":
      const lines = trimmedContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")); // Support comments

      // Validate each extension ID (allow dots in extension segment)
      const invalidIds = lines.filter(
        (id) => !/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-.]*$/.test(id),
      );
      if (invalidIds.length > 0) {
        throw ParsingErrors.missingFields(filePath || "input", [
          `Invalid extension IDs: ${invalidIds.join(", ")}`,
        ]);
      }

      return lines;

    case "extensions.json":
      try {
        const parsed = JSON.parse(trimmedContent);
        const result = validate.vscodeExtensionsJson(parsed);

        if (result.valid) {
          return result.data!.recommendations;
        }

        const errorDetails = result.errors.map((err) => err.message).join(", ");
        throw ParsingErrors.invalidJson(filePath || "input", errorDetails);
      } catch (error) {
        if (error instanceof Error && error.name === "ParsingError") {
          throw error;
        }
        throw ParsingErrors.invalidJson(
          filePath || "input",
          error instanceof Error ? error.message : String(error),
        );
      }

    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
