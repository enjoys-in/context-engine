#!/usr/bin/env node
/**
 * Regenerates `data/manifest.json` from disk and validates every data file
 * against MONACO_LANGUAGES_API.instructions.md.
 *
 *   node build.mjs            regenerate the manifest, then validate
 *   node build.mjs --check    validate only (no writes) — for CI / prepublish
 *
 * Exits non-zero on any validation failure.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = import.meta.dirname;
const DATA = path.join(ROOT, "data");
const CHECK_ONLY = process.argv.includes("--check");

/**
 * Language inheritance, owned here so a rebuild cannot drop it.
 *
 * These languages are authored as thin layers on a base — measured label
 * overlap with their base is 0-15%, so serving them standalone loses the
 * base entirely (a TypeScript file saw no `console`, no keywords). The LSP
 * merges base -> overlay when resolving a provider.
 */
const EXTENDS = {
  typescript: "javascript",
  react: "javascript",
  coffee: "javascript",
  flow9: "javascript",
  nextjs: "react",
  shadcn: "react",
  angular: "typescript",
  nestjs: "typescript",
  scss: "css",
  less: "css",
  tailwindcss: "css",
  mdx: "markdown",
  razor: "html",
  twig: "html",
  liquid: "html",
  pgsql: "sql",
  mysql: "sql",
  redshift: "sql",
  "redis-cli": "redis",
};

/** Directory descriptions, owned here so the manifest never depends on its own prior content. */
const DESCRIPTIONS = {
  codeActions: "Quick-fix, refactor and source actions for registerCodeActionProvider",
  codeLens: "Inline actionable annotations (references, tests, run) for registerCodeLensProvider",
  color: "Color literal patterns and presentations for registerColorProvider",
  completion: "Autocomplete suggestions with snippets, functions, keywords, documentation and trigger characters",
  declaration: "Go-to-declaration patterns for registerDeclarationProvider",
  definition: "Symbol definitions with signatures, descriptions and types for registerDefinitionProvider",
  documentHighlight: "Occurrence highlighting for registerDocumentHighlightProvider",
  documentRangeFormatting: "Format-selection rules for registerDocumentRangeFormattingEditProvider",
  documentSymbol: "Outline, breadcrumb and go-to-symbol patterns for registerDocumentSymbolProvider",
  foldingRange: "Code folding rules and region markers for registerFoldingRangeProvider",
  formatting: "Whole-document formatting rules for registerDocumentFormattingEditProvider",
  hover: "Hover tooltip contents for registerHoverProvider",
  implementation: "Go-to-implementation patterns for registerImplementationProvider",
  inlayHints: "Inline type and parameter hints for registerInlayHintsProvider",
  inlineCompletions: "Ghost-text and AI inline completion templates for registerInlineCompletionsProvider",
  languageConfiguration: "setLanguageConfiguration data \u2014 comments, brackets, auto-closing and surrounding pairs, word pattern, indentation rules, onEnter rules and folding",
  linkedEditingRange: "Linked editing pairs, such as HTML tag pairs, for registerLinkedEditingRangeProvider",
  links: "Clickable document link patterns for registerLinkProvider",
  monarchTokens: "IMonarchLanguage tokenizer grammars for setMonarchTokensProvider",
  multiDocumentHighlight: "Cross-file symbol highlighting for registerMultiDocumentHighlightProvider",
  newSymbolNames: "AI rename suggestions for registerNewSymbolNameProvider",
  onTypeFormatting: "Format-as-you-type rules and trigger characters for registerOnTypeFormattingEditProvider",
  rangeSemanticTokens: "Range-scoped semantic highlighting for registerDocumentRangeSemanticTokensProvider",
  references: "Find-all-references patterns for registerReferenceProvider",
  rename: "Rename validation, identifier rules and prepare-rename patterns for registerRenameProvider",
  selectionRange: "Smart-selection expand/shrink patterns for registerSelectionRangeProvider",
  semanticTokens: "Semantic highlighting legend and rules for registerDocumentSemanticTokensProvider",
  signatureHelp: "Parameter hints with trigger characters for registerSignatureHelpProvider",
  typeDefinition: "Go-to-type-definition data for registerTypeDefinitionProvider",
};

const problems = [];
const fail = (msg) => problems.push(msg);

const isDir = (p) => fs.statSync(p).isDirectory();
const jsonFiles = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const read = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

const allDirs = fs.readdirSync(DATA).filter((d) => isDir(path.join(DATA, d))).sort();
/** Provider directories are per-language; commands/themes are not. */
const providerDirs = allDirs.filter((d) => d !== "commands" && d !== "themes");
const languages = jsonFiles(path.join(DATA, "completion")).map((f) => f.replace(/\.json$/, ""));

// ── 1. Every provider covers every language ──────────────────────────
for (const dir of providerDirs) if (!DESCRIPTIONS[dir]) fail(`build.mjs DESCRIPTIONS is missing "${dir}"`);

for (const dir of providerDirs) {
  const have = new Set(jsonFiles(path.join(DATA, dir)).map((f) => f.replace(/\.json$/, "")));
  for (const lang of languages) if (!have.has(lang)) fail(`${dir}/ is missing ${lang}.json`);
  for (const lang of have) if (!languages.includes(lang)) fail(`${dir}/${lang}.json has no completion counterpart`);
}

// ── 2. Parse, identity, and canonical key coverage ───────────────────
// The canonical key set for a directory is its majority shape; a file may add
// keys (the spec permits extras) but must never be missing one.
for (const dir of providerDirs) {
  const files = jsonFiles(path.join(DATA, dir));
  const parsed = [];
  for (const f of files) {
    try {
      parsed.push([f, read(path.join(DATA, dir, f))]);
    } catch (e) {
      fail(`${dir}/${f} does not parse: ${e.message}`);
    }
  }
  const dist = new Map();
  for (const [, d] of parsed) {
    const sig = Object.keys(d).sort().join(",");
    dist.set(sig, (dist.get(sig) ?? 0) + 1);
  }
  const canon = [...dist.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",");
  for (const [f, d] of parsed) {
    if (d.language !== f.replace(/\.json$/, "")) fail(`${dir}/${f} language is "${d.language}"`);
    const have = new Set(Object.keys(d));
    const lack = canon.filter((k) => !have.has(k));
    if (lack.length) fail(`${dir}/${f} missing canonical key(s): ${lack.join(", ")}`);
  }
}

// ── 3. Regex fields must compile and must not be double-escaped ──────
// A generator bug once JSON-escaped these twice, so `\\s` reached RegExp as
// a literal backslash + "s" and matched nothing.
const RE_FIELDS = new Set([
  "pattern", "triggerPattern", "startPattern", "endPattern", "increasePattern",
  "decreasePattern", "openPattern", "closePattern", "identifierPattern", "wordPattern",
  "importPattern", "exportPattern", "regex", "start", "end", "match", "import", "export",
  "unindentPattern", "indentNextLinePattern", "increaseIndentPattern", "decreaseIndentPattern",
  "unIndentedLinePattern", "beforeText", "afterText", "previousLineText", "firstLine",
  // Array-valued: references[].patterns holds a list of regexes. Its absence
  // here is why 460 double-escaped patterns under `patterns: [...]` shipped.
  "patterns", "symbolPattern",
]);
/**
 * A run of exactly two backslashes before an escape that only makes sense as an
 * escape — the bug signature.
 *
 * The class must cover n/r/t/f/v as well as the character classes. An earlier
 * repair used [sSwWdDbB] alone, which left 198 doubled `\\n` values behind in
 * formatting and selectionRange: each still compiles — as a literal backslash
 * followed by "n" — so it never matched and never failed to parse.
 */
const DOUBLED = /(?:^|[^\\])\\{2}[nrtfvsSwWdDbB]/;
let regexCount = 0;
const walkRegex = (node, where) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((v, i) => walkRegex(v, `${where}[${i}]`));
  for (const [k, v] of Object.entries(node)) {
    if (RE_FIELDS.has(k)) {
      // A regex field may hold one pattern or an array of them (e.g.
      // references[].patterns). Only checking the string case is how 460
      // double-escaped patterns under `patterns: [...]` went unnoticed.
      const list = typeof v === "string" ? [v] : Array.isArray(v) ? v : [];
      list.forEach((s, i) => {
        if (typeof s !== "string") return;
        regexCount++;
        const at = typeof v === "string" ? `${where}.${k}` : `${where}.${k}[${i}]`;
        try { new RegExp(s); } catch (e) { fail(`${at} will not compile: ${e.message}`); }
        if (DOUBLED.test(s)) fail(`${at} is double-escaped: ${JSON.stringify(s)}`);
      });
      if (typeof v === "string") continue;
    }
    walkRegex(v, `${where}.${k}`);
  }
};
for (const dir of providerDirs)
  for (const f of jsonFiles(path.join(DATA, dir)))
    walkRegex(read(path.join(DATA, dir, f)), `${dir}/${f}`);

// ── 4. Enum values (instructions §32) ────────────────────────────────
const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
for (const f of jsonFiles(path.join(DATA, "completion"))) {
  const d = read(path.join(DATA, "completion", f));
  if (!Array.isArray(d.triggerCharacters)) fail(`completion/${f} has no triggerCharacters`);
  (d.completions ?? []).forEach((c, i) => {
    if (c.kind !== undefined && !inRange(c.kind, 0, 28)) fail(`completion/${f}[${i}].kind=${JSON.stringify(c.kind)} — CompletionItemKind is 0..28`);
    if (c.insertTextRules !== undefined && ![0, 1, 4].includes(c.insertTextRules)) fail(`completion/${f}[${i}].insertTextRules=${c.insertTextRules} — expected 0, 1 or 4`);
    if (typeof c.insertText === "string" && (/\$\{\d/.test(c.insertText) || /\$0\b/.test(c.insertText)) && c.insertTextRules !== 4)
      fail(`completion/${f}[${i}] "${c.label}" has snippet insertText but insertTextRules !== 4 (InsertAsSnippet)`);
  });
}
for (const f of jsonFiles(path.join(DATA, "documentSymbol"))) {
  const d = read(path.join(DATA, "documentSymbol", f));
  (d.symbolPatterns ?? []).forEach((s, i) => {
    if (s.kind !== undefined && !inRange(s.kind, 0, 25)) fail(`documentSymbol/${f}[${i}].kind=${JSON.stringify(s.kind)} — SymbolKind is 0..25`);
  });
}
for (const f of jsonFiles(path.join(DATA, "inlayHints"))) {
  const d = read(path.join(DATA, "inlayHints", f));
  const chk = (h, w) => { if (h?.kind !== undefined && ![1, 2].includes(h.kind)) fail(`inlayHints/${f}${w}.kind=${JSON.stringify(h.kind)} — InlayHintKind is 1 or 2`); };
  (d.inlayHintPatterns ?? []).forEach((h, i) => { chk(h, `[${i}]`); (h.hints ?? []).forEach((x, j) => chk(x, `[${i}].hints[${j}]`)); });
}
for (const f of jsonFiles(path.join(DATA, "codeActions"))) {
  const d = read(path.join(DATA, "codeActions", f));
  const declared = d.providedCodeActionKinds ?? [];
  (d.codeActions ?? []).forEach((a, i) => {
    if (a.kind && !declared.some((k) => a.kind === k || a.kind.startsWith(k + ".")))
      fail(`codeActions/${f}[${i}].kind "${a.kind}" is not covered by providedCodeActionKinds`);
  });
}

// ── 5. Monarch: every @reference must resolve (§31) ──────────────────
const MONARCH_BUILTIN = new Set(["@pop", "@push", "@popall", "@rematch", "@default", "@keywords", "@eos"]);
for (const f of jsonFiles(path.join(DATA, "monarchTokens"))) {
  const d = read(path.join(DATA, "monarchTokens", f));
  if (!d.tokenizer) { fail(`monarchTokens/${f} has no "tokenizer" — IMonarchLanguage requires it`); continue; }
  const names = new Set([...Object.keys(d), ...Object.keys(d.tokenizer)]);
  const refs = new Set();
  const scan = (n) => {
    if (typeof n === "string") { (n.match(/@[A-Za-z_]\w*/g) ?? []).forEach((r) => refs.add(r)); return; }
    if (Array.isArray(n)) return n.forEach(scan);
    if (n && typeof n === "object") for (const [k, v] of Object.entries(n)) { if (k.startsWith("@")) refs.add(k); scan(v); }
  };
  scan(d.tokenizer);
  for (const r of refs)
    if (!MONARCH_BUILTIN.has(r) && !names.has(r.slice(1))) fail(`monarchTokens/${f} references unresolved ${r}`);
}

// ── 6. languageConfiguration (§4) ────────────────────────────────────
for (const f of jsonFiles(path.join(DATA, "languageConfiguration"))) {
  const d = read(path.join(DATA, "languageConfiguration", f));
  if (!d.comments || (!d.comments.lineComment && !d.comments.blockComment))
    fail(`languageConfiguration/${f} defines no comments — comment toggling would be dead`);
  if (d.comments?.blockComment && !(Array.isArray(d.comments.blockComment) && d.comments.blockComment.length === 2))
    fail(`languageConfiguration/${f} blockComment is not a CharacterPair`);
  for (const key of ["brackets", "colorizedBracketPairs"])
    for (const b of d[key] ?? [])
      if (!Array.isArray(b) || b.length !== 2 || b.some((x) => typeof x !== "string"))
        fail(`languageConfiguration/${f} ${key} entry is not a CharacterPair: ${JSON.stringify(b)}`);
  for (const key of ["autoClosingPairs", "surroundingPairs"])
    for (const p of d[key] ?? [])
      if (typeof p.open !== "string" || typeof p.close !== "string")
        fail(`languageConfiguration/${f} ${key} entry needs string open/close`);
  if (typeof d.folding?.offSide !== "boolean") fail(`languageConfiguration/${f} folding.offSide must be boolean`);
  // IndentAction: None=0, Indent=1, IndentOutdent=2, Outdent=3
  (d.onEnterRules ?? []).forEach((r, i) => {
    if (![0, 1, 2, 3].includes(r.action?.indentAction))
      fail(`languageConfiguration/${f} onEnterRules[${i}].action.indentAction=${r.action?.indentAction} — IndentAction is 0..3`);
  });
  // folding must agree with the foldingRange provider for the same language
  const fr = read(path.join(DATA, "foldingRange", f));
  if (d.folding.offSide !== (fr.offSide === true))
    fail(`languageConfiguration/${f} folding.offSide disagrees with foldingRange/${f}`);
}

// ── 7. languages.json — ILanguageExtensionPoint[] (§2) ───────────────
const registry = read(path.join(DATA, "languages.json"));
if (!Array.isArray(registry)) fail("languages.json must be an array of ILanguageExtensionPoint");
else {
  const seen = new Set();
  for (const e of registry) {
    if (!languages.includes(e.id)) fail(`languages.json has unknown id "${e.id}"`);
    if (seen.has(e.id)) fail(`languages.json has duplicate id "${e.id}"`);
    seen.add(e.id);
    if (!e.aliases?.length) fail(`languages.json ${e.id} has no aliases`);
    if (!e.mimetypes?.length) fail(`languages.json ${e.id} has no mimetypes`);
    if (!e.extensions?.length && !e.filenames?.length && !e.filenamePatterns?.length)
      fail(`languages.json ${e.id} has no file association`);
    for (const x of e.extensions ?? []) if (!x.startsWith(".")) fail(`languages.json ${e.id} extension "${x}" must start with "."`);
    if (e.firstLine) { try { new RegExp(e.firstLine); } catch (err) { fail(`languages.json ${e.id} firstLine: ${err.message}`); } }
  }
  for (const lang of languages) if (!seen.has(lang)) fail(`languages.json is missing an entry for ${lang}`);
}

// ── 7b. Language inheritance must name real languages and not cycle ──
for (const [child, parent] of Object.entries(EXTENDS)) {
  if (!languages.includes(child)) fail(`EXTENDS has unknown language "${child}"`);
  if (!languages.includes(parent)) fail(`EXTENDS: "${child}" extends unknown "${parent}"`);
  if (child === parent) fail(`EXTENDS: "${child}" extends itself`);
}
for (const child of Object.keys(EXTENDS)) {
  const seen = new Set([child]);
  for (let cur = EXTENDS[child]; cur; cur = EXTENDS[cur]) {
    if (seen.has(cur)) { fail(`EXTENDS: inheritance cycle through "${child}"`); break; }
    seen.add(cur);
  }
}

// ── 8. Regenerate the manifest ───────────────────────────────────────
const manifestPath = path.join(DATA, "manifest.json");
const prev = fs.existsSync(manifestPath) ? read(manifestPath) : {};
const pkg = read(path.join(ROOT, "package.json"));
const NAMES = Object.fromEntries((prev.languages ?? []).map((l) => [l.id, l.name]));
// Every .json under data/, including the two at its root (manifest.json,
// languages.json) and the nested commands/manifest.json.
const countJson = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? countJson(path.join(dir, e.name)) : e.name.endsWith(".json") ? 1 : 0),
    0
  );
const totalFiles = countJson(DATA);

const manifest = {
  version: pkg.version,
  description: prev.description ?? pkg.description,
  generatedAt: new Date().toISOString().slice(0, 10),
  totalLanguages: languages.length,
  totalProviders: providerDirs.length + 1, // + commands
  totalFiles,
  totalThemes: jsonFiles(path.join(DATA, "themes")).filter((f) => !f.startsWith("_")).length,
  themes: prev.themes ?? {},
  languageRegistry: "languages.json",
  languages: languages.map((id) => {
    const files = {};
    for (const dir of [...providerDirs, "commands"])
      if (fs.existsSync(path.join(DATA, dir, `${id}.json`))) files[dir] = `${dir}/${id}.json`;
    const entry = { id, name: NAMES[id] ?? id, files };
    if (EXTENDS[id]) entry.extends = EXTENDS[id];
    return entry;
  }),
  directories: Object.fromEntries(
    providerDirs.map((d) => [d, {
      description: DESCRIPTIONS[d] ?? prev.directories?.[d]?.description ?? d,
      files: jsonFiles(path.join(DATA, d)),
    }])
  ),
};

// ── 9. Docs and the commands manifest must not drift ─────────────────
// Both of these had silently gone stale before.
{
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf-8");
  const start = readme.indexOf("## Supported Languages");
  const table = start === -1 ? "" : readme.slice(start, readme.indexOf("## Covered Commands", start));
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hay = norm(table);
  const names = Object.fromEntries(manifest.languages.map((l) => [l.id, l.name]));
  for (const id of languages)
    if (!hay.includes(norm(id)) && !hay.includes(norm(names[id] ?? id)))
      fail(`README "Supported Languages" table does not mention ${id} (${names[id] ?? id})`);

  const cmdManifestPath = path.join(DATA, "commands", "manifest.json");
  if (fs.existsSync(cmdManifestPath)) {
    const listed = new Set(read(cmdManifestPath).files ?? []);
    const onDisk = jsonFiles(path.join(DATA, "commands")).filter((f) => f !== "manifest.json");
    for (const f of onDisk) if (!listed.has(f)) fail(`data/commands/manifest.json does not list ${f}`);
    for (const f of listed) if (!onDisk.includes(f)) fail(`data/commands/manifest.json lists missing ${f}`);
    // Every command file must also sit in exactly one context category.
    const cm = read(cmdManifestPath);
    const byFile = new Map();
    for (const cat of cm.context ?? [])
      for (const f of cat.files ?? []) {
        if (!onDisk.includes(f)) fail(`data/commands/manifest.json context "${cat.category}" references missing ${f}`);
        byFile.set(f, (byFile.get(f) ?? 0) + 1);
      }
    // Binary aliases must be unambiguous: unique across commands, and never
    // the same string as a real command name.
    const names = new Set();
    const aliasOwner = new Map();
    for (const f2 of onDisk) names.add(read(path.join(DATA, "commands", f2)).name);
    for (const f2 of onDisk) {
      const d2 = read(path.join(DATA, "commands", f2));
      for (const a of d2.aliases ?? []) {
        if (names.has(a)) fail(`commands/${f2} alias "${a}" is already a command name`);
        if (aliasOwner.has(a)) fail(`commands/${f2} alias "${a}" is also claimed by ${aliasOwner.get(a)}`);
        aliasOwner.set(a, f2);
      }
    }
    // A command may appear under more than one category on purpose — this is a
    // display/autocomplete taxonomy for the terminal, not an exclusive filing
    // system. Only "no category at all" is a defect.
    for (const f of onDisk)
      if (!byFile.has(f)) fail(`data/commands/manifest.json puts ${f} in no context category`);
  }
}

// ── 10. Command files — terminal autocomplete needs completable data ──
{
  const VALUED = new Set(["string", "path", "file", "directory", "number", "integer", "url"]);
  for (const f of jsonFiles(path.join(DATA, "commands")).filter((x) => x !== "manifest.json")) {
    const d = read(path.join(DATA, "commands", f));
    const where = `commands/${f}`;
    for (const k of ["name", "description", "category", "platforms", "shells"])
      if (d[k] === undefined) fail(`${where} has no ${k}`);
    const subs = d.subcommands ?? [];
    const gopts = d.globalOptions ?? [];
    // Nothing to suggest means the entry cannot participate in completion at all.
    if (subs.length === 0 && gopts.length === 0)
      fail(`${where} has neither subcommands nor globalOptions — nothing to autocomplete`);
    if (!(d.examples ?? []).length) fail(`${where} has no examples`);
    if (!(d.relatedCommands ?? []).length) fail(`${where} has no relatedCommands`);

    const checkOption = (o, at) => {
      // A bare string carries no description, so the completion menu has nothing to show.
      if (typeof o === "string") return fail(`${where} ${at} option "${o}" is a bare string, expected {name, description}`);
      if (!o || typeof o !== "object") return fail(`${where} ${at} option is not an object`);
      if (!o.name) fail(`${where} ${at} option has no name`);
      if (!o.description) fail(`${where} ${at} option "${o.name}" has no description`);
      if (typeof o.type === "string" && typeof o.takesValue === "boolean" && o.takesValue !== VALUED.has(o.type))
        fail(`${where} ${at} option "${o.name}" has type "${o.type}" but takesValue ${o.takesValue}`);
      if (o.shorthand !== undefined && o.short === undefined)
        fail(`${where} ${at} option "${o.name}" has shorthand but no short`);
    };
    gopts.forEach((o, i) => checkOption(o, `globalOptions[${i}]`));
    for (const s2 of subs) {
      if (!s2.name) fail(`${where} has a subcommand with no name`);
      if (!s2.description) fail(`${where} subcommand "${s2.name}" has no description`);
      (s2.options ?? []).forEach((o, i) => checkOption(o, `subcommand "${s2.name}" options[${i}]`));
    }
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) found:\n`);
  for (const p of problems.slice(0, 60)) console.error(`  ✗ ${p}`);
  if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
  console.error("");
  process.exit(1);
}

if (CHECK_ONLY) {
  const current = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf-8") : "";
  const next = JSON.stringify(manifest, null, 2) + "\n";
  // generatedAt moves every day, so compare everything else
  const strip = (s) => s.replace(/"generatedAt": "[^"]*",\n/, "");
  if (strip(current) !== strip(next)) {
    console.error("\n  ✗ data/manifest.json is stale — run `npm run build`\n");
    process.exit(1);
  }
} else {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

console.log(
  `\n✓ ${CHECK_ONLY ? "validated" : "built"}: ${languages.length} languages · ` +
  `${providerDirs.length} providers · ${totalFiles} files · ${regexCount} regex fields · ` +
  `${manifest.totalThemes} themes\n`
);
