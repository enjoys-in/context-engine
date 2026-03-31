// src/index.ts
import * as fs from "node:fs";
import * as path from "node:path";
var ROOT = typeof __dirname !== "undefined" ? __dirname : path.dirname(new URL(import.meta.url).pathname);
var DATA_DIR = path.join(ROOT, "data");
var COMMANDS_DIR = path.join(DATA_DIR, "commands");
var PROVIDERS = [
  "codeActions",
  "codeLens",
  "color",
  "commands",
  "completion",
  "declaration",
  "definition",
  "documentHighlight",
  "documentRangeFormatting",
  "documentSymbol",
  "foldingRange",
  "formatting",
  "hover",
  "implementation",
  "inlayHints",
  "inlineCompletions",
  "linkedEditingRange",
  "links",
  "monarchTokens",
  "multiDocumentHighlight",
  "newSymbolNames",
  "onTypeFormatting",
  "rangeSemanticTokens",
  "references",
  "rename",
  "selectionRange",
  "semanticTokens",
  "signatureHelp",
  "typeDefinition"
];
var _commandCache = null;
function loadCommands() {
  if (_commandCache) return _commandCache;
  _commandCache = /* @__PURE__ */ new Map();
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(COMMANDS_DIR, file), "utf-8"));
    _commandCache.set(data.name, data);
  }
  return _commandCache;
}
var _providerCache = /* @__PURE__ */ new Map();
function providerCacheKey(provider, lang) {
  return `${provider}/${lang}`;
}
function getCommand(name) {
  return loadCommands().get(name);
}
function getAllCommands() {
  return Array.from(loadCommands().values());
}
function listCommandNames() {
  return Array.from(loadCommands().keys()).sort();
}
function getCommandsByCategory(category) {
  const lc = category.toLowerCase();
  return getAllCommands().filter((cmd) => cmd.category && cmd.category.toLowerCase().includes(lc));
}
function getCommandsByPlatform(platform) {
  const lc = platform.toLowerCase();
  return getAllCommands().filter(
    (cmd) => Array.isArray(cmd.platforms) && cmd.platforms.some((p) => p.toLowerCase() === lc)
  );
}
function searchCommands(query) {
  const lc = query.toLowerCase();
  return getAllCommands().filter(
    (cmd) => cmd.name.toLowerCase().includes(lc) || cmd.description && cmd.description.toLowerCase().includes(lc) || cmd.category && cmd.category.toLowerCase().includes(lc)
  );
}
function getCategories() {
  const cats = /* @__PURE__ */ new Set();
  for (const cmd of loadCommands().values()) {
    if (cmd.category) cats.add(cmd.category);
  }
  return Array.from(cats).sort();
}
function getContextEngine(name) {
  const cmd = getCommand(name);
  return cmd?.contextEngine ?? null;
}
function getSubcommands(name) {
  const cmd = getCommand(name);
  return Array.isArray(cmd?.subcommands) ? cmd.subcommands : [];
}
function getGlobalOptions(name) {
  const cmd = getCommand(name);
  return Array.isArray(cmd?.globalOptions) ? cmd.globalOptions : [];
}
function getExamples(name) {
  const cmd = getCommand(name);
  return Array.isArray(cmd?.examples) ? cmd.examples : [];
}
function count() {
  return loadCommands().size;
}
function clearCache() {
  _commandCache = null;
  _providerCache.clear();
}
function resolveCommandPath(name) {
  return path.join(COMMANDS_DIR, `${name}.json`);
}
var dataDir = COMMANDS_DIR;
function getProviderData(provider, languageId) {
  const key = providerCacheKey(provider, languageId);
  if (_providerCache.has(key)) return _providerCache.get(key);
  const filePath = path.join(DATA_DIR, provider, `${languageId}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    _providerCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
function getLanguageData(languageId) {
  const result = {};
  for (const provider of PROVIDERS) {
    const data = getProviderData(provider, languageId);
    if (data) result[provider] = data;
  }
  return result;
}
function listLanguagesForProvider(provider) {
  const dir = path.join(DATA_DIR, provider);
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
function listLanguages() {
  const langs = /* @__PURE__ */ new Set();
  for (const provider of PROVIDERS) {
    for (const lang of listLanguagesForProvider(provider)) {
      langs.add(lang);
    }
  }
  return Array.from(langs).sort();
}
function listProviders() {
  return PROVIDERS;
}
function resolveProviderPath(provider, languageId) {
  return path.join(DATA_DIR, provider, `${languageId}.json`);
}
var _manifest = null;
function getManifest() {
  if (_manifest) return _manifest;
  _manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "manifest.json"), "utf-8"));
  return _manifest;
}
var _themeCache = /* @__PURE__ */ new Map();
function getTheme(name) {
  if (_themeCache.has(name)) return _themeCache.get(name);
  const filePath = path.join(DATA_DIR, "themes", `${name}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    _themeCache.set(name, data);
    return data;
  } catch {
    return null;
  }
}
function listThemes() {
  try {
    return fs.readdirSync(path.join(DATA_DIR, "themes")).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
function resolveThemePath(name) {
  return path.join(DATA_DIR, "themes", `${name}.json`);
}
var index_default = {
  // Commands
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
  // Providers
  getProviderData,
  getLanguageData,
  listLanguagesForProvider,
  listLanguages,
  listProviders,
  resolveProviderPath,
  // Manifest
  getManifest,
  // Themes
  getTheme,
  listThemes,
  resolveThemePath
};
export {
  clearCache,
  count,
  dataDir,
  index_default as default,
  getAllCommands,
  getCategories,
  getCommand,
  getCommandsByCategory,
  getCommandsByPlatform,
  getContextEngine,
  getExamples,
  getGlobalOptions,
  getLanguageData,
  getManifest,
  getProviderData,
  getSubcommands,
  getTheme,
  listCommandNames,
  listLanguages,
  listLanguagesForProvider,
  listProviders,
  listThemes,
  resolveCommandPath,
  resolveProviderPath,
  resolveThemePath,
  searchCommands
};
