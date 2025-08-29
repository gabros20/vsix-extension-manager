// JSON Schema validation service for VSIX Extension Manager

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import {
  schemas,
  type BulkExtensionItem,
  type VSCodeExtensionsJson,
  type ConfigurationFile,
} from "./schemas";
import { ValidationError } from "../errors";

/**
 * Validation result interface
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors: ValidationErrorInfo[];
}

/**
 * Detailed validation error information
 */
export interface ValidationErrorInfo {
  path: string;
  message: string;
  value?: unknown;
  schema?: string;
}

/**
 * Validation context for better error messages
 */
export interface ValidationContext {
  source?: string; // Source of data (file path, URL, etc.)
  format?: string; // Expected format (json, yaml, etc.)
  operation?: string; // What operation is being validated for
}

/** AJV error subset we care about */
interface AjvErrorLite {
  instancePath?: string;
  schemaPath?: string;
  message?: string;
  data?: unknown;
}

/**
 * Schema validator service
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction<unknown>> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true, // Report all validation errors
      verbose: true, // Include schema and data in errors
      strict: false, // Allow unknown formats
      removeAdditional: false, // Don't modify original data
    });

    // Add format validation support
    addFormats(this.ajv);

    // Add custom formats
    this.addCustomFormats();

    // Compile all schemas
    this.compileSchemas();
  }

  /**
   * Add custom format validators
   */
  private addCustomFormats(): void {
    // Extension ID format
    this.ajv.addFormat("extension-id", {
      type: "string",
      validate: (data: string) =>
        /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z0-9][a-zA-Z0-9\-]*$/.test(data),
    });

    // Semantic version format
    this.ajv.addFormat("semver", {
      type: "string",
      validate: (data: string) => {
        if (data === "latest") return true;
        return /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?$/.test(data);
      },
    });

    // Extension URL format
    this.ajv.addFormat("extension-url", {
      type: "string",
      validate: (data: string) => {
        try {
          const url = new URL(data);
          return (
            url.hostname.includes("marketplace.visualstudio.com") ||
            url.hostname.includes("open-vsx.org")
          );
        } catch {
          return false;
        }
      },
    });

    // Filename template format
    this.ajv.addFormat("filename-template", {
      type: "string",
      validate: (data: string) => {
        // Must contain at least {name} or {version}
        return data.includes("{name}") || data.includes("{version}");
      },
    });
  }

  /**
   * Compile all schemas for faster validation
   */
  private compileSchemas(): void {
    Object.entries(schemas).forEach(([name, schema]) => {
      try {
        const validator = this.ajv.compile(schema as object) as ValidateFunction<unknown>;
        this.validators.set(name, validator);
      } catch (error) {
        console.warn(`Failed to compile schema ${name}:`, error);
      }
    });
  }

  /**
   * Validate bulk extensions file (array format)
   */
  validateBulkExtensionsArray(data: unknown): ValidationResult<BulkExtensionItem[]> {
    const result = this.validate<BulkExtensionItem[]>("bulkExtensionsArray", data);
    return result;
  }

  /**
   * Validate bulk extensions file (object format)
   */
  validateBulkExtensionsObject(
    data: unknown,
  ): ValidationResult<{ extensions: BulkExtensionItem[] }> {
    const result = this.validate<{ extensions: BulkExtensionItem[] }>("bulkExtensionsObject", data);
    return result;
  }

  /**
   * Validate VS Code extensions.json format
   */
  validateVSCodeExtensionsJson(data: unknown): ValidationResult<VSCodeExtensionsJson> {
    const result = this.validate<VSCodeExtensionsJson>("vscodeExtensionsJson", data);
    return result;
  }

  /**
   * Validate extension list (simple array)
   */
  validateExtensionListArray(data: unknown): ValidationResult<string[]> {
    const result = this.validate<string[]>("extensionListArray", data);
    return result;
  }

  /**
   * Validate configuration file
   */
  validateConfiguration(data: unknown): ValidationResult<ConfigurationFile> {
    const result = this.validate<ConfigurationFile>("configuration", data);
    return result;
  }

  /**
   * Auto-detect and validate bulk file format
   */
  validateBulkFile(
    data: unknown,
  ): ValidationResult<BulkExtensionItem[] | { extensions: BulkExtensionItem[] }> {
    // Try array format first
    const arrayResult = this.validateBulkExtensionsArray(data);
    if (arrayResult.valid) {
      return arrayResult;
    }

    // Try object format
    const objectResult = this.validateBulkExtensionsObject(data);
    if (objectResult.valid) {
      return objectResult;
    }

    // Return combined errors
    return {
      valid: false,
      errors: [
        ...arrayResult.errors.map((err) => ({ ...err, schema: "bulkExtensionsArray" })),
        ...objectResult.errors.map((err) => ({ ...err, schema: "bulkExtensionsObject" })),
      ],
    };
  }

  /**
   * Auto-detect and validate extension list format
   */
  validateExtensionList(data: unknown): ValidationResult<string[] | VSCodeExtensionsJson> {
    // Try VS Code extensions.json format first
    if (typeof data === "object" && data !== null && "recommendations" in data) {
      return this.validateVSCodeExtensionsJson(data);
    }

    // Try simple array format
    return this.validateExtensionListArray(data);
  }

  /**
   * Generic validation method
   */
  private validate<T>(schemaName: string, data: unknown): ValidationResult<T> {
    const validator = this.validators.get(schemaName);
    if (!validator) {
      return {
        valid: false,
        errors: [
          {
            path: "",
            message: `Schema '${schemaName}' not found`,
          },
        ],
      };
    }

    const valid = (validator as ValidateFunction<unknown>)(data);

    if (valid) {
      return {
        valid: true,
        data: data as T,
        errors: [],
      };
    }

    const rawErrors = (validator as ValidateFunction<unknown>).errors || [];
    const errors: ValidationErrorInfo[] = (rawErrors as unknown as AjvErrorLite[]).map((error) => ({
      path: error.instancePath || error.schemaPath || "",
      message: error.message || "Validation failed",
      value: error.data,
      schema: error.schemaPath,
    }));

    return {
      valid: false,
      errors,
    };
  }

  /**
   * Create ValidationError from validation result
   */
  createValidationError(result: ValidationResult, context: ValidationContext): ValidationError {
    const contextInfo = context.source ? ` in ${context.source}` : "";
    const operationInfo = context.operation ? ` for ${context.operation}` : "";

    const message = `Validation failed${contextInfo}${operationInfo}`;
    const details = result.errors.map((err) => `  ${err.path}: ${err.message}`).join("\n");
    const fullMessage = `${message}:\n${details}`;

    const suggestions = [
      {
        action: "Check format",
        description: `Ensure the ${context.format || "file"} follows the expected schema format`,
      },
      {
        action: "Validate syntax",
        description: context.format === "json" ? "Check JSON syntax" : "Check file syntax",
      },
      {
        action: "Use example",
        description: "Generate a sample file using the export command",
      },
    ];

    return new ValidationError(fullMessage, "VAL_SCHEMA_FAILED", suggestions, {
      source: context.source,
      format: context.format,
      operation: context.operation,
      errors: result.errors,
    });
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow<T>(schemaName: string, data: unknown, context: ValidationContext = {}): T {
    const result = this.validate<T>(schemaName, data);

    if (!result.valid) {
      throw this.createValidationError(result, context);
    }

    return result.data!;
  }
}

/**
 * Global validator instance
 */
let globalValidator: SchemaValidator | null = null;

/**
 * Get global validator instance
 */
export function getValidator(): SchemaValidator {
  if (!globalValidator) {
    globalValidator = new SchemaValidator();
  }
  return globalValidator;
}

/**
 * Convenience functions for common validations
 */
export const validate = {
  bulkExtensions: (data: unknown) => getValidator().validateBulkFile(data),

  extensionList: (data: unknown) => getValidator().validateExtensionList(data),

  configuration: (data: unknown) => getValidator().validateConfiguration(data),

  vscodeExtensionsJson: (data: unknown) => getValidator().validateVSCodeExtensionsJson(data),
};
