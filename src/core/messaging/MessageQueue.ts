/**
 * Message queue - stub for now
 * TODO: Add back full implementation
 */

export type MessageLevel = "info" | "success" | "warning" | "error" | "debug";

export interface Message {
  level: MessageLevel;
  content: string;
  timestamp: number;
}

export class MessageQueue {
  private messages: Message[] = [];
  
  add(level: MessageLevel, content: string): void {
    this.messages.push({
      level,
      content,
      timestamp: Date.now(),
    });
  }
  
  getMessages(): Message[] {
    return this.messages;
  }
  
  flush(): void {
    this.messages = [];
  }
}

export const messageQueue = new MessageQueue();
