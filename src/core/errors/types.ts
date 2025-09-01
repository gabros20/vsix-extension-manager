// Comprehensive error taxonomy for VSIX Extension Manager
// Provides typed errors with codes, categories, and actionable suggestions

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK = "network",
  FILE_SYSTEM = "filesystem",
  VALIDATION = "validation",
  PARSING = "parsing",
  CONFIGURATION = "configuration",
  REGISTRY = "registry",
  AUTHENTICATION = "authentication",
  USER_INPUT = "user_input",
  SYSTEM = "system",
  DOWNLOAD = "download",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Suggested action types for error recovery
 */
export interface ErrorSuggestion {
  action: string;
  description: string;
  automated?: boolean; // Whether this can be automated
}

/**
 * Base interface for all typed errors
 */
export interface TypedErrorInfo {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  title: string;
  message: string;
  suggestions: ErrorSuggestion[];
  metadata?: Record<string, unknown>;
  causedBy?: Error;
}

/**
 * Base class for all VSIX Extension Manager errors
 */
export class VsixError extends Error implements TypedErrorInfo {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly title: string;
  public readonly suggestions: ErrorSuggestion[];
  public readonly metadata?: Record<string, unknown>;
  public readonly causedBy?: Error;

  constructor(info: TypedErrorInfo) {
    super(info.message);
    this.name = this.constructor.name;
    this.code = info.code;
    this.category = info.category;
    this.severity = info.severity;
    this.title = info.title;
    this.suggestions = info.suggestions;
    this.metadata = info.metadata;
    this.causedBy = info.causedBy;

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get formatted error message with suggestions
   */
  getFormattedMessage(): string {
    let formatted = `${this.title}: ${this.message}`;

    if (this.suggestions.length > 0) {
      formatted += "\n\nSuggested actions:";
      this.suggestions.forEach((suggestion, index) => {
        formatted += `\n${index + 1}. ${suggestion.action}: ${suggestion.description}`;
      });
    }

    return formatted;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      title: this.title,
      message: this.message,
      suggestions: this.suggestions,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      title: "Network Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * File system errors
 */
export class FileSystemError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.FILE_SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      title: "File System Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * Validation errors
 */
export class ValidationError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      title: "Validation Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * Parsing errors
 */
export class ParsingError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.PARSING,
      severity: ErrorSeverity.MEDIUM,
      title: "Parsing Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.HIGH,
      title: "Configuration Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * Registry/marketplace errors
 */
export class RegistryError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.REGISTRY,
      severity: ErrorSeverity.HIGH,
      title: "Registry Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * Download-specific errors
 */
export class DownloadError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.DOWNLOAD,
      severity: ErrorSeverity.HIGH,
      title: "Download Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * Install-specific errors
 */
export class InstallError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      title: "Install Error",
      message,
      suggestions,
      metadata,
    });
  }
}

/**
 * User input errors
 */
export class UserInputError extends VsixError {
  constructor(
    message: string,
    code: string,
    suggestions: ErrorSuggestion[] = [],
    metadata?: Record<string, unknown>,
  ) {
    super({
      code,
      category: ErrorCategory.USER_INPUT,
      severity: ErrorSeverity.LOW,
      title: "Input Error",
      message,
      suggestions,
      metadata,
    });
  }
}
