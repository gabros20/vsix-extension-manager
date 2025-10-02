/**
 * Message queue for buffering messages in JSON mode
 * Allows collecting all messages and outputting at once
 */

import type { Message, MessageLevel, MessagingOptions } from "./types";
import chalk from "chalk";

export class MessageQueue {
  private messages: Message[] = [];
  private options: MessagingOptions;

  constructor(options: MessagingOptions = {}) {
    this.options = options;
  }

  /**
   * Add message to queue
   */
  add(level: MessageLevel, text: string, context?: string): void {
    // Skip if quiet (except errors)
    if (this.options.quiet && level !== "error") {
      return;
    }

    // Skip debug messages unless debug mode
    if (level === "debug" && !this.options.debug) {
      return;
    }

    const message: Message = {
      level,
      text,
      timestamp: Date.now(),
      context,
    };

    this.messages.push(message);

    // Immediate output in non-JSON mode
    if (!this.options.json) {
      this.outputMessage(message);
    }
  }

  /**
   * Output single message
   */
  private outputMessage(message: Message): void {
    const formatted = this.formatMessage(message);
    console.log(formatted);
  }

  /**
   * Format message for console output
   */
  private formatMessage(message: Message): string {
    const prefix = this.getLevelPrefix(message.level);
    const contextStr = message.context ? chalk.gray(` [${message.context}]`) : "";

    return `${prefix} ${message.text}${contextStr}`;
  }

  /**
   * Get colored prefix for message level
   */
  private getLevelPrefix(level: MessageLevel): string {
    switch (level) {
      case "success":
        return chalk.green("✓");
      case "warning":
        return chalk.yellow("⚠");
      case "error":
        return chalk.red("✗");
      case "debug":
        return chalk.gray("⚙");
      case "info":
      default:
        return chalk.blue("ℹ");
    }
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return this.messages;
  }

  /**
   * Get messages as JSON
   */
  toJSON(): object {
    return {
      messages: this.messages,
      count: this.messages.length,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Flush all buffered messages (for JSON mode)
   */
  flush(): void {
    if (this.options.json && this.messages.length > 0) {
      console.log(JSON.stringify(this.toJSON(), null, 2));
    }
    this.clear();
  }
}

export const messageQueue = new MessageQueue();
