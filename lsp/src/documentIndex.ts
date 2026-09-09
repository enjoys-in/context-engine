// ── Document pattern engine ─────────────────────────────────────────
//
// The provider JSON ships regex patterns for all 96 languages; this module
// runs them against the open document so providers can return real ranges
// instead of placeholders.
//
// Complexity, per pattern:
//   index build    O(n) once per document version, reused by every provider
//   scan           O(n) — one regex pass over the text
//   offset -> line O(1) amortised, via a cursor that rides the match order
//                  (a `g` regex yields matches in increasing offset order),
//                  falling back to O(log lines) binary search for random access.

export interface LspPosition { line: number; character: number }
export interface LspRange { start: LspPosition; end: LspPosition }

export interface DocumentIndex {
  readonly text: string;
  /** Offset at which each line starts. Int32Array: 4 bytes/line, no substrings. */
  readonly lineStarts: Int32Array;
  readonly lineCount: number;
}

export function buildIndex(text: string): DocumentIndex {
  let count = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++;

  const lineStarts = new Int32Array(count);
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lineStarts[line++] = i + 1;
  }
  return { text, lineStarts, lineCount: count };
}

/** Random-access offset -> position. O(log lineCount). */
export function positionAt(index: DocumentIndex, offset: number): LspPosition {
  const { lineStarts } = index;
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, character: offset - lineStarts[lo]! };
}

/** Position -> offset, clamped into the document. O(1). */
export function offsetAt(index: DocumentIndex, pos: LspPosition): number {
  const { lineStarts, text } = index;
  if (pos.line < 0) return 0;
  if (pos.line >= lineStarts.length) return text.length;
  const start = lineStarts[pos.line]!;
  const end = pos.line + 1 < lineStarts.length ? lineStarts[pos.line + 1]! - 1 : text.length;
  return Math.min(start + Math.max(0, pos.character), end);
}

export function lineText(index: DocumentIndex, line: number): string {
  const { lineStarts, text } = index;
  if (line < 0 || line >= lineStarts.length) return "";
  const start = lineStarts[line]!;
  const end = line + 1 < lineStarts.length ? lineStarts[line + 1]! - 1 : text.length;
  return text.slice(start, end);
}

// ── Compiled-regex cache ─────────────────────────────────────────────
// Patterns come from immutable data files, so a compiled RegExp can be
// reused for the life of the process. Bounded so a long-running server
// serving many languages cannot grow without limit.

const MAX_REGEX = 4096;
const regexCache = new Map<string, RegExp | null>();

/**
 * Compile a data-file pattern for whole-document scanning.
 *
 * `g` is required to iterate matches. `m` makes `^`/`$` anchor per line,
 * which keeps whole-document scanning equivalent to the per-line scanning
 * these patterns were written for (verified against a per-line reference).
 * `d` exposes capture-group offsets; dropped if unsupported.
 *
 * Returns null for a pattern that cannot compile — cached, so an invalid
 * pattern is not retried on every request.
 */
export function compile(pattern: string): RegExp | null {
  const hit = regexCache.get(pattern);
  if (hit !== undefined) return hit;

  let re: RegExp | null = null;
  try {
    re = new RegExp(pattern, "gmd");
  } catch {
    try {
      re = new RegExp(pattern, "gm"); // engine without `d`, or bad pattern
    } catch {
      re = null;
    }
  }

  if (regexCache.size >= MAX_REGEX) {
    // Evict the oldest entry; insertion order gives us that for free.
    const oldest = regexCache.keys().next().value;
    if (oldest !== undefined) regexCache.delete(oldest);
  }
  regexCache.set(pattern, re);
  return re;
}

export interface PatternMatch {
  /** Range of the whole match, exactly as the regex matched it. */
  range: LspRange;
  /**
   * `range` with leading whitespace excluded.
   *
   * Many data patterns start `^\s*`, and `\s` matches newlines — so an
   * anchored pattern can begin on the blank line *above* the construct and
   * report a range starting there. Consumers that want the construct's own
   * location (symbols, declarations, lenses) should use this.
   */
  contentRange: LspRange;
  /** Range of the requested capture group, when it participated. */
  groupRange?: LspRange;
  /** Text of the requested capture group, else the whole match. */
  name: string;
  /** Whole matched text. */
  text: string;
  /** Offset of the whole match. */
  offset: number;
}

const MAX_MATCHES = 5000; // guard against a pathological pattern on a huge file

/**
 * Run one pattern over the whole document.
 *
 * `captureGroup` selects which group supplies `name`/`groupRange` — this is
 * the `captureGroup` field the data files carry (usually 1, the symbol name).
 */
export function scan(
  index: DocumentIndex,
  pattern: string,
  captureGroup = 0,
  limit = MAX_MATCHES
): PatternMatch[] {
  const re = compile(pattern);
  if (!re) return [];

  const { text, lineStarts } = index;
  const out: PatternMatch[] = [];
  const lineMax = lineStarts.length;

  // Cursor rides the (increasing) match order: amortised O(1) per match
  // instead of a binary search each time.
  let cursor = 0;
  const posAt = (offset: number): LspPosition => {
    while (cursor + 1 < lineMax && lineStarts[cursor + 1]! <= offset) cursor++;
    while (cursor > 0 && lineStarts[cursor]! > offset) cursor--;
    return { line: cursor, character: offset - lineStarts[cursor]! };
  };

  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const whole = m[0];
    const start = m.index;
    const end = start + whole.length;

    // Skip leading whitespace so the reported location is the construct,
    // not the blank line an `^\s*` pattern reached back over.
    let lead = 0;
    while (lead < whole.length && /\s/.test(whole[lead]!)) lead++;
    const contentStart = lead < whole.length ? start + lead : start;

    let groupRange: LspRange | undefined;
    let name = whole;

    if (captureGroup > 0 && m[captureGroup] !== undefined) {
      name = m[captureGroup]!;
      const ind = (m as RegExpExecArray & { indices?: (readonly [number, number] | undefined)[] }).indices;
      const gi = ind?.[captureGroup];
      if (gi) {
        groupRange = { start: posAt(gi[0]), end: posAt(gi[1]) };
      } else {
        // No `d` support: locate the group inside the match.
        const rel = whole.indexOf(name);
        if (rel >= 0) {
          groupRange = { start: posAt(start + rel), end: posAt(start + rel + name.length) };
        }
      }
    }

    out.push({
      range: { start: posAt(start), end: posAt(end) },
      contentRange: { start: posAt(contentStart), end: posAt(end) },
      groupRange,
      name,
      text: whole,
      offset: contentStart,
    });

    if (out.length >= limit) break;
    if (whole.length === 0) re.lastIndex++; // zero-length match would spin
  }

  return out;
}

/** Every occurrence of one identifier, as whole-word matches. O(n). */
export function scanWord(index: DocumentIndex, word: string, limit = MAX_MATCHES): PatternMatch[] {
  if (!word) return [];
  // Escape the word: it comes from client params, not from our data.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundaryLeft = /^[A-Za-z0-9_$]/.test(word) ? "\\b" : "";
  const boundaryRight = /[A-Za-z0-9_$]$/.test(word) ? "\\b" : "";
  return scan(index, `${boundaryLeft}${escaped}${boundaryRight}`, 0, limit);
}

/** Word under a position, using a language word pattern when supplied. */
export function wordAt(
  index: DocumentIndex,
  pos: LspPosition,
  wordPattern = "[A-Za-z_$][A-Za-z0-9_$]*"
): { word: string; range: LspRange } | null {
  const line = lineText(index, pos.line);
  if (!line) return null;

  const re = compile(wordPattern);
  if (!re) return null;

  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const s = m.index;
    const e = s + m[0].length;
    if (pos.character >= s && pos.character <= e) {
      return {
        word: m[0],
        range: { start: { line: pos.line, character: s }, end: { line: pos.line, character: e } },
      };
    }
    if (m[0].length === 0) re.lastIndex++;
    if (s > pos.character) break;
  }
  return null;
}

/**
 * Pair start/end patterns into folding ranges with a stack.
 *
 * O(lines x rules). An empty `endPattern` means the language folds by
 * indentation (Python-style): the block runs to the last line indented
 * deeper than the opener.
 */
export interface FoldRule { startPattern: string; endPattern?: string; kind?: string }

export function computeFoldingRanges(
  index: DocumentIndex,
  rules: FoldRule[]
): { startLine: number; endLine: number; kind?: string }[] {
  const out: { startLine: number; endLine: number; kind?: string }[] = [];
  const lines: string[] = [];
  for (let i = 0; i < index.lineCount; i++) lines.push(lineText(index, i));

  const indentOf = (s: string): number => {
    let n = 0;
    for (const ch of s) {
      if (ch === " ") n++;
      else if (ch === "\t") n += 4;
      else break;
    }
    return n;
  };

  for (const rule of rules) {
    const startRe = compile(rule.startPattern);
    if (!startRe) continue;

    const endRe = rule.endPattern ? compile(rule.endPattern) : null;

    if (!endRe) {
      // Indentation-based folding.
      for (let i = 0; i < lines.length; i++) {
        startRe.lastIndex = 0;
        if (!startRe.test(lines[i]!)) continue;
        const base = indentOf(lines[i]!);
        let end = i;
        for (let j = i + 1; j < lines.length; j++) {
          const t = lines[j]!;
          if (t.trim() === "") continue; // blank lines don't close a block
          if (indentOf(t) <= base) break;
          end = j;
        }
        if (end > i) out.push({ startLine: i, endLine: end, kind: rule.kind });
      }
      continue;
    }

    // Paired start/end via a stack, so nesting produces nested ranges.
    const stack: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i]!;
      startRe.lastIndex = 0;
      endRe.lastIndex = 0;
      const opens = startRe.test(t);
      const closes = endRe.test(t);

      if (opens && !closes) stack.push(i);
      else if (closes && !opens) {
        const s = stack.pop();
        if (s !== undefined && i > s) out.push({ startLine: s, endLine: i, kind: rule.kind });
      } else if (opens && closes) {
        // Same line opens and closes (e.g. `/* ... */`) — nothing to fold.
        continue;
      }
    }
  }

  // Deduplicate identical ranges produced by overlapping rules.
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = `${r.startLine}:${r.endLine}:${r.kind ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Diagnostics only. */
export function regexCacheSize(): number {
  return regexCache.size;
}
