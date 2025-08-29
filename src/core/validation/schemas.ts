// JSON Schema definitions for VSIX Extension Manager

import type { JSONSchemaType } from "ajv";

/**
 * Schema for individual extension items in bulk downloads
 */
export interface BulkExtensionItem {
  url: string;
  version: string;
  source?: "marketplace" | "open-vsx";
  name?: string; // Optional display name
}

/**
 * Schema for bulk extension files
 */
export interface BulkExtensionsList {
  extensions?: BulkExtensionItem[]; // Optional wrapper
  [index: number]: BulkExtensionItem; // Or direct array
}

/**
 * Schema for VS Code extensions.json format
 */
export interface VSCodeExtensionsJson {
  recommendations: string[];
  unwantedRecommendations?: string[];
}

/**
 * Schema for extension list text format (parsed structure)
 */
export interface ExtensionListText {
  extensions: string[];
}

/**
 * JSON Schema for bulk extension items
 */
export const bulkExtensionItemSchema: JSONSchemaType<BulkExtensionItem> = {
  type: "object",
  properties: {
    url: {
      type: "string",
      pattern:
        "^https://(marketplace\\.visualstudio\\.com/items\\?itemName=|open-vsx\\.org/(api/|extension/))[^\\s]+$",
      description: "Extension URL from VS Code Marketplace or OpenVSX",
    },
    version: {
      type: "string",
      pattern: "^(latest|\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9]+(?:\\.[a-zA-Z0-9]+)*)?)$",
      description: "Extension version (semver format or 'latest')",
    },
    source: {
      type: "string",
      enum: ["marketplace", "open-vsx"],
      nullable: true,
      description: "Override source registry (optional)",
    },
    name: {
      type: "string",
      nullable: true,
      description: "Display name for the extension (optional)",
    },
  },
  required: ["url", "version"],
  additionalProperties: false,
};

/**
 * JSON Schema for bulk extensions list (array format)
 */
export const bulkExtensionsArraySchema: JSONSchemaType<BulkExtensionItem[]> = {
  type: "array",
  items: bulkExtensionItemSchema,
  minItems: 1,
  maxItems: 1000, // Reasonable limit
  description: "Array of extensions to download",
};

/**
 * JSON Schema for bulk extensions list (object wrapper format)
 */
export const bulkExtensionsObjectSchema: JSONSchemaType<{ extensions: BulkExtensionItem[] }> = {
  type: "object",
  properties: {
    extensions: bulkExtensionsArraySchema,
  },
  required: ["extensions"],
  additionalProperties: false,
  description: "Object containing array of extensions to download",
};

/**
 * JSON Schema for VS Code extensions.json format
 */
export const vscodeExtensionsJsonSchema: JSONSchemaType<VSCodeExtensionsJson> = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "string",
        pattern: "^[a-zA-Z0-9][a-zA-Z0-9\\-]*\\.[a-zA-Z0-9][a-zA-Z0-9\\-]*$",
        description: "Extension ID in publisher.extension format",
      },
      minItems: 0,
      maxItems: 1000,
      description: "List of recommended extension IDs",
    },
    unwantedRecommendations: {
      type: "array",
      items: {
        type: "string",
        pattern: "^[a-zA-Z0-9][a-zA-Z0-9\\-]*\\.[a-zA-Z0-9][a-zA-Z0-9\\-]*$",
      },
      minItems: 0,
      maxItems: 1000,
      nullable: true,
      description: "List of unwanted extension IDs (optional)",
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
  description: "VS Code workspace extensions.json format",
};

/**
 * JSON Schema for extension list (simple string array)
 */
export const extensionListArraySchema: JSONSchemaType<string[]> = {
  type: "array",
  items: {
    type: "string",
    pattern: "^[a-zA-Z0-9][a-zA-Z0-9\\-]*\\.[a-zA-Z0-9][a-zA-Z0-9\\-]*$",
    description: "Extension ID in publisher.extension format",
  },
  minItems: 1,
  maxItems: 1000,
  description: "Simple array of extension IDs",
};

/**
 * Schema for configuration files
 */
export interface ConfigurationFile {
  outputDir?: string;
  cacheDir?: string;
  parallel?: number;
  retry?: number;
  retryDelay?: number;
  skipExisting?: boolean;
  overwrite?: boolean;
  filenameTemplate?: string;
  quiet?: boolean;
  json?: boolean;
  source?: "marketplace" | "open-vsx" | "auto";
  preRelease?: boolean;
  checksum?: boolean;
  timeout?: number;
  userAgent?: string;
  progressUpdateInterval?: number;
  editor?: "vscode" | "cursor" | "auto";
}

/**
 * JSON Schema for configuration files
 */
export const configurationSchema: JSONSchemaType<ConfigurationFile> = {
  type: "object",
  properties: {
    outputDir: {
      type: "string",
      nullable: true,
      description: "Default output directory for downloads",
    },
    cacheDir: {
      type: "string",
      nullable: true,
      description: "Cache directory (overrides outputDir)",
    },
    parallel: {
      type: "integer",
      minimum: 1,
      maximum: 20,
      nullable: true,
      description: "Number of parallel downloads",
    },
    retry: {
      type: "integer",
      minimum: 0,
      maximum: 10,
      nullable: true,
      description: "Number of retry attempts",
    },
    retryDelay: {
      type: "integer",
      minimum: 0,
      maximum: 30000,
      nullable: true,
      description: "Delay between retries in milliseconds",
    },
    skipExisting: {
      type: "boolean",
      nullable: true,
      description: "Skip downloads if file already exists",
    },
    overwrite: {
      type: "boolean",
      nullable: true,
      description: "Overwrite existing files",
    },
    filenameTemplate: {
      type: "string",
      nullable: true,
      pattern: ".*\\{(name|version|publisher|source)\\}.*",
      description: "Filename template with variables",
    },
    quiet: {
      type: "boolean",
      nullable: true,
      description: "Reduce output verbosity",
    },
    json: {
      type: "boolean",
      nullable: true,
      description: "Output in JSON format",
    },
    source: {
      type: "string",
      enum: ["marketplace", "open-vsx", "auto"],
      nullable: true,
      description: "Default source registry",
    },
    preRelease: {
      type: "boolean",
      nullable: true,
      description: "Prefer pre-release versions",
    },
    checksum: {
      type: "boolean",
      nullable: true,
      description: "Generate checksums for downloads",
    },
    timeout: {
      type: "integer",
      minimum: 1000,
      maximum: 300000,
      nullable: true,
      description: "HTTP timeout in milliseconds",
    },
    userAgent: {
      type: "string",
      nullable: true,
      description: "HTTP User-Agent string",
    },
    progressUpdateInterval: {
      type: "integer",
      minimum: 50,
      maximum: 5000,
      nullable: true,
      description: "Progress update interval in milliseconds",
    },
    editor: {
      type: "string",
      enum: ["vscode", "cursor", "auto"],
      nullable: true,
      description: "Default editor for export operations",
    },
  },
  additionalProperties: false,
  description: "Configuration file for VSIX Extension Manager",
};

/**
 * Export all schemas for easy access
 */
export const schemas = {
  bulkExtensionItem: bulkExtensionItemSchema,
  bulkExtensionsArray: bulkExtensionsArraySchema,
  bulkExtensionsObject: bulkExtensionsObjectSchema,
  vscodeExtensionsJson: vscodeExtensionsJsonSchema,
  extensionListArray: extensionListArraySchema,
  configuration: configurationSchema,
} as Record<string, object>;
