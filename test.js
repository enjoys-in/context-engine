"use strict";

const engine = require("./index");

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
assert(engine.count() === 447, `count() === 447 (got ${engine.count()})`);

// listCommandNames
const names = engine.listCommandNames();
assert(Array.isArray(names) && names.length === 447, "listCommandNames() returns 447 names");
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
assert(engine.count() === 447, "count() still 447 after clearCache");

// ── Languages ────────────────────────────────────────────────
const langs = engine.listLanguages();
assert(langs.length === 96, `listLanguages() === 96 (got ${langs.length})`);
assert(!langs.includes("git") && !langs.includes("docker"), "listLanguages() excludes CLI command names");
assert(langs.includes("typescript") && langs.includes("python"), "listLanguages() includes real languages");

// ── Language configuration (setLanguageConfiguration) ────────
assert(
  engine.listLanguagesForProvider("languageConfiguration").length === 96,
  "languageConfiguration covers all 96 languages"
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
assert(points.length === 96, `getLanguageExtensionPoints() === 96 (got ${points.length})`);
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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
