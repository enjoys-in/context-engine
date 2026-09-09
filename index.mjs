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
/**
 * Union two lists, de-duplicated by `key`. The richer entry wins a tie: for a
 * subcommand that is the one carrying more options and args.
 */
function mergeList(a, b, key, weight) {
  const out = new Map();
  for (const item of [...(a ?? []), ...(b ?? [])]) {
    if (item === null || item === undefined) continue;
    const id = typeof item === "string" ? item : item?.[key];
    if (id === undefined) continue;
    const prev = out.get(id);
    if (prev === undefined || (weight && weight(item) > weight(prev))) out.set(id, item);
  }
  return [...out.values()];
}
const subWeight = (s) => (s?.options?.length ?? 0) + (s?.args?.length ?? 0) + (s?.description ? 1 : 0);
/**
 * 14 command names are claimed by more than one file, because a language's
 * per-language command data (commands/hcl.json) describes the same CLI as the
 * canonical file (commands/terraform.json). Keying a Map by name meant the last
 * file read simply overwrote the others, discarding 116 authored subcommands —
 * getCommand("dotnet") returned 6 of 28. They are merged instead.
 *
 * The file whose basename equals the command name is canonical and supplies the
 * scalar fields; the rest contribute their subcommands, options and examples.
 */
function mergeCommand(prev, next, nextIsCanonical) {
  const base = nextIsCanonical ? next : prev;
  return {
    ...prev,
    ...next,
    name: base.name,
    description: base.description,
    category: base.category,
    platforms: base.platforms,
    shells: base.shells,
    contextEngine: base.contextEngine ?? prev.contextEngine ?? next.contextEngine,
    subcommands: mergeList(prev.subcommands, next.subcommands, "name", subWeight),
    globalOptions: mergeList(prev.globalOptions, next.globalOptions, "name"),
    examples: mergeList(prev.examples, next.examples, "command"),
    relatedCommands: mergeList(prev.relatedCommands, next.relatedCommands),
  };
}
function loadCommands() {
  if (_commandCache) return _commandCache;
  _commandCache = /* @__PURE__ */ new Map();
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(COMMANDS_DIR, file), "utf-8"));
    const prev = _commandCache.get(data.name);
    if (prev === undefined) {
      _commandCache.set(data.name, data);
      continue;
    }
    _commandCache.set(data.name, mergeCommand(prev, data, file === `${data.name}.json`));
  }
  return _commandCache;
}
var _providerCache = /* @__PURE__ */ new Map();
function providerCacheKey(provider, lang) {
  return `${provider}/${lang}`;
}
var _aliasIndex = null;
/**
 * Binary aliases — the same tool invoked under another name: hx for helix, ncu
 * for npm-check-updates, r2 for radare2, cc for gcc. Declared per command file
 * as `aliases`, so completion resolves whichever name the user typed.
 */
function aliasIndex() {
  if (_aliasIndex) return _aliasIndex;
  _aliasIndex = /* @__PURE__ */ new Map();
  for (const [name, data] of loadCommands()) {
    for (const alias of data.aliases ?? []) if (!_aliasIndex.has(alias)) _aliasIndex.set(alias, name);
  }
  return _aliasIndex;
}
/** Resolve a typed name to its canonical command name. */
function resolveCommandName(name) {
  if (loadCommands().has(name)) return name;
  return aliasIndex().get(name) ?? name;
}
function getCommand(name) {
  return loadCommands().get(resolveCommandName(name));
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
  _aliasIndex = null;
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
  resolveCommandName,
  resolveCommandPath,
  resolveProviderPath,
  resolveThemePath,
  searchCommands,
  toMonacoLanguageConfiguration
};
