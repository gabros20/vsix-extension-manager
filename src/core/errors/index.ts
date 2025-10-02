// Error system exports for VSIX Extension Manager

// Core error types and base classes
export * from "./types";
export { InstallError } from "./types";

// Predefined error definitions and factory functions
export * from "./definitions";

// Error handling utilities
export * from "./handler";

// Enhanced error handling with suggestions and recovery
export * from "./enhancedHandler";
export type { ErrorSuggestion, ErrorContext, SuggestedAction } from "./suggestions";
export { errorSuggestionService, ErrorSuggestionService } from "./suggestions";
export * from "./recovery";
