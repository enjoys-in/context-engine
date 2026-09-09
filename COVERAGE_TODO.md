# context-engine coverage TODO

Two independent tracks live in this file:

- **T/P sections** — the Monaco language data under `data/<provider>/<language>.json`,
  governed by `MONACO_LANGUAGES_API.instructions.md`.
- **C section** — `data/commands`, which feeds xterm shell autocomplete and has nothing to
  do with `monaco.languages.*`.

Scope note: **javascript and typescript data is excluded by request** — already covered.

---

## DONE this pass

- [x] **T0 — Repair 1,122 broken regexes.** 1,117 double-escaped class escapes (`\\b` -> `\b`)
      across 205 files, plus 5 double-escaped metacharacters in `references/r.json`
      (`\bc\\(` -> `\bc\(`, `data\\.frame` -> `data\.frame`).
      Confined to 3 providers the earlier repair commit missed: `references` (460),
      `formatting` (103), `selectionRange` (95). Affected 95/96 languages.
      **Verified: all 32,884 patterns across 3,371 files now compile; 0 failures.**
- [x] **T1 — `react/rangeSemanticTokens`**: filled 22 `rangeTokenRules` (was the only
      language of 96 with zero). Class/function/arrow components, custom hooks,
      useState/useRef/useCallback/useMemo bindings, JSX tags, fragments, attributes,
      event props, spread, React namespace + type annotations. Validated against the
      file's own `tokenTypes`/`tokenModifiers`/`supportedRangeScopes`.
- [x] **T3 — Closed the validator hole that let T0 ship.** `build.mjs` already had a
      double-escape check, but `RE_FIELDS` was missing `patterns` (plural) and the walk
      only tested `typeof v === "string"` — so **array-valued** regex fields were never
      validated. That is exactly where the 460 `references` bugs lived. Now validates
      **38,325** fields, up from 35,142: 3,183 array patterns had no coverage.
      Verified by re-introducing the bug and confirming a precise failure path.
      (I first added a separate `validate-patterns.mjs`, then deleted it — one validator
      in `npm run validate` beats two overlapping ones.)
- [x] **T2 — `ignore/languageConfiguration`**: added `[...]` glob character-range
      brackets + autoClosing/surrounding/colorized pairs, matching what
      `monarchTokens/ignore.json` already declares as `delimiter.square`.

### Withdrawn — my earlier "hard zero" report was partly wrong
These are **correct as authored**; the zero came from a bad metric on my side, not a gap:
- `ignore/monarchTokens` `keywords: []` — `.gitignore` has no keywords. Its tokenizer
  has 8 working root rules.
- `ignore/implementation` — `.gitignore` has no implementations.
- `crontab/languageConfiguration` `brackets: []` — crontab has no bracket syntax.

---

## P0 — DONE: the pattern engine

New `lsp/src/documentIndex.ts` runs each language's patterns against the open document.
One change, all 96 languages. `documentStore` caches the line index per document version,
so N providers answering one version share a single O(n) build.

Complexity per pattern: O(n) index build (amortised across providers), O(n) scan,
O(1) amortised offset->line via a cursor riding the match order.

| # | Provider | Was | Now |
|---|---|---|---|
| [x] P0.1 | `documentSymbol` | every symbol at line 0 | real ranges, position-sorted, `selectionRange` on the name |
| [x] P0.2 | `declaration` | `null` for 65/96 langs | in-document location via `declarationPatterns`, dict fallback |
| [x] P0.3 | `references` | hardcoded `null` | every occurrence, honours `includeDeclaration` |
| [x] P0.4 | `implementation` | hardcoded `null` | `implementationPatterns` |
| [x] P0.5 | `documentHighlight` | `ZERO_RANGE` | every occurrence, kind from the highlights table |
| [x] P0.6 | `documentLink` | `ZERO_RANGE` | real ranges; `target` set for resolvable URLs |
| [x] P0.7 | `foldingRange` | `ZERO_RANGE` | stack-paired + indentation-based, plus region markers |
| [x] P0.8 | `inlayHint` | position 0,0 | real positions (templated labels skipped - need real inference) |
| [x] P0.9 | `codeLens` | `ZERO_RANGE` | real ranges, command carries the captured symbol |
| [x] P0.10 | `documentColor` | `[]` | parses #rgb/#rgba/#rrggbb/#rrggbbaa, rgb()/rgba(), hsl()/hsla() |
| [x] P0.11 | `semanticTokens` | `data: []` | full LSP delta encoding, legend-checked; range variant clips |
| [x] P0.12 | `selectionRange` | `ZERO_RANGE` | real innermost-first expansion chain |
| [x] P0.13 | `linkedEditingRange` | `ranges: []` | open/close paired on the captured name |
| [x] P0.14 | `rename` | hardcoded `null` | real `WorkspaceEdit`; `prepareRename` validates + rejects reserved words |
| [x] P0.16 | `definition` | fake `context://`, `ZERO_RANGE` | in-file definition preferred over the doc link |

- [x] **P0.15** `formatting` / `rangeFormatting` / `onTypeFormatting` — done via
      `lsp/src/formatEngine.ts`. These rules rewrite text rather than locate it, so the
      locator was the wrong tool: every replacement is now checked against a protected
      mask over string literals and comments, built from each language's own
      `stringDelimiters` (selectionRange) and `comments` (languageConfiguration).
      Without the mask, "single space after comma" rewrote the literal `"a,b"`.

Standard LSP clients send `{ textDocument, position }` rather than this server's `word`
extension; `resolveWord` now reads the word out of the document at the position, using the
language's `wordPattern`. Providers still fall back to the old pattern-list behaviour when
a document was never opened.

---

## P1 — DONE: language composition (`extends`)

Overlay languages are authored as layers but served flat, so an overlay loses its base
entirely. Measured label overlap:

| Overlay | Base | Overlay | Base | Shared |
|---|---|---|---|---|
| angular | typescript | 165 | 53 | **0%** |
| nestjs | typescript | 161 | 53 | **0%** |
| shadcn | react | 133 | 146 | **0%** |
| react | javascript | 146 | 104 | 1.4% |
| nextjs | react | 152 | 146 | 2.0% |
| scss | css | 58 | 130 | 15.5% |
| less | css | 51 | 130 | 9.8% |
| mdx | markdown | 81 | 77 | 28.4% |
| redis-cli | redis | 320 | 54 | 12.5% |

- [x] **P1.1** `EXTENDS` now lives in `build.mjs`, which emits `extends` into the
      manifest for 19 languages. It must live in the generator: `data/manifest.json` is
      generated, and a rebuild wiped a hand-edit.
- [x] **P1.2** `dataLoader.readResolved` walks the chain base-first and merges. Arrays
      concatenate overlay-first and de-duplicate on identity (`label`, `symbol`, `name`,
      `pattern`, ...); objects merge key-wise, overlay winning. The merged payload is
      memoized and evicted with everything else.
- [x] **P1.3** `build.mjs` fails on an unknown base, self-extend, or cycle. Chain
      resolution also stops on a repeated id, so a bad manifest cannot loop.

Measured result: `typescript` 53 -> **154** completions, `angular` -> **319**,
`nextjs` -> **397**, zero duplicate labels, `python` unchanged at 158.

Cache ownership subtlety: a base payload read on an overlay's behalf is **not** cached
under the base's name — that would attribute it to a language with no live handle, so
`release()` could not reclaim it. Only the merged view is cached, owned by the requester.

---

## P2 — Missing language

- [x] **P2.1 `haskell`** — DONE. All **29 provider files** authored plus `languages.json` and the README table; the package now ships **97 languages**. Verified live: 13 symbols at correct lines (`Shape` at line 4), 63 completions, hover, folding, 73 semantic tokens, 4 references, formatting. Layout-sensitivity handled (`folding.offSide: true` in both `languageConfiguration` and `foldingRange`).

---

## P3 — Thin *programming* languages

Config/markup formats (`ignore`, `ini`, `dotenv`, `crontab`, `json`, `toml`, `xml`,
`makefile`) are **correctly** thin — no action.

In-use languages, worst first:
- [x] **P3.1 `julia`** — DONE. completion 63->82, hover 36->43, defs 17->29, types 15->25, sigs 15->25
- [x] **P3.2 `clojure`** — DONE. completion 52->61, hover 37->44, defs 19->31, types ->17, sigs 15->25
- [x] **P3.3 `scheme`** — DONE. completion 50->59, hover 40->45, defs 22->29, types ->14, sigs 15->25
- [x] **P3.4 `tcl`** — DONE. completion 58->66, hover 39->45, defs 20->30, types ->12, sigs 16->24
- [x] **P3.5 `coffee`** — DONE. completion 57->64, hover 38->45, defs 14->26, types ->14, sigs ->38

Niche DSLs — thin is arguably acceptable, lowest priority:
- [x] **P3.6** `sb` `powerquery` `ecl` `postiats` `cameligo` `lexon` `pla` — DONE. Real completions and hovers replacing templated one-liners (`sb` +4/+8, `powerquery` +1/+4, `ecl` +4, `postiats` +8, `cameligo` +8, `lexon` +6, `pla` +3/+8). Their definitions and typeDefinitions were rebuilt in the filler pass below.

---

## P4 — Shallow-everywhere providers

- [x] **P4.1 `signatureHelp`** — DONE. Was 23 languages at <=17 signatures; now **3**, and two of those (`javascript` 15, `typescript` 16) are excluded by request. `haskell` is the third at 22 (new language, authored from scratch). Added across `go rust c sql php lua r perl mysql scss css redis twig nestjs shadcn vb sparql julia clojure scheme tcl coffee haskell`.
- [x] **P4.2 `typeDefinition`** — DONE as far as it should go. `css` 4->24 (the real CSS Values and Units types), `html` 7->23, `tailwindcss` 4->14, plus rebuilt sets for every language touched in the filler pass. **The rest was a false alarm:** `ini`, `dotenv`, `ssh-config`, `crontab`, `ignore`, `makefile` have no type system, so 4-7 conceptual entries is correct and inventing types would be worse than the gap.

---

## P5 — Internal imbalances

Rich completion but thin definitions, so autocomplete feels good while Go-to-Definition
mostly misses. Bring `definition` up toward the `completion` count:

- [x] **P5.1** — DONE. `ruby` 15->**54**, `kotlin` 22->**52**, `tailwindcss` 22->**40**
- [x] **P5.2** — DONE. `dart` 22->**42**, `java` 22->**49**, `css` 22->**42**, `csharp` 19->**41**
- [x] **P5.3 WITHDRAWN — my metric was wrong, the data is right.** `lua` has exactly **22** reserved words (Lua's complete set) and **9** stdlib modules (also complete). Summing `keywords + typeKeywords` was never a depth signal. The same mistake produced the earlier "`ignore` monarchTokens empty" and "`crontab` no brackets" reports.

`go` is a 10x outlier at the top (912 / 1177 / 1136) — not a defect, just generated
differently. Useful as the reference for what "deep" looks like.

---

## C — `data/commands` (xterm shell autocomplete, **not** Monaco)

This tree feeds inshellsense-style terminal completion, not `monaco.languages.*`, and it is
**consumed downstream** — so every task here is additive. No renames, no re-nesting, no
schema changes; only new keys and deeper values on the shapes already shipped.

Measured from disk:

| | |
|---|---|
| command files | **629** (612 unique names, 27 aliases) |
| display categories | 56 |
| `contextEngine` detectors | **629/629 files · 2,447 detectors** |
| args with a semantic `type` | **447** across 29 enumerable kinds |
| args linked to a detector | **335** (`completion.detector`) |
| leaf subcommands | **5,137** (plus 194 parent nodes) |
| leaves with `options` | **4,687 — 91%** |
| leaves with `args` | **1,732 — 34%** |
| subcommand `options` | **16,003** |
| `globalOptions` | 7,080 |
| `args` entries | 1,963, **0 of them malformed** |

### DONE

- [x] **C1 — 165 missing CLI tools authored.**
- [x] **C2 — 1,368 `short`/`shorthand`/`takesValue` fills** on nested options, using the
      kubectl/helm option shape as canonical (`takesValue` = `type !== "boolean"`).
- [x] **C3 — command-name collisions were silently discarding 84 subcommands.**
      `mergeCommand` in `index.js`/`index.mjs` now merges colliding entries key-wise.
- [x] **C4 — alias resolution.** `aliasIndex()` + `resolveCommandName()`.
- [x] **C5 — validator coverage for this tree** in `build.mjs`: command completability,
      README/manifest drift, and alias-vs-name conflicts — which immediately caught two I
      had introduced myself (`c.json` claiming `clang`, `cpp.json` claiming `clang++`).
- [x] **C6 — option depth.** Option-less leaves **2,167 -> 450**; subcommand options
      **6,983 -> 16,003**. Every remaining empty leaf is *deliberately* empty (see below).
- [x] **C7 — `aws` complete.** 66 services, 361 options, 0 without options or examples.
- [x] **C8 — `git` deepened.** 68 -> **154** subcommands, **154/154 with examples**
      (was 28), 143 with options.
- [x] **C9 — `contextEngine`: 166 -> 629/629 (100%), 2,446 detectors.** Authored against
      each file's real binary, which is often *not* the filename: `css.json` is `stylelint`,
      `json.json` is `jq`, `typescript.json` is `tsc`, `c.json` is `gcc`, `apex.json` is
      `sf`. Every detector is a **read-only probe** — version and config reads, `find`/`ls`
      project inspection, and cheap context queries (`kubectl config current-context`).
      `build.mjs` now enforces that (below), and enforcing it found a genuine bug in the
      pre-existing data: `winget upgrade` is a *mutating* command, corrected to
      `winget list --upgrade-available`.
- [x] **C10 — 275 malformed `args` repaired.** Across 48 files, `args` entries had shipped
      as bare strings (`"image:tag"`, `"file"`) rather than the
      `{name, description, required, type?}` objects the other 1,163 already used, so they
      rendered with no description and no type. There was a `checkOption` guard for exactly
      this mistake on options but no `checkArg`, which is why it survived. Both are now in
      place and were verified by reintroducing the bug.
- [x] **C11 — `args` depth.** Leaves with args **1,286 -> 1,732**; the name-implies-a-target
      residual went **729 -> 397**.
- [x] **C12 — staged argument completion wired.** An arg whose values can be listed from
      live state now carries `completion: { detector }` naming a detector in the **same**
      command — the one link that was missing between a slot and its values. **335 slots
      linked**, **447 args given a semantic `type`** (`container`, `unit`, `image`, `branch`
      …) in place of a bare `string`.

      The detector is chosen **per argument, not per type**, because the useful values
      depend on the verb: `docker stop` -> `running_containers`, `docker start` ->
      `all_containers`, `systemctl unmask` -> `masked_units`, `reset-failed` ->
      `failed_units`. A global `type -> detector` table cannot express that, which is why
      the link lives on the arg.

      **111 slots are deliberately left unlinked**: `brew install`, `npm install`,
      `apt-get install` and friends take candidates from a remote registry, and no
      read-only local probe can enumerate them. Leaving those empty is correct.

      Authoring verified every reference at write time, which found exactly **one** genuinely
      missing detector — `crictl.images`, now added. My earlier "150 missing detectors"
      estimate was produced by substring-matching detector names and was simply wrong: the
      detectors existed under different names (`argo` has `workflows`, `bundle` has
      `gemfile_deps`). Third counting error of the same family; see the withdrawn list.
- [x] **C13 — `index.d.ts` typed and repaired.** It described every command shape as `any`,
      so TypeScript consumers got no help for the feature above. Added `Command`,
      `Subcommand`, `CommandArg` (with `completion`), `CommandOption`, `Detector`,
      `ArgType` and `DetectorParser`, each with an index signature so no existing property
      access breaks. Typechecking it under `--strict` also surfaced two **pre-existing**
      errors: the default-export block referenced `getRawExamples` and `getAllExamples`,
      which exist in `index.js` but were never declared. Both now declared; the file is
      clean under `--strict`.
- [x] **C14 — `XTERM_INTEGRATION.md`.** A consumer guide for building the staged flow on
      xterm.js: the two viable architectures (own the prompt vs. wrap a PTY, with the
      trade-offs), longest-match parsing for the three subcommand name forms, the cache key
      that must include `cwd`, where detectors have to execute when the terminal is in a
      browser, and why the menu belongs in a DOM overlay rather than the terminal grid.
      Shipped in `package.json` `files`. Every API name in it was checked against the real
      exports — which caught two mistakes in my own draft (`listCommands` does not exist;
      it is `listCommandNames`, and `k` is not an alias of `kubectl`).

### New enforcement in `build.mjs`

- Every detector must declare `name`, `description`, `command`, `parser` (one of
  lines/text/json/table/keyvalue) and a numeric `cacheFor`, with unique names per file.
- Every detector command must be **read-only**. The rule keys off the mutating
  *subcommand*, not the binary, because `apt list --installed`, `dnf repolist` and
  `cargo install --list` are queries; `--version`/`--help` probes and `which`-style
  lookups are neutralised before the test, and redirects inside quotes are ignored
  (a `>` in a grep pattern is not shell syntax).
- `checkArg` mirrors `checkOption`: no bare strings, description required, boolean
  `required`, and `type` — which stays optional, since 631 args legitimately omit it.

### Deliberately empty — 450 option-less leaves, and why

These are **not** unfinished. Padding them would be fabrication:

- **Flagless coreutils and shell builtins** (`linux`, 18): `arch`, `whoami`, `bg`, `fg`,
  `yes`, `rev`, `groups`, `lsmod`, `expr`, `source`, `nohup`, `mesg`, `xdg-open`.
- **Dockerfile instructions** (11): `CMD`, `ENTRYPOINT`, `ENV`, `EXPOSE`, `USER` — these
  are directives, not commands, and take no flags.
- **`cmake -E` file operations** (11): `copy`, `rename`, `touch`, `md5sum` take operands only.
- **VS Code command ids** (`tailwindcss`, 8): `tailwindcss.sortClasses` and friends are
  editor commands, not a CLI.
- **Positional-only subcommands**: `simctl` (10), `ufw` (10), `clojure` alias invocations
  (9), `direnv` (9), `asdf` (8), `sdkman` (8), `awk` functions (8), `scoop` (7).
- **Flagless git plumbing** (9): `citool`, `gui`, `http-backend`, `stash clear`,
  `remote remove`, `worktree repair`.

The same holds for `args`: of the 3,405 leaves without them, **892 inherently take no
positional** (`docker ps`, `systemctl daemon-reload`, `terraform init`, `brew update`,
`cargo clean`) and **2,116 are flags-as-names, DSL fragments or resource groups**
(`-c file.coffee`, `.key file.yaml`, `openstack server`). Counting those as a gap is the
same mistake as the withdrawn findings below.

### Withdrawn — two of my own gap reports were wrong

- **"3,427 subcommands offer nothing after the name" was inflated.** 187 of those are
  *parent groups*, which correctly carry no options of their own. The real figure was
  **3,240**. Same class of error as P5.3 — count the thing you actually mean before
  calling it a gap.
- **"150 detectors missing for enumerable arg slots" was wrong.** That came from
  substring-matching detector names against arg kinds. Resolving the mapping properly found
  **one** real gap (`crictl.images`); the rest were present under names the substring test
  did not match. Same family as the two below — measure the thing itself, not a proxy for it.
- **The three subcommand naming forms coexist by design**, and are not an inconsistency to
  normalise: **4,334 flat** names, **771 space-encoded** (`docker` uses `"network ls"`,
  `kubectl` uses `"create deployment"` — relative to the binary, no prefix), and **194
  parent nodes** with real `subcommands[]`. I began migrating the space-encoded names into
  a nested tree and was told to stop; **reverted in full**.

### Corrected in `git.json` — three entries that should not have shipped

Reported against the depth-pass commit and fixed:

- `switch-detach` and `rev-list-count` folded a flag into the subcommand name, and both
  flags already existed on the parent (`switch --detach`, `rev-list --count`) — pure
  duplicates, **removed**. `rev-list-count`'s one unique flag (`--left-right`) was moved
  onto `rev-list` first.
- `worktree-prune` **renamed to `"worktree prune"`**, following the tree-wide convention
  (`docker` `"network ls"`, `kubectl` `"create deployment"`). The file itself had no
  space-encoded names to copy, but the tree's 771 are unambiguous.
- While there: the 4 pseudo-groups (`stash`, `remote`, `submodule`, `worktree`) listed
  their sub-subcommands as bare entries in `options[]`, where they complete as if they
  were flags and cannot carry flags of their own. **34 real space-encoded paths added
  alongside**; the existing bare entries were left untouched.

Structure check against the committed tree: **`git.json` is the only file whose subcommand
signature changed** (3 removed, 35 added). The other 628 files have 0 renames, 0
re-nestings and 0 `args`-count changes.

### OPEN

- [ ] **C15 — `args` residual: 397 leaves** whose name implies a target but that still
      carry none. Many are flag-driven rather than positional (`az group create --name`),
      so the true remainder is smaller; it needs per-command checking, not a bulk pass.
- [ ] **C16 — `aws` breadth: 66 of ~300 services.** The remaining ~230 are narrow
      services; better added on demand than padded in bulk.
- [ ] **C17 — leaf `examples`: 2,620 of 5,137.** `git` is now complete at 154/154; the
      rest of the tree is the open half.

### Nested cloud-CLI caveat

~180 nested subcommands under `doctl`/`hcloud`/`civo` and friends repeat leaf names
(`create`, `list`, `delete`) under different parents, so name-keyed fills are ambiguous and
correctly refused. These need path-keyed addressing (`"a > b > c"`), not a looser matcher.

---

## Notes / risks

- **Commits are not mine to make.** This checkout is shared; another session owns
  committing, so expect the tree to move under you and do not commit from an agent turn.
  **That session also rebases**, so do not cite commit hashes in this file — the ones that
  used to be here were orphaned by a history rewrite within a day of being written. Name
  commits by subject line instead. Everything through *"detectors on every file, option
  depth, and a validator that checks both"* has landed; the staged-completion work (C12–C14)
  is uncommitted at the time of writing.
- **Concurrent edits.** The same process wired `languageConfiguration` into the LSP — the
  30th-provider gap flagged earlier is closed, LSP and manifest are now 30/30 aligned.
  Coordinate before bulk data writes.
- **`completion.detector` drift is unguarded in the build, by request.** A validator check
  that every `completion.detector` names a real detector in its file was offered and
  declined, so `build.mjs` does not enforce it. `test.js` does follow every link and fails
  on a dangling one, so it is covered by `npm test` but not by `npm run validate`.
- **Regression guard.** Add the two checks used here to CI: every JSON parses, and every
  pattern-field string compiles as a `RegExp`. Both would have caught T0 at authoring time.
