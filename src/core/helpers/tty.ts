/**
 * TTY detection and handling utilities
 */

import * as p from "@clack/prompts";

/**
 * Check if the current environment supports interactive prompts
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

/**
 * Check if the current environment should use quiet mode
 */
export function shouldUseQuietMode(options: { quiet?: boolean; json?: boolean }): boolean {
  return Boolean(options.quiet || options.json || !isInteractive());
}

/**
 * Get a safe intro message that works in both TTY and non-TTY environments
 */
export function getSafeIntro(
  message: string,
  options: { quiet?: boolean; json?: boolean } = {},
): void {
  if (shouldUseQuietMode(options)) {
    return; // Skip intro in quiet mode
  }

  // Only show intro if we have a proper TTY
  if (isInteractive()) {
    p.intro(message);
  }
}

/**
 * Get a safe outro message that works in both TTY and non-TTY environments
 */
export function getSafeOutro(
  message: string,
  options: { quiet?: boolean; json?: boolean } = {},
): void {
  if (shouldUseQuietMode(options)) {
    return; // Skip outro in quiet mode
  }

  // Only show outro if we have a proper TTY
  if (isInteractive()) {
    p.outro(message);
  }
}
