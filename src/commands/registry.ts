/**
 * Command registry for v2.0
 * Central registry of all available commands with lazy loading
 */

import type { BaseCommand } from "./base";

/**
 * Command loader function type
 */
type CommandLoader = () => Promise<{ default: BaseCommand }>;

/**
 * Registry of all v2.0 commands
 * Commands are lazy-loaded on first use
 */
export const COMMANDS: Record<string, CommandLoader> = {
  // Core commands (to be implemented)
  add: async () => ({ default: (await import("./add")).AddCommand }),
  remove: async () => ({ default: (await import("./remove")).RemoveCommand }),
  update: async () => ({ default: (await import("./update")).UpdateCommand }),
  list: async () => ({ default: (await import("./list")).ListCommand }),
  search: async () => ({ default: (await import("./search")).SearchCommand }),
  info: async () => ({ default: (await import("./info")).InfoCommand }),
  doctor: async () => ({ default: (await import("./doctor")).DoctorCommand }),

  // Specialized commands (to be implemented)
  workspace: async () => ({ default: (await import("./workspace")).WorkspaceCommand }),
  templates: async () => ({ default: (await import("./templates")).TemplatesCommand }),

  // Preserved commands
  rollback: async () => ({ default: (await import("./rollback")).RollbackCommand }),
  interactive: async () => ({ default: (await import("./interactive")).InteractiveCommand }),
};

/**
 * Command aliases for better UX
 * Maps alternative names to primary command names
 */
export const ALIASES: Record<string, string> = {
  // Intuitive aliases
  get: "add",
  install: "add", // Migration helper from v1.x
  upgrade: "update",
  uninstall: "remove",

  // Short aliases
  rm: "remove",
  up: "update",
  ls: "list",

  // Legacy migration aliases
  dl: "add", // Old download command
  qi: "add", // Old quick-install command
  fl: "add", // Old from-list command
  ex: "list", // Old export-installed command
  un: "remove", // Old uninstall command
  rb: "rollback",
};

/**
 * Resolve command name including aliases
 * @param name - Command name or alias
 * @returns Resolved command name
 */
export function resolveCommandName(name: string): string {
  return ALIASES[name] || name;
}

/**
 * Load a command by name
 * @param name - Command name or alias
 * @returns Command instance
 */
export async function loadCommand(name: string): Promise<BaseCommand> {
  const commandName = resolveCommandName(name);
  const loader = COMMANDS[commandName];

  if (!loader) {
    throw new Error(`Unknown command: ${name}`);
  }

  const module = await loader();
  return module.default;
}

/**
 * Check if a command exists
 * @param name - Command name or alias
 * @returns True if command exists
 */
export function hasCommand(name: string): boolean {
  const commandName = resolveCommandName(name);
  return commandName in COMMANDS;
}

/**
 * Get list of all available commands
 * @returns Array of command names
 */
export function getAllCommands(): string[] {
  return Object.keys(COMMANDS);
}

/**
 * Get list of all aliases
 * @returns Array of alias names
 */
export function getAllAliases(): string[] {
  return Object.keys(ALIASES);
}
