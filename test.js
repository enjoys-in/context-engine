"use strict";

const engine = require("./index");
const fs = require("node:fs");
const path = require("node:path");
// Derived from disk, not hardcoded: adding a command must not break the suite.
const CMD_COUNT = new Set(
  fs.readdirSync(path.join(__dirname, "data", "commands"))
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, "data", "commands", f), "utf-8")).name)
).size;

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log("\n@enjoys/context-engine tests\n");

// count
assert(engine.count() === CMD_COUNT, `count() === ${CMD_COUNT} (got ${engine.count()})`);

// listCommandNames
const names = engine.listCommandNames();
assert(Array.isArray(names) && names.length === CMD_COUNT, `listCommandNames() returns ${CMD_COUNT} names`);
assert(names.includes("git"), "includes git");
assert(names.includes("docker"), "includes docker");
assert(names.includes("kubectl"), "includes kubectl");

// getCommand
const git = engine.getCommand("git");
assert(git !== undefined, "getCommand('git') found");
assert(git.name === "git", "git.name === 'git'");
assert(Array.isArray(git.subcommands) && git.subcommands.length > 0, "git has subcommands");

// getCommand missing
assert(engine.getCommand("nonexistent") === undefined, "getCommand('nonexistent') === undefined");

// searchCommands
const res = engine.searchCommands("docker");
assert(res.length >= 1, "searchCommands('docker') finds results");
assert(res.some((c) => c.name === "docker"), "search finds docker");

// getCategories
const cats = engine.getCategories();
assert(cats.length > 0, "getCategories() not empty");

// getCommandsByPlatform
const win = engine.getCommandsByPlatform("windows");
assert(win.some((c) => c.name === "winget"), "windows platform includes winget");
assert(win.some((c) => c.name === "choco"), "windows platform includes choco");

// getContextEngine
const ctx = engine.getContextEngine("git");
assert(ctx !== null, "getContextEngine('git') not null");
assert(Array.isArray(ctx.detectors), "git has detectors");

// getSubcommands
const subs = engine.getSubcommands("docker");
assert(subs.length > 0, "docker has subcommands");

// getGlobalOptions
const opts = engine.getGlobalOptions("curl");
assert(opts.length > 0, "curl has globalOptions");

// getExamples
const ex = engine.getExamples("git");
assert(ex.length > 0, "git has examples");

// resolveCommandPath
const p = engine.resolveCommandPath("git");
assert(p.endsWith("git.json"), "resolveCommandPath ends with git.json");

// clearCache
engine.clearCache();
assert(engine.count() === CMD_COUNT, `count() still ${CMD_COUNT} after clearCache`);

// ── Languages ────────────────────────────────────────────────
const langs = engine.listLanguages();
// Derived from disk, not hardcoded: adding a language must not break the suite.
const LANG_COUNT = engine.listLanguagesForProvider("completion").length;
assert(langs.length === LANG_COUNT, `listLanguages() === ${LANG_COUNT} (got ${langs.length})`);
assert(!langs.includes("git") && !langs.includes("docker"), "listLanguages() excludes CLI command names");
assert(langs.includes("typescript") && langs.includes("python"), "listLanguages() includes real languages");

// ── Language configuration (setLanguageConfiguration) ────────
assert(
  engine.listLanguagesForProvider("languageConfiguration").length === LANG_COUNT,
  `languageConfiguration covers all ${LANG_COUNT} languages`
);
const ts = engine.getLanguageConfiguration("typescript");
assert(ts.comments.lineComment === "//", "typescript lineComment is //");
assert(Array.isArray(ts.comments.blockComment) && ts.comments.blockComment[0] === "/*", "typescript blockComment is a CharacterPair");
assert(ts.brackets.length === 3, "typescript declares 3 bracket pairs");
assert(engine.getLanguageConfiguration("python").folding.offSide === true, "python is off-side");
assert(engine.getLanguageConfiguration("css").comments.lineComment === undefined, "css has no line comment");

const monacoCfg = engine.toMonacoLanguageConfiguration("typescript");
assert(monacoCfg.wordPattern instanceof RegExp, "toMonacoLanguageConfiguration revives wordPattern to RegExp");
assert(monacoCfg.indentationRules.increaseIndentPattern instanceof RegExp, "revives indentationRules to RegExp");
assert(monacoCfg.onEnterRules[0].beforeText instanceof RegExp, "revives onEnterRules to RegExp");
assert(!("language" in monacoCfg), "toMonacoLanguageConfiguration drops the language key");
assert(!("description" in monacoCfg.onEnterRules[0]), "toMonacoLanguageConfiguration strips onEnter descriptions");
assert(monacoCfg.indentationRules.increaseIndentPattern.test("function f() {"), "typescript indent pattern matches an opening brace");
assert(engine.toMonacoLanguageConfiguration("nope") === null, "unknown language returns null");

// ── Language registration (ILanguageExtensionPoint) ──────────
const points = engine.getLanguageExtensionPoints();
assert(points.length === LANG_COUNT, `getLanguageExtensionPoints() === ${LANG_COUNT} (got ${points.length})`);
assert(points.every((p) => typeof p.id === "string" && Array.isArray(p.aliases)), "every extension point has id + aliases");
const py = engine.getLanguageExtensionPoint("python");
assert(py.extensions.includes(".py"), "python registers .py");
assert(new RegExp(py.firstLine).test("#!/usr/bin/env python3"), "python firstLine matches a shebang");
assert(engine.getLanguageExtensionPoint("dockerfile").filenames.includes("Dockerfile"), "dockerfile registers the Dockerfile filename");
assert(engine.getLanguageExtensionPoint("nope") === null, "unknown extension point returns null");

// ── Completion trigger characters ────────────────────────────
assert(
  engine.listLanguagesForProvider("completion").every((l) => Array.isArray(engine.getProviderData("completion", l).triggerCharacters)),
  "every completion file declares triggerCharacters"
);
assert(engine.getProviderData("completion", "typescript").triggerCharacters.includes("."), "typescript completion triggers on .");

// ── Command data for terminal autocomplete ───────────────────
const cmdNames = engine.listCommandNames();
assert(
  cmdNames.every((c) => {
    const d = engine.getCommand(c);
    return (d.subcommands?.length ?? 0) > 0 || (d.globalOptions?.length ?? 0) > 0;
  }),
  "every command has subcommands or globalOptions to complete"
);
assert(
  cmdNames.every((c) => (engine.getCommand(c).examples?.length ?? 0) > 0),
  "every command has examples"
);
// Options must be objects, never bare strings, or the menu has no description
let bareOpts = 0, noDesc = 0, badTakesValue = 0;
const VALUED = new Set(["string", "path", "file", "directory", "number", "integer", "url"]);
for (const c of cmdNames) {
  const d = engine.getCommand(c);
  const all = [...(d.globalOptions ?? []), ...(d.subcommands ?? []).flatMap((s) => s.options ?? [])];
  for (const o of all) {
    if (typeof o === "string") { bareOpts++; continue; }
    if (!o.description) noDesc++;
    if (typeof o.type === "string" && typeof o.takesValue === "boolean" && o.takesValue !== VALUED.has(o.type)) badTakesValue++;
    if (o.shorthand !== undefined && o.short === undefined) badTakesValue++;
  }
}
assert(bareOpts === 0, `no option is a bare string (found ${bareOpts})`);
assert(noDesc === 0, `every option has a description (missing ${noDesc})`);
assert(badTakesValue === 0, `takesValue agrees with type and short is always set (${badTakesValue} bad)`);

// getExamples() must be one shape regardless of how the data stores it
const gitEx = engine.getExamples("git");
const linuxEx = engine.getExamples("linux");
assert(gitEx.every((e) => typeof e.command === "string" && typeof e.description === "string"), "getExamples normalizes string examples");
assert(linuxEx.every((e) => typeof e.command === "string" && typeof e.description === "string"), "getExamples normalizes object examples");
assert(linuxEx[0].description.length > 0, "object examples keep their description");
assert(typeof engine.getRawExamples("git")[0] === "string", "getRawExamples preserves the stored shape");
const allEx = engine.getAllExamples("git");
assert(allEx.length > gitEx.length, "getAllExamples includes subcommand examples");
assert(allEx.some((e) => e.subcommand !== null), "getAllExamples tags the subcommand");
assert(engine.getAllExamples("nope").length === 0, "getAllExamples on an unknown command returns []");

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
