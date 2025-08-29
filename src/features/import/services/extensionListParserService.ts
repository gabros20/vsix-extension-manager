import type { ExportFormat } from "../../../core/types";
import { validate, type ValidationContext } from "../../../core/validation";
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

  // Auto-detect format if not specified
  if (!format) {
    if (trimmedContent.startsWith("{") || trimmedContent.startsWith("[")) {
      format = "json";
    } else {
      format = "txt";
    }
  }

  const context: ValidationContext = {
    source: filePath,
    format,
    operation: "extension list parsing",
  };

  switch (format) {
    case "json":
      try {
        const parsed = JSON.parse(trimmedContent);

        // Try to validate as extension list
        const result = validate.extensionList(parsed, context);

        if (result.valid) {
          const data = result.data!;

          // Handle VS Code extensions.json format
          if (typeof data === "object" && "recommendations" in data) {
            return (data as VSCodeExtensionsJson).recommendations;
          }

          // Handle simple array of extension IDs
          if (Array.isArray(data)) {
            return data;
          }
        }

        // If validation failed, throw appropriate error
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

    case "txt":
      const lines = trimmedContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")); // Support comments

      // Validate each extension ID
      const invalidIds = lines.filter(
        (id) => !/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-]*$/.test(id),
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
        const result = validate.vscodeExtensionsJson(parsed, context);

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
