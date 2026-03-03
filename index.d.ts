export interface CommandArg {
  name: string;
  description?: string;
  required?: boolean;
  type?: string;
}

export interface CommandOption {
  name: string;
  shorthand?: string;
  short?: string;
  description?: string;
  takesValue?: boolean;
  type?: string;
}

export interface CommandExample {
  command: string;
  description?: string;
}

export interface Subcommand {
  name: string;
  description?: string;
  args?: CommandArg[];
  options?: CommandOption[];
  subcommands?: Subcommand[];
  examples?: string[] | CommandExample[];
}

export interface ContextDetector {
  name: string;
  description?: string;
  command: string;
  parser: "text" | "lines" | "json" | "csv" | "keyvalue" | "regex" | "table";
  pattern?: string;
  cacheFor?: number;
  requiresCmd?: string;
}

export interface ContextEngine {
  detectors: ContextDetector[];
}

export interface Command {
  name: string;
  description: string;
  category: string;
  platforms: ("linux" | "macos" | "windows")[];
  shells: ("bash" | "zsh" | "fish" | "powershell" | "cmd")[];
  subcommands: Subcommand[];
  globalOptions: CommandOption[];
  examples: CommandExample[];
  relatedCommands?: string[];
  contextEngine?: ContextEngine;
}

/**
 * Get a single command by name.
 */
export function getCommand(name: string): Command | undefined;

/**
 * Get all commands as an array.
 */
export function getAllCommands(): Command[];

/**
 * List all available command names (sorted).
 */
export function listCommandNames(): string[];

/**
 * Get commands filtered by category (case-insensitive partial match).
 */
export function getCommandsByCategory(category: string): Command[];

/**
 * Get commands filtered by platform.
 */
export function getCommandsByPlatform(platform: "linux" | "macos" | "windows"): Command[];

/**
 * Search commands by name, description, or category.
 */
export function searchCommands(query: string): Command[];

/**
 * Get all unique categories.
 */
export function getCategories(): string[];

/**
 * Get the context engine detectors for a command.
 */
export function getContextEngine(name: string): ContextEngine | null;

/**
 * Get subcommands for a command.
 */
export function getSubcommands(name: string): Subcommand[];

/**
 * Get global options for a command.
 */
export function getGlobalOptions(name: string): CommandOption[];

/**
 * Get examples for a command.
 */
export function getExamples(name: string): CommandExample[];

/**
 * Get the total number of commands.
 */
export function count(): number;

/**
 * Clear the internal cache.
 */
export function clearCache(): void;

/**
 * Resolve the absolute path to a command JSON file.
 */
export function resolveCommandPath(name: string): string;

/**
 * Absolute path to the commands data directory.
 */
export const dataDir: string;
