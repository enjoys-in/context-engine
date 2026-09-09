# context-engine coverage TODO

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

## Notes / risks

- **Concurrent edits.** Another process has been committing to `data/` throughout
  (`languageConfiguration` provider, command re-categorisation, the earlier regex repair).
  It has already wired `languageConfiguration` into the LSP — the 30th-provider gap I
  flagged earlier is closed, LSP and manifest are now 30/30 aligned. Coordinate before
  bulk data writes.
- **Regression guard.** Add the two checks used here to CI: every JSON parses, and every
  pattern-field string compiles as a `RegExp`. Both would have caught T0 at authoring time.
