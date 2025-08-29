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
        // Accept 3 JSON shapes:
        // 1) VS Code workspace: { recommendations: string[] }
        // 2) Array<string>: ["publisher.extension", ...]
        // 3) Array<object> with { id: string, ... } (our detailed export)

        // 3) Array<object> with id
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
          const ids = (parsed as Array<Record<string, unknown>>)
            .map((o) => (typeof o.id === "string" ? (o.id as string) : undefined))
            .filter((v): v is string => typeof v === "string");
          if (ids.length > 0) {
            const check = validate.extensionList(ids);
            if (check.valid && Array.isArray(check.data)) {
              return check.data as string[];
            }
          }
        }

        // Validate as extension list or workspace
        const result = validate.extensionList(parsed);
        if (result.valid) {
          const data = result.data!;
          if (typeof data === "object" && "recommendations" in data) {
            return (data as VSCodeExtensionsJson).recommendations;
          }
          if (Array.isArray(data)) {
            return data;
          }
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
