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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
