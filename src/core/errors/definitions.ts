// Predefined error definitions with codes and suggestions

import {
  NetworkError,
  FileSystemError,
  ValidationError,
  ParsingError,
  ConfigurationError,
  RegistryError,
  DownloadError,
  type ErrorSuggestion,
} from "./types";

/**
 * Network error factory functions
 */
export const NetworkErrors = {
  connectionTimeout: (url?: string) =>
    new NetworkError(
      `Connection timeout${url ? ` when accessing ${url}` : ""}`,
      "NET_TIMEOUT",
      [
        {
          action: "Check internet connection",
          description: "Verify your network connection is working",
        },
        { action: "Try again later", description: "The server might be temporarily unavailable" },
        {
          action: "Use different source",
          description: "Try switching between marketplace and open-vsx",
        },
      ],
      { url },
    ),

  connectionRefused: (url?: string) =>
    new NetworkError(
      `Connection refused${url ? ` for ${url}` : ""}`,
      "NET_REFUSED",
      [
        { action: "Check network settings", description: "Verify firewall and proxy settings" },
        { action: "Check URL validity", description: "Ensure the URL is correct and accessible" },
        {
          action: "Try different DNS",
          description: "Try using different DNS servers (8.8.8.8, 1.1.1.1)",
        },
      ],
      { url },
    ),

  notFound: (resource: string) =>
    new NetworkError(
      `Resource not found: ${resource}`,
      "NET_NOT_FOUND",
      [
        { action: "Check URL", description: "Verify the extension URL is correct" },
        {
          action: "Check extension exists",
          description: "Confirm the extension is published on the registry",
        },
        { action: "Try different version", description: "The specific version might not exist" },
      ],
      { resource },
    ),

  unauthorized: (resource?: string) =>
    new NetworkError(
      `Access denied${resource ? ` for ${resource}` : ""}`,
      "NET_UNAUTHORIZED",
      [
        {
          action: "Check permissions",
          description: "The extension might be private or restricted",
        },
        { action: "Use authentication", description: "Some extensions require authentication" },
        {
          action: "Try different source",
          description: "Try marketplace if using OpenVSX or vice versa",
        },
      ],
      { resource },
    ),
};

/**
 * File system error factory functions
 */
export const FileSystemErrors = {
  directoryNotFound: (path: string) =>
    new FileSystemError(
      `Directory not found: ${path}`,
      "FS_DIR_NOT_FOUND",
      [
        {
          action: "Create directory",
          description: "Create the missing directory",
          automated: true,
        },
        { action: "Check path", description: "Verify the path is correct" },
        {
          action: "Check permissions",
          description: "Ensure you have read/write access to the parent directory",
        },
      ],
      { path },
    ),

  fileNotFound: (path: string) =>
    new FileSystemError(
      `File not found: ${path}`,
      "FS_FILE_NOT_FOUND",
      [
        { action: "Check file path", description: "Verify the file path is correct" },
        {
          action: "Check file exists",
          description: "Ensure the file hasn't been moved or deleted",
        },
        {
          action: "Use absolute path",
          description: "Try using an absolute path instead of relative",
        },
      ],
      { path },
    ),

  permissionDenied: (path: string, operation: string) =>
    new FileSystemError(
      `Permission denied: Cannot ${operation} ${path}`,
      "FS_PERMISSION_DENIED",
      [
        { action: "Change permissions", description: `Run 'chmod' to allow ${operation} access` },
        {
          action: "Run as administrator",
          description: "Try running the command with elevated privileges",
        },
        {
          action: "Change location",
          description: "Use a different directory with write permissions",
        },
      ],
      { path, operation },
    ),

  diskFull: (path: string) =>
    new FileSystemError(
      `Not enough disk space: ${path}`,
      "FS_DISK_FULL",
      [
        { action: "Free disk space", description: "Delete unnecessary files to free up space" },
        { action: "Change location", description: "Use a different drive with more space" },
        { action: "Clean downloads", description: "Remove old downloaded VSIX files" },
      ],
      { path },
    ),

  fileAlreadyExists: (path: string) =>
    new FileSystemError(
      `File already exists: ${path}`,
      "FS_FILE_EXISTS",
      [
        {
          action: "Use --overwrite",
          description: "Use the --overwrite flag to replace existing files",
        },
        {
          action: "Use --skip-existing",
          description: "Use --skip-existing to skip duplicate downloads",
        },
        { action: "Rename file", description: "Choose a different filename" },
      ],
      { path },
    ),
};

/**
 * Validation error factory functions
 */
export const ValidationErrors = {
  invalidUrl: (url: string) =>
    new ValidationError(
      `Invalid URL format: ${url}`,
      "VAL_INVALID_URL",
      [
        {
          action: "Check URL format",
          description: "Ensure URL starts with https:// and follows marketplace/OpenVSX format",
        },
        {
          action: "Copy from browser",
          description: "Copy the URL directly from your browser address bar",
        },
        {
          action: "Use extension ID",
          description: "Use publisher.extension format instead of full URL",
        },
      ],
      { url },
    ),

  invalidVersion: (version: string) =>
    new ValidationError(
      `Invalid version format: ${version}`,
      "VAL_INVALID_VERSION",
      [
        { action: "Use semantic version", description: "Use format like 1.2.3 or latest" },
        {
          action: "Check available versions",
          description: "Use 'versions' command to see available versions",
        },
        { action: "Use 'latest'", description: "Use 'latest' to get the most recent version" },
      ],
      { version },
    ),

  invalidExtensionId: (id: string) =>
    new ValidationError(
      `Invalid extension ID format: ${id}`,
      "VAL_INVALID_EXT_ID",
      [
        {
          action: "Use correct format",
          description: "Extension ID should be 'publisher.extension'",
        },
        {
          action: "Check marketplace",
          description: "Verify the extension ID from the marketplace page",
        },
        {
          action: "Check spelling",
          description: "Ensure publisher and extension names are spelled correctly",
        },
      ],
      { id },
    ),

  invalidTemplate: (template: string, reason: string) =>
    new ValidationError(
      `Invalid filename template: ${template} (${reason})`,
      "VAL_INVALID_TEMPLATE",
      [
        {
          action: "Use valid variables",
          description: "Use variables like {name}, {version}, {publisher}",
        },
        { action: "Check syntax", description: "Ensure variables are enclosed in curly braces {}" },
        {
          action: "Use default",
          description: "Remove custom template to use default {name}-{version}.vsix",
        },
      ],
      { template, reason },
    ),
};

/**
 * Parsing error factory functions
 */
export const ParsingErrors = {
  invalidJson: (filePath: string, details?: string) =>
    new ParsingError(
      `Invalid JSON in file: ${filePath}${details ? ` (${details})` : ""}`,
      "PARSE_INVALID_JSON",
      [
        { action: "Check JSON syntax", description: "Validate JSON syntax using a JSON validator" },
        { action: "Check encoding", description: "Ensure file is saved in UTF-8 encoding" },
        { action: "Use template", description: "Generate a sample file using the export command" },
      ],
      { filePath, details },
    ),

  invalidYaml: (filePath: string, details?: string) =>
    new ParsingError(
      `Invalid YAML in file: ${filePath}${details ? ` (${details})` : ""}`,
      "PARSE_INVALID_YAML",
      [
        { action: "Check YAML syntax", description: "Validate YAML syntax and indentation" },
        {
          action: "Check indentation",
          description: "YAML requires consistent indentation (spaces, not tabs)",
        },
        {
          action: "Use JSON instead",
          description: "Consider using JSON format which is more strict",
        },
      ],
      { filePath, details },
    ),

  missingFields: (filePath: string, fields: string[]) =>
    new ParsingError(
      `Missing required fields in ${filePath}: ${fields.join(", ")}`,
      "PARSE_MISSING_FIELDS",
      [
        {
          action: "Add missing fields",
          description: `Add the required fields: ${fields.join(", ")}`,
        },
        {
          action: "Check schema",
          description: "Verify the file format matches the expected schema",
        },
        {
          action: "Use example",
          description: "Use the export command to generate a valid example",
        },
      ],
      { filePath, fields },
    ),
};

/**
 * Registry error factory functions
 */
export const RegistryErrors = {
  extensionNotFound: (extensionId: string, source?: string) =>
    new RegistryError(
      `Extension not found: ${extensionId}${source ? ` on ${source}` : ""}`,
      "REG_EXTENSION_NOT_FOUND",
      [
        {
          action: "Check extension ID",
          description: "Verify the publisher and extension name are correct",
        },
        {
          action: "Check marketplace",
          description: "Confirm the extension exists on the marketplace",
        },
        {
          action: "Try different source",
          description: "Try OpenVSX if using marketplace or vice versa",
        },
      ],
      { extensionId, source },
    ),

  versionNotFound: (extensionId: string, version: string) =>
    new RegistryError(
      `Version ${version} not found for extension ${extensionId}`,
      "REG_VERSION_NOT_FOUND",
      [
        {
          action: "Check version",
          description: "Use 'versions' command to see available versions",
        },
        { action: "Use latest", description: "Use 'latest' to get the most recent version" },
        {
          action: "Check pre-release",
          description: "Use --pre-release flag for pre-release versions",
        },
      ],
      { extensionId, version },
    ),

  registryUnavailable: (source: string) =>
    new RegistryError(
      `Registry unavailable: ${source}`,
      "REG_UNAVAILABLE",
      [
        { action: "Try again later", description: "The registry might be temporarily down" },
        { action: "Check status", description: "Check the registry's status page" },
        {
          action: "Use alternative",
          description: "Try a different registry (marketplace/OpenVSX)",
        },
      ],
      { source },
    ),
};

/**
 * Download error factory functions
 */
export const DownloadErrors = {
  downloadFailed: (url: string, reason?: string) =>
    new DownloadError(
      `Download failed for ${url}${reason ? `: ${reason}` : ""}`,
      "DL_FAILED",
      [
        { action: "Retry download", description: "Try downloading again", automated: true },
        { action: "Check connection", description: "Verify your internet connection" },
        { action: "Try different source", description: "Use a different registry if available" },
      ],
      { url, reason },
    ),

  checksumMismatch: (filePath: string, expected: string, actual: string) =>
    new DownloadError(
      `Checksum verification failed for ${filePath}`,
      "DL_CHECKSUM_MISMATCH",
      [
        { action: "Re-download", description: "Download the file again", automated: true },
        { action: "Check source", description: "Verify the expected checksum is correct" },
        {
          action: "Skip verification",
          description: "Use without checksum verification (not recommended)",
        },
      ],
      { filePath, expected, actual },
    ),

  corruptedFile: (filePath: string) =>
    new DownloadError(
      `Downloaded file appears to be corrupted: ${filePath}`,
      "DL_CORRUPTED",
      [
        { action: "Re-download", description: "Download the file again", automated: true },
        {
          action: "Check disk space",
          description: "Ensure sufficient disk space for the download",
        },
        { action: "Try different location", description: "Download to a different directory" },
      ],
      { filePath },
    ),
};

/**
 * Configuration error factory functions
 */
export const ConfigurationErrors = {
  invalidConfig: (filePath: string, details: string) =>
    new ConfigurationError(
      `Invalid configuration in ${filePath}: ${details}`,
      "CFG_INVALID",
      [
        { action: "Fix configuration", description: "Correct the configuration errors" },
        { action: "Use default config", description: "Remove the config file to use defaults" },
        { action: "Generate sample", description: "Generate a sample configuration file" },
      ],
      { filePath, details },
    ),

  configNotFound: (searchPaths: string[]) =>
    new ConfigurationError(
      `Configuration file not found in: ${searchPaths.join(", ")}`,
      "CFG_NOT_FOUND",
      [
        {
          action: "Create config file",
          description: "Create a configuration file in one of the search paths",
        },
        {
          action: "Use environment variables",
          description: "Set configuration via VSIX_* environment variables",
        },
        { action: "Use CLI options", description: "Pass configuration via command line options" },
      ],
      { searchPaths },
    ),
};

/**
 * Helper function to create error with suggestions
 */
export function createError<
  T extends new (
    message: string,
    code: string,
    suggestions?: ErrorSuggestion[],
    metadata?: Record<string, unknown>,
  ) => InstanceType<T>,
>(
  ErrorClass: T,
  message: string,
  code: string,
  suggestions: ErrorSuggestion[] = [],
  metadata?: Record<string, unknown>,
): InstanceType<T> {
  return new ErrorClass(message, code, suggestions, metadata);
}
