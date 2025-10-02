/**
 * Reusable Clack-based UI components for v2.0
 * Provides consistent, beautiful CLI interfaces across all commands
 */

import * as p from "@clack/prompts";
import type { EditorInfo } from "../../features/install";

/**
 * Plan action types
 */
export type PlanAction = "confirm" | "customize" | "cancel";

/**
 * Editor selection result
 */
export interface EditorSelection {
  editor: EditorInfo;
  confirmed: boolean;
}

/**
 * Multi-select result
 */
export interface MultiSelectResult<T> {
  items: T[];
  cancelled: boolean;
}

/**
 * UI Components class providing reusable Clack components
 */
export class UIComponents {
  /**
   * Show command intro
   */
  intro(title: string): void {
    p.intro(title);
  }

  /**
   * Show command outro
   */
  outro(message: string): void {
    p.outro(message);
  }

  /**
   * Show cancellation message and exit
   */
  cancel(message = "Operation cancelled"): never {
    p.cancel(message);
    process.exit(0);
  }

  /**
   * Simple confirmation prompt
   */
  async confirm(message: string, initialValue = true): Promise<boolean> {
    const result = await p.confirm({
      message,
      initialValue,
    });

    if (p.isCancel(result)) {
      this.cancel();
    }

    return result;
  }

  /**
   * Text input prompt
   */
  async text(options: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    validate?: (value: string) => string | void;
  }): Promise<string> {
    const result = await p.text({
      message: options.message,
      placeholder: options.placeholder,
      defaultValue: options.defaultValue,
      validate: options.validate,
    });

    if (p.isCancel(result)) {
      this.cancel();
    }

    return result;
  }

  /**
   * Select from options
   */
  async select<T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
  }): Promise<T> {
    const result = await p.select({
      message: options.message,
      options: options.options,
    });

    if (p.isCancel(result)) {
      this.cancel();
    }

    return result as T;
  }

  /**
   * Multi-select from options
   */
  async multiselect<T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
    required?: boolean;
  }): Promise<T[]> {
    const result = await p.multiselect({
      message: options.message,
      options: options.options,
      required: options.required,
    });

    if (p.isCancel(result)) {
      this.cancel();
    }

    return result as T[];
  }

  /**
   * Group multiple prompts together
   */
  async group<T extends Record<string, unknown>>(
    prompts: Record<string, (results: any) => Promise<unknown> | unknown>,
  ): Promise<T> {
    const result = await p.group(prompts as any, {
      onCancel: () => {
        this.cancel();
      },
    });

    return result as T;
  }

  /**
   * Show a note/message box
   */
  note(message: string, title?: string): void {
    p.note(message, title);
  }

  /**
   * Show a spinner
   */
  spinner(): {
    start: (message: string) => void;
    stop: (message: string, code?: number) => void;
    message: (message: string) => void;
  } {
    return p.spinner();
  }

  /**
   * Log messages
   */
  log = {
    info: (message: string) => p.log.info(message),
    success: (message: string) => p.log.success(message),
    warning: (message: string) => p.log.warn(message),
    error: (message: string) => p.log.error(message),
    message: (message: string) => p.log.message(message),
    step: (message: string) => p.log.step(message),
  };

  /**
   * Select editor from available editors
   */
  async selectEditor(editors: EditorInfo[], preferredName?: string): Promise<EditorInfo> {
    if (editors.length === 0) {
      throw new Error("No editors found. Please install VS Code or Cursor.");
    }

    if (editors.length === 1) {
      return editors[0];
    }

    // Show editor selection
    const options = editors.map((editor) => {
      const isPreferred = editor.name === preferredName;
      const versionStr = editor.version ? ` (v${editor.version})` : "";
      return {
        value: editor.name,
        label: `${editor.name === "cursor" ? "Cursor" : "VS Code"}${versionStr}`,
        hint: isPreferred ? "Recommended" : undefined,
      };
    });

    const selected = await this.select({
      message: "Select target editor:",
      options,
    });

    const editor = editors.find((e) => e.name === selected);
    if (!editor) {
      throw new Error(`Editor not found: ${selected}`);
    }

    return editor;
  }

  /**
   * Show installation details
   */
  showInstallDetails(details: {
    vsixPath: string;
    editor: string;
    binaryPath: string;
    maxWidth?: number;
  }): void {
    const truncate = (str: string, max: number) => {
      if (str.length <= max) return str;
      const half = Math.floor((max - 3) / 2);
      return `${str.slice(0, half)}...${str.slice(-half)}`;
    };

    const maxWidth = details.maxWidth || 50;
    const message = [
      `VSIX: ${truncate(details.vsixPath, maxWidth)}`,
      `Editor: ${details.editor}`,
      `Binary: ${truncate(details.binaryPath, maxWidth)}`,
    ].join("\n");

    this.note(message, "Installation Details");
  }

  /**
   * Show error with suggestions
   */
  showError(error: {
    title: string;
    message: string;
    suggestions?: string[];
    code?: string;
  }): void {
    this.log.error(`${error.title}\n${error.message}`);

    if (error.suggestions && error.suggestions.length > 0) {
      this.note(error.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n"), "💡 Suggestions");
    }

    if (error.code) {
      this.log.message(`Error code: ${error.code}`);
    }
  }

  /**
   * Show command result summary
   * Integration Phase: Now accepts Phase 2 ResultTotals type
   */
  showResultSummary(result: {
    total?: number;
    successful: number;
    failed: number;
    skipped: number;
    warnings?: number;
    duration: number;
  }): void {
    const lines: string[] = [];

    if (result.successful > 0) {
      lines.push(`✅ Success: ${result.successful}`);
    }

    if (result.failed > 0) {
      lines.push(`❌ Failed: ${result.failed}`);
    }

    if (result.skipped > 0) {
      lines.push(`⏭️  Skipped: ${result.skipped}`);
    }

    if (result.warnings && result.warnings > 0) {
      lines.push(`⚠️  Warnings: ${result.warnings}`);
    }

    lines.push(`⏱️  Duration: ${this.formatDuration(result.duration)}`);

    this.note(lines.join("\n"), "Summary");
  }

  /**
   * Format duration to human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

/**
 * Singleton instance
 */
export const ui = new UIComponents();
