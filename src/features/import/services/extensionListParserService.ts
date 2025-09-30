import type { ExportFormat } from "../../../core/types";
import { validate } from "../../../core/validation";
import { ParsingErrors } from "../../../core/errors";

export interface VSCodeExtensionsJson {
  recommendations: string[];
  unwantedRecommendations?: string[];
}

export interface ParseResult {
  validIds: string[];
  invalidIds: string[];
  skippedIds: string[];
  duplicates: string[];
}

/**
 * Parse extensions with detailed reporting of invalid/skipped IDs
 */
export function parseExtensionsListDetailed(
  content: string,
  format?: ExportFormat,
  filePath?: string,
): ParseResult {
  const result: ParseResult = {
    validIds: [],
    invalidIds: [],
    skippedIds: [],
    duplicates: [],
  };

  const trimmedContent = content.trim();

  // Disallow JSON arrays of IDs
  if (!format && trimmedContent.startsWith("[")) {
    throw ParsingErrors.invalidJson(
      filePath || "input",
      "JSON arrays of IDs are no longer supported; use txt or extensions.json",
    );
  }

  // Auto-detect format
  if (!format) {
    if (trimmedContent.startsWith("{") && trimmedContent.includes("recommendations")) {
      format = "extensions.json";
    } else {
      format = "txt";
    }
  }

  let allIds: string[] = [];

  switch (format) {
    case "txt":
      allIds = trimmedContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      break;

    case "extensions.json":
      try {
        const parsed = JSON.parse(trimmedContent);
        const validationResult = validate.vscodeExtensionsJson(parsed);

        if (validationResult.valid) {
          allIds = validationResult.data!.recommendations;
        } else {
          const errorDetails = validationResult.errors.map((err) => err.message).join(", ");
          throw ParsingErrors.invalidJson(filePath || "input", errorDetails);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ParsingError") {
          throw error;
        }
        throw ParsingErrors.invalidJson(
          filePath || "input",
          error instanceof Error ? error.message : String(error),
        );
      }
      break;

    default:
      throw new Error(`Unknown format: ${format}`);
  }

  // Normalize and validate each ID
  const seen = new Set<string>();
  const extensionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-.]*$/;

  for (const rawId of allIds) {
    // Normalize: strip version numbers and platform suffixes
    let normalized = rawId;

    // Remove version patterns: -1.2.3, -2025.8.0, etc.
    normalized = normalized.replace(/-\d+\.\d+\.\d+(-\w+)?$/, "");

    // Remove platform suffixes: -darwin, -darwin-arm64, -linux, -win32, -universal
    normalized = normalized.replace(/-(darwin|linux|win32|universal)(-arm64|-x64)?$/, "");

    // Check if ID changed during normalization
    if (normalized !== rawId) {
      result.skippedIds.push(`${rawId} → ${normalized}`);
    }

    // Validate normalized ID
    if (!extensionIdPattern.test(normalized)) {
      result.invalidIds.push(rawId);
      continue;
    }

    // Check for duplicates
    if (seen.has(normalized)) {
      result.duplicates.push(normalized);
      continue;
    }

    seen.add(normalized);
    result.validIds.push(normalized);
  }

  return result;
}

/**
 * Parse extensions from different input formats for importing/installing
 * (Backward compatible - returns only valid IDs)
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
