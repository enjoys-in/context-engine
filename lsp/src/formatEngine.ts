// ── Formatting engine ───────────────────────────────────────────────
//
// The formatting data ships ~1,875 `{ pattern, replacement }` rules. Applied
// naively across a whole document they corrupt content: "Ensure single space
// after comma" would rewrite the string literal "a,b" into "a, b", and
// comment text would be reflowed too.
//
// So every replacement is checked against a protected mask covering string
// literals and comments, built from each language's own `stringDelimiters`
// (selectionRange) and `comments` (languageConfiguration) — both present for
// all 96 languages. A replacement overlapping the mask is skipped.
//
// Complexity: O(n) mask build, O(n) per rule.

import { type DocumentIndex, type LspRange, positionAt } from "./documentIndex.ts";

// ── Rule compilation ────────────────────────────────────────────────
// Formatting rules mix two scopes, and the flag they need differs:
//
//   `[ \t]+$`     trailing whitespace — per line, so `$` must be a line end (m)
//   `(?<!\n)$`    newline at EOF      — whole document, so `$` must be the end (no m)
//   `\n{3,}`      collapse blank runs — whole document
//
// A pattern that mentions a newline is talking about the document; anything
// else is talking about a line. Compiling every rule with `m` made the EOF
// rule fire on every line.
const ruleCache = new Map<string, RegExp | null>();

function compileRule(pattern: string): RegExp | null {
  const hit = ruleCache.get(pattern);
  if (hit !== undefined) return hit;
  const documentScoped = /\\[nr]|\n|\r/.test(pattern);
  let re: RegExp | null = null;
  try {
    re = new RegExp(pattern, documentScoped ? "g" : "gm");
  } catch {
    re = null;
  }
  if (ruleCache.size >= 4096) {
    const oldest = ruleCache.keys().next().value;
    if (oldest !== undefined) ruleCache.delete(oldest);
  }
  ruleCache.set(pattern, re);
  return re;
}

export interface FormatRule {
  pattern?: string;
  replacement?: string;
  description?: string;
  /** Advisory prose rules (shadcn) carry this instead of a pattern. */
  rule?: string;
}

export interface TextEdit {
  range: LspRange;
  newText: string;
}

export interface MaskSources {
  stringDelimiters?: string[];
  lineComment?: string | null;
  blockComment?: [string, string] | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Offsets that must not be rewritten: inside a string literal or a comment.
 *
 * A single left-to-right pass. Longer delimiters are tried first so `"""`
 * wins over `"`. Escapes are honoured inside strings so `"a\"b"` does not
 * terminate early.
 */
export function buildProtectedMask(text: string, src: MaskSources): Uint8Array {
  const mask = new Uint8Array(text.length);

  const delims = [...(src.stringDelimiters ?? [])]
    // The data stores some delimiters pre-escaped for regex use (lua "\\[\\[").
    .map((d) => d.replace(/\\(.)/g, "$1"))
    .filter((d) => d.length > 0)
    .sort((a, b) => b.length - a.length);

  const line = src.lineComment || null;
  const block = src.blockComment && src.blockComment.length === 2 ? src.blockComment : null;

  let i = 0;
  const at = (s: string, p: number) => text.startsWith(s, p);

  while (i < text.length) {
    // Block comment
    if (block && at(block[0]!, i)) {
      const close = text.indexOf(block[1]!, i + block[0]!.length);
      const end = close === -1 ? text.length : close + block[1]!.length;
      mask.fill(1, i, end);
      i = end;
      continue;
    }
    // Line comment
    if (line && at(line, i)) {
      let end = text.indexOf("\n", i);
      if (end === -1) end = text.length;
      mask.fill(1, i, end);
      i = end;
      continue;
    }
    // String literal
    let matched = false;
    for (const d of delims) {
      if (!at(d, i)) continue;
      let j = i + d.length;
      while (j < text.length) {
        if (text[j] === "\\") { j += 2; continue; }   // escape
        if (at(d, j)) { j += d.length; break; }
        if (d.length === 1 && text[j] === "\n") break; // single-char quotes don't span lines
        j++;
      }
      mask.fill(1, i, Math.min(j, text.length));
      i = Math.min(j, text.length);
      matched = true;
      break;
    }
    if (!matched) i++;
  }

  return mask;
}

function overlapsMask(mask: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end && i < mask.length; i++) if (mask[i]) return true;
  return false;
}

/**
 * Apply rules to `text`, skipping any match that touches protected content.
 *
 * Rules run in order, each over the result of the last, matching how the
 * data describes them (trailing whitespace, then blank-line collapsing, ...).
 * The mask is rebuilt when a rule changes the text, since offsets shift.
 */
export function applyRules(
  text: string,
  rules: FormatRule[],
  src: MaskSources,
  /** Internal: set when re-applying a rule to check it settled. */
  stable = false
): string {
  let out = text;
  let mask = buildProtectedMask(out, src);

  for (const rule of rules) {
    // Prose-only advisory rules have no pattern — nothing to apply.
    if (!rule.pattern || rule.replacement === undefined) continue;
    const re = compileRule(rule.pattern);
    if (!re) continue;

    let result = "";
    let last = 0;
    let changed = false;

    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(out)) !== null) {
      const start = m.index;
      const end = start + m[0].length;

      if (!overlapsMask(mask, start, end)) {
        result += out.slice(last, start);
        // $1..$9 back-references, as the data intends.
        result += rule.replacement.replace(/\$(\d)/g, (_, d) => m![Number(d)] ?? "");
        last = end;
        changed = true;
      }
      if (m[0].length === 0) re.lastIndex++;
    }

    if (!changed) continue;

    const next = result + out.slice(last);

    // Reject an unstable rule rather than let "format on save" grow the
    // file. Applying it to its own output must be a no-op.
    if (!stable) {
      const verify = applyRules(next, [rule], src, true);
      if (verify !== next) continue; // oscillating — drop this rule's effect
    }

    out = next;
    mask = buildProtectedMask(out, src);
  }

  return out;
}

/** Whole-document format as a single replacing edit, or null if unchanged. */
export function formatDocument(
  index: DocumentIndex,
  rules: FormatRule[],
  src: MaskSources
): TextEdit[] | null {
  const next = applyRules(index.text, rules, src);
  if (next === index.text) return [];
  return [{
    range: { start: { line: 0, character: 0 }, end: positionAt(index, index.text.length) },
    newText: next,
  }];
}

/**
 * Range format. The range is widened to whole lines — these rules are
 * line-oriented, and a partial line would be reindented against nothing.
 */
export function formatRange(
  index: DocumentIndex,
  range: LspRange,
  rules: FormatRule[],
  src: MaskSources
): TextEdit[] | null {
  const startLine = Math.max(0, Math.min(range.start.line, index.lineCount - 1));
  const endLine = Math.max(startLine, Math.min(range.end.line, index.lineCount - 1));

  const from = index.lineStarts[startLine]!;
  const to = endLine + 1 < index.lineCount ? index.lineStarts[endLine + 1]! - 1 : index.text.length;

  const slice = index.text.slice(from, to);
  const next = applyRules(slice, rules, src);
  if (next === slice) return [];

  return [{
    range: { start: positionAt(index, from), end: positionAt(index, to) },
    newText: next,
  }];
}

// ── On-type formatting ──────────────────────────────────────────────

export interface OnTypeRule { action?: string; pattern?: string }
export interface OnTypeTrigger { trigger?: string; rules?: OnTypeRule[] }
export interface IndentationRules { increasePattern?: string; decreasePattern?: string }

function indentOf(s: string): string {
  const m = /^[ \t]*/.exec(s);
  return m ? m[0] : "";
}

/**
 * Adjust the current line's indentation after the user types a trigger.
 *
 * Only `indent`/`outdent`/`trimWhitespace` are handled — the ones expressible
 * as an indentation edit. `alignBrackets` and `insertNewline` need a parse
 * tree and are left alone rather than approximated wrongly.
 */
export function onTypeEdits(
  index: DocumentIndex,
  position: { line: number; character: number },
  ch: string,
  triggers: OnTypeTrigger[],
  indentation: IndentationRules | undefined,
  options: { tabSize: number; insertSpaces: boolean }
): TextEdit[] | null {
  const lineNo = position.line;
  if (lineNo < 0 || lineNo >= index.lineCount) return null;

  const start = index.lineStarts[lineNo]!;
  const end = lineNo + 1 < index.lineCount ? index.lineStarts[lineNo + 1]! - 1 : index.text.length;
  const current = index.text.slice(start, end);

  const unit = options.insertSpaces ? " ".repeat(Math.max(1, options.tabSize)) : "\t";
  const prev = lineNo > 0 ? index.text.slice(
    index.lineStarts[lineNo - 1]!,
    index.lineStarts[lineNo]! - 1
  ) : "";

  const applicable = triggers.filter((t) => !t.trigger || t.trigger === ch);
  let action: string | undefined;

  for (const t of applicable) {
    for (const r of t.rules ?? []) {
      if (!r.action) continue;
      if (!r.pattern) { action ??= r.action; continue; }
      const re = compileRule(r.pattern);
      if (!re) continue;
      re.lastIndex = 0;
      // Indent rules describe the *previous* line; outdent describes this one.
      const subject = r.action === "outdent" ? current : prev;
      if (re.test(subject)) { action = r.action; break; }
    }
    if (action) break;
  }

  if (!action && indentation) {
    const inc = indentation.increasePattern ? compileRule(indentation.increasePattern) : null;
    const dec = indentation.decreasePattern ? compileRule(indentation.decreasePattern) : null;
    if (inc) { inc.lastIndex = 0; if (inc.test(prev)) action = "indent"; }
    if (!action && dec) { dec.lastIndex = 0; if (dec.test(current)) action = "outdent"; }
  }

  if (!action) return [];

  const existing = indentOf(current);
  let next = existing;

  if (action === "indent") next = indentOf(prev) + unit;
  else if (action === "outdent") {
    next = existing.endsWith(unit) ? existing.slice(0, -unit.length)
         : existing.endsWith("\t") ? existing.slice(0, -1)
         : "";
  } else if (action === "trimWhitespace") {
    if (!/[ \t]$/.test(current)) return [];
    return [{
      range: {
        start: positionAt(index, start + current.replace(/[ \t]+$/, "").length),
        end: positionAt(index, end),
      },
      newText: "",
    }];
  } else return [];

  if (next === existing) return [];
  return [{
    range: {
      start: { line: lineNo, character: 0 },
      end: { line: lineNo, character: existing.length },
    },
    newText: next,
  }];
}
