"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  clearCache: () => clearCache,
  count: () => count,
  dataDir: () => dataDir,
  default: () => index_default,
  getAllCommands: () => getAllCommands,
  getCategories: () => getCategories,
  getCommand: () => getCommand,
  getCommandsByCategory: () => getCommandsByCategory,
  getCommandsByPlatform: () => getCommandsByPlatform,
  getContextEngine: () => getContextEngine,
  getAllExamples: () => getAllExamples,
  getExamples: () => getExamples,
  getRawExamples: () => getRawExamples,
  getGlobalOptions: () => getGlobalOptions,
  getLanguageConfiguration: () => getLanguageConfiguration,
  getLanguageData: () => getLanguageData,
  getLanguageExtensionPoint: () => getLanguageExtensionPoint,
  getLanguageExtensionPoints: () => getLanguageExtensionPoints,
  getManifest: () => getManifest,
  getProviderData: () => getProviderData,
  getSubcommands: () => getSubcommands,
  getTheme: () => getTheme,
  listCommandNames: () => listCommandNames,
  listLanguages: () => listLanguages,
  listLanguagesForProvider: () => listLanguagesForProvider,
  listProviders: () => listProviders,
  listThemes: () => listThemes,
  resolveCommandPath: () => resolveCommandPath,
  resolveProviderPath: () => resolveProviderPath,
  resolveThemePath: () => resolveThemePath,
  toMonacoLanguageConfiguration: () => toMonacoLanguageConfiguration,
  searchCommands: () => searchCommands
});
module.exports = __toCommonJS(index_exports);
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var import_meta = {};
var ROOT = typeof __dirname !== "undefined" ? __dirname : path.dirname(new URL(import_meta.url).pathname);
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
  "languageConfiguration",
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
function normalizeExamples(list) {
  return Array.isArray(list)
    ? list.map((e) => (typeof e === "string" ? { command: e, description: "" } : { command: e?.command ?? "", description: e?.description ?? "" }))
    : [];
}
function getExamples(name) {
  const cmd = getCommand(name);
  return normalizeExamples(cmd?.examples);
}
/** Examples exactly as stored — either a plain string or `{command, description}`. */
function getRawExamples(name) {
  const cmd = getCommand(name);
  return Array.isArray(cmd?.examples) ? cmd.examples : [];
}
/** Every example for a command, including its subcommands', in one uniform shape. */
function getAllExamples(name) {
  const cmd = getCommand(name);
  if (!cmd) return [];
  const out = normalizeExamples(cmd.examples).map((e) => ({ ...e, subcommand: null }));
  for (const sub of cmd.subcommands ?? [])
    for (const e of normalizeExamples(sub.examples)) out.push({ ...e, subcommand: sub.name });
  return out;
}
function count() {
  return loadCommands().size;
}
function clearCache() {
  _commandCache = null;
  _providerCache.clear();
  _languages = null;
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
    if (provider === "commands") continue;
    for (const lang of listLanguagesForProvider(provider)) {
      langs.add(lang);
    }
  }
  return Array.from(langs).sort();
}
function listProviders() {
  return PROVIDERS;
}
// ── Language configuration (monaco.languages.setLanguageConfiguration) ──
function getLanguageConfiguration(languageId) {
  return getProviderData("languageConfiguration", languageId);
}
var RE_FIELDS = ["wordPattern", "increaseIndentPattern", "decreaseIndentPattern", "indentNextLinePattern", "unIndentedLinePattern", "beforeText", "afterText", "previousLineText", "start", "end"];
function reviveRegExp(node, key) {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((v) => reviveRegExp(v, key));
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = typeof v === "string" && RE_FIELDS.includes(k) ? new RegExp(v) : reviveRegExp(v, k);
  }
  return out;
}
function toMonacoLanguageConfiguration(languageId) {
  const raw = getLanguageConfiguration(languageId);
  if (!raw) return null;
  const { language, ...rest } = raw;
  const cfg = reviveRegExp(rest);
  if (cfg.onEnterRules) {
    cfg.onEnterRules = cfg.onEnterRules.map(({ description, ...r }) => r);
  }
  return cfg;
}
// ── Language registration (monaco.languages.register) ──
var _languages = null;
function getLanguageExtensionPoints() {
  if (_languages) return _languages;
  _languages = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "languages.json"), "utf-8"));
  return _languages;
}
function getLanguageExtensionPoint(languageId) {
  return getLanguageExtensionPoints().find((l) => l.id === languageId) ?? null;
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
  // Language configuration + registration
  getLanguageConfiguration,
  toMonacoLanguageConfiguration,
  getLanguageExtensionPoints,
  getLanguageExtensionPoint,
  // Manifest
  getManifest,
  // Themes
  getTheme,
  listThemes,
  resolveThemePath
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  clearCache,
  count,
  dataDir,
  getAllCommands,
  getCategories,
  getCommand,
  getCommandsByCategory,
  getCommandsByPlatform,
  getContextEngine,
  getAllExamples,
  getExamples,
  getRawExamples,
  getGlobalOptions,
  getLanguageConfiguration,
  getLanguageData,
  getLanguageExtensionPoint,
  getLanguageExtensionPoints,
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
  searchCommands,
  toMonacoLanguageConfiguration
});
