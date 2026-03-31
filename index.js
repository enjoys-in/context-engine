"use strict";

const fs = require("fs");
const path = require("path");

const COMMANDS_DIR = path.join(__dirname, "data", "commands");

/** @type {Map<string, object>|null} */
let _cache = null;

/**
 * Load all commands into cache (lazy, first call only).
 * @returns {Map<string, object>}
 */
function _loadAll() {
  if (_cache) return _cache;
  _cache = new Map();
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(COMMANDS_DIR, file), "utf-8")
    );
    _cache.set(data.name, data);
  }
  return _cache;
}

/**
 * Get a single command by name.
 * @param {string} name - Command name (e.g. "git", "docker", "kubectl")
 * @returns {object|undefined}
 */
function getCommand(name) {
  return _loadAll().get(name);
}

/**
 * Get all commands as an array.
 * @returns {object[]}
 */
function getAllCommands() {
  return Array.from(_loadAll().values());
}

/**
 * List all available command names.
 * @returns {string[]}
 */
function listCommandNames() {
  return Array.from(_loadAll().keys()).sort();
}

/**
 * Get commands filtered by category.
 * @param {string} category - Category name (case-insensitive partial match)
 * @returns {object[]}
 */
function getCommandsByCategory(category) {
  const lc = category.toLowerCase();
  return getAllCommands().filter(
    (cmd) => cmd.category && cmd.category.toLowerCase().includes(lc)
  );
}

/**
 * Get commands filtered by platform.
 * @param {string} platform - "linux" | "macos" | "windows"
 * @returns {object[]}
 */
function getCommandsByPlatform(platform) {
  const lc = platform.toLowerCase();
  return getAllCommands().filter(
    (cmd) =>
      Array.isArray(cmd.platforms) &&
      cmd.platforms.some((p) => p.toLowerCase() === lc)
  );
}

/**
 * Search commands by name, description, or category.
 * @param {string} query - Search query (case-insensitive)
 * @returns {object[]}
 */
function searchCommands(query) {
  const lc = query.toLowerCase();
  return getAllCommands().filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(lc) ||
      (cmd.description && cmd.description.toLowerCase().includes(lc)) ||
      (cmd.category && cmd.category.toLowerCase().includes(lc))
  );
}

/**
 * Get all unique categories.
 * @returns {string[]}
 */
function getCategories() {
  const cats = new Set();
  for (const cmd of _loadAll().values()) {
    if (cmd.category) cats.add(cmd.category);
  }
  return Array.from(cats).sort();
}

/**
 * Get the context engine detectors for a command.
 * @param {string} name - Command name
 * @returns {object|null} The contextEngine config or null
 */
function getContextEngine(name) {
  const cmd = getCommand(name);
  return cmd && cmd.contextEngine ? cmd.contextEngine : null;
}

/**
 * Get subcommands for a command.
 * @param {string} name - Command name
 * @returns {object[]}
 */
function getSubcommands(name) {
  const cmd = getCommand(name);
  return cmd && Array.isArray(cmd.subcommands) ? cmd.subcommands : [];
}

/**
 * Get global options for a command.
 * @param {string} name - Command name
 * @returns {object[]}
 */
function getGlobalOptions(name) {
  const cmd = getCommand(name);
  return cmd && Array.isArray(cmd.globalOptions) ? cmd.globalOptions : [];
}

/**
 * Get examples for a command.
 * @param {string} name - Command name
 * @returns {object[]}
 */
function getExamples(name) {
  const cmd = getCommand(name);
  return cmd && Array.isArray(cmd.examples) ? cmd.examples : [];
}

/**
 * Get the total number of commands available.
 * @returns {number}
 */
function count() {
  return _loadAll().size;
}

/**
 * Clear the internal cache (useful for testing).
 */
function clearCache() {
  _cache = null;
}

/**
 * Resolve the path to a specific command JSON file.
 * @param {string} name - Command name
 * @returns {string}
 */
function resolveCommandPath(name) {
  return path.join(COMMANDS_DIR, `${name}.json`);
}

/** @type {string} Path to the commands data directory */
const dataDir = COMMANDS_DIR;

module.exports = {
  getCommand,
  getAllCommands,
  listCommandNames,
  getCommandsByCategory,
  getCommandsByPlatform,
  searchCommands,
  getCategories,
  getContextEngine,
  getSubcommands,
  getGlobalOptions,
  getExamples,
  count,
  clearCache,
  resolveCommandPath,
  dataDir,
};