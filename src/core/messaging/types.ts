/**
 * Messaging system type definitions
 */

export type MessageLevel = "info" | "success" | "warning" | "error" | "debug";

export interface Message {
  level: MessageLevel;
  text: string;
  timestamp?: number;
  context?: string;
}

export interface MessagingOptions {
  quiet?: boolean;
  json?: boolean;
  debug?: boolean;
}
