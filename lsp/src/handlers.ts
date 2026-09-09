import type { JsonRpcWriter } from "./jsonrpc.ts";
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  ServerCapabilities,
  // Data interfaces (context-engine JSON schema)
  CompletionItem as CECompletionItem,
  CompletionData,
  HoverEntry,
  SignatureHelpData,
  SignatureEntry,
  SignatureParameter,
  DefinitionEntry,
  DeclarationEntry,
  TypeDefinitionEntry,
  HighlightEntry,
  SymbolPattern,
  CodeActionEntry,
  CodeLensPattern,
  LinkPattern,
  FoldingRule,
  InlayHintPattern,
  InlineCompletionsData,
  InlineCompletionItem as CEInlineCompletionItem,
} from "./types.ts";
import type { LanguageHandle } from "./dataLoader.ts";
import { listLanguages } from "./dataLoader.ts";
import { setDocument, removeDocument, documentCount, getIndex } from "./documentStore.ts";
import {
  scan, scanWord, wordAt, computeFoldingRanges, positionAt,
  type DocumentIndex, type PatternMatch, type FoldRule,
} from "./documentIndex.ts";
import {
  formatDocument, formatRange, onTypeEdits,
  type FormatRule, type MaskSources, type OnTypeTrigger, type IndentationRules,
} from "./formatEngine.ts";

// ═══════════════════════════════════════════════════════════════════
// LSP Response Payload types (mirrors LSP_RESPONSE_PAYLOADS.ts)
// Only the subset we actually construct in responses
// ═══════════════════════════════════════════════════════════════════

interface LspPosition { line: number; character: number }
interface LspRange { start: LspPosition; end: LspPosition }

interface LspLocationLink {
  originSelectionRange?: LspRange;
  targetUri: string;
  targetRange: LspRange;
  targetSelectionRange: LspRange;
}

interface LspMarkupContent { kind: "plaintext" | "markdown"; value: string }
interface LspCommand { title: string; command: string; arguments?: unknown[] }

interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: LspMarkupContent;
  insertText?: string;
  insertTextFormat?: 1 | 2;
  sortText?: string;
}

interface LspCompletionList { isIncomplete: boolean; items: LspCompletionItem[] }

interface LspParameterInformation { label: string; documentation?: LspMarkupContent }
interface LspSignatureInformation { label: string; documentation?: LspMarkupContent; parameters?: LspParameterInformation[] }
interface LspSignatureHelp { signatures: LspSignatureInformation[]; activeSignature: number; activeParameter: number }

interface LspDocumentHighlight { range: LspRange; kind?: number }
interface LspDocumentSymbol { name: string; kind: number; range: LspRange; selectionRange: LspRange }

interface LspDiagnostic { range: LspRange; severity?: number; source?: string; message: string }
interface LspCodeAction { title: string; kind?: string; isPreferred?: boolean; diagnostics?: LspDiagnostic[] }

interface LspCodeLens { range: LspRange; command?: LspCommand; data?: unknown }
interface LspDocumentLink { range: LspRange; target?: string; tooltip?: string; data?: unknown }
interface LspColorPresentation { label: string }
interface LspColor { red: number; green: number; blue: number; alpha: number }
interface LspColorInformation { range: LspRange; color: LspColor }

interface LspFoldingRange { startLine: number; endLine: number; kind?: "comment" | "imports" | "region" }
interface LspSelectionRange { range: LspRange; parent?: LspSelectionRange }
interface LspLinkedEditingRanges { ranges: LspRange[]; wordPattern?: string }

interface LspInlayHint { position: LspPosition; label: string; kind?: 1 | 2; paddingLeft?: boolean; paddingRight?: boolean; data?: unknown }
interface LspInlineCompletionItem { insertText: string; filterText?: string }
interface LspInlineCompletionList { items: LspInlineCompletionItem[] }
interface LspSemanticTokens { resultId?: string; data: number[] }
interface LspPublishDiagnosticsParams { uri: string; diagnostics: LspDiagnostic[] }

// ═══════════════════════════════════════════════════════════════════
// Converters: context-engine JSON schema → LSP response payloads
// ═══════════════════════════════════════════════════════════════════

const ZERO_RANGE: LspRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

// ── Range geometry ──────────────────────────────────────────────────

function containsPosition(r: LspRange, p: LspPosition): boolean {
  if (p.line < r.start.line || p.line > r.end.line) return false;
  if (p.line === r.start.line && p.character < r.start.character) return false;
  if (p.line === r.end.line && p.character > r.end.character) return false;
  return true;
}

/** Comparable span size, for ordering an innermost-first selection chain. */
function rangeSize(r: LspRange): number {
  return (r.end.line - r.start.line) * 100000 + (r.end.character - r.start.character);
}

// ── Colour literals ─────────────────────────────────────────────────
// LSP wants channels in 0..1. Handles the notations the colorPatterns
// files describe: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() with
// numeric or percentage channels, and hsl()/hsla().

function hslToRgb(h: number, sat: number, light: number): [number, number, number] {
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = light - c / 2;
  return [r + m, g + m, b + m];
}

function channel(raw: string): number {
  const t = raw.trim();
  if (t.endsWith("%")) return Math.min(1, Math.max(0, parseFloat(t) / 100));
  return Math.min(1, Math.max(0, parseFloat(t) / 255));
}

/**
 * Encode tokens in the LSP wire format: 5 integers per token, each
 * position expressed as a delta from the previous token
 * (deltaLine, deltaStartChar, length, tokenType, tokenModifiers bitset).
 * Tokens must be sorted by position for the deltas to be meaningful.
 */
function encodeSemanticTokens(
  tokens: { line: number; char: number; length: number; type: number; mods: number }[]
): number[] {
  tokens.sort((a, b) => a.line - b.line || a.char - b.char);
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of tokens) {
    const deltaLine = t.line - prevLine;
    const deltaChar = deltaLine === 0 ? t.char - prevChar : t.char;
    data.push(deltaLine, deltaChar, t.length, t.type, t.mods);
    prevLine = t.line;
    prevChar = t.char;
  }
  return data;
}

/** Run semanticRules over a document and encode the result. */
function buildSemanticTokens(
  index: DocumentIndex,
  rules: { tokenType?: string; pattern?: string; tokenModifiers?: string[] }[],
  legend: { tokenTypes?: string[]; tokenModifiers?: string[] } | undefined,
  clip?: LspRange
): number[] {
  const types = legend?.tokenTypes ?? [];
  const mods = legend?.tokenModifiers ?? [];
  const typeIndex = new Map(types.map((t, i) => [t, i]));
  const modIndex = new Map(mods.map((m, i) => [m, i]));

  const out: { line: number; char: number; length: number; type: number; mods: number }[] = [];
  for (const rule of rules) {
    if (!rule.pattern || !rule.tokenType) continue;
    const type = typeIndex.get(rule.tokenType);
    if (type === undefined) continue; // not in this language's legend

    let bits = 0;
    for (const m of rule.tokenModifiers ?? []) {
      const i = modIndex.get(m);
      if (i !== undefined) bits |= 1 << i;
    }

    for (const m of scan(index, rule.pattern, 0)) {
      // A token must not span lines in the LSP encoding.
      if (m.range.start.line !== m.range.end.line) continue;
      if (clip && !containsPosition(clip, m.range.start)) continue;
      out.push({
        line: m.range.start.line,
        char: m.range.start.character,
        length: m.range.end.character - m.range.start.character,
        type,
        mods: bits,
      });
    }
  }
  return encodeSemanticTokens(out);
}

function parseColor(text: string): LspColor | null {
  const s = text.trim().replace(/^["']|["']$/g, "");

  const hex = /^#([0-9a-fA-F]{3,8})$/.exec(s);
  if (hex) {
    const h = hex[1]!;
    const dup = (x: string) => parseInt(x + x, 16) / 255;
    const pair = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    if (h.length === 3) return { red: dup(h[0]!), green: dup(h[1]!), blue: dup(h[2]!), alpha: 1 };
    if (h.length === 4) return { red: dup(h[0]!), green: dup(h[1]!), blue: dup(h[2]!), alpha: dup(h[3]!) };
    if (h.length === 6) return { red: pair(0), green: pair(2), blue: pair(4), alpha: 1 };
    if (h.length === 8) return { red: pair(0), green: pair(2), blue: pair(4), alpha: pair(6) };
    return null;
  }

  const fn = /^(rgba?|hsla?)\s*\(([^)]*)\)$/i.exec(s);
  if (fn) {
    const name = fn[1]!.toLowerCase();
    const parts = fn[2]!.split(/[,\/\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const alpha = parts[3] !== undefined
      ? (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]))
      : 1;
    if (!Number.isFinite(alpha)) return null;

    if (name.startsWith("rgb")) {
      const [r, g, b] = [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!)];
      if (![r, g, b].every(Number.isFinite)) return null;
      return { red: r, green: g, blue: b, alpha: Math.min(1, Math.max(0, alpha)) };
    }

    const h = parseFloat(parts[0]!);
    const sat = parseFloat(parts[1]!) / 100;
    const light = parseFloat(parts[2]!) / 100;
    if (![h, sat, light].every(Number.isFinite)) return null;
    const [r, g, b] = hslToRgb(h, sat, light);
    return { red: r, green: g, blue: b, alpha: Math.min(1, Math.max(0, alpha)) };
  }

  return null;
}

// The data files are authored by hand, so a few fields are legitimately
// union-typed (`kind` may be a number or its name, `documentation` may be a
// bare string or a { value } object). These normalize to the LSP shape.

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Text of a `documentation` field that may be a string or a { value } object. */
function docText(doc: string | { value?: string } | undefined): string | undefined {
  if (typeof doc === "string") return doc || undefined;
  return doc?.value || undefined;
}

/** Display text of a `label` that may be a string or a { label } object. */
function labelText(label: string | { label: string } | undefined): string {
  if (typeof label === "string") return label;
  return label?.label ?? "";
}

/**
 * Look a client-supplied word up in a data dictionary.
 *
 * Uses an own-property check rather than plain indexing: a word like
 * "__proto__" or "constructor" would otherwise return an inherited
 * Object.prototype member, which is truthy and then blows up in the
 * converters. Returns undefined for anything not actually in the data.
 */
function lookup<T>(dict: Record<string, T> | undefined, word: string): T | undefined {
  if (!dict || !word) return undefined;
  if (!Object.prototype.hasOwnProperty.call(dict, word)) return undefined;
  const value = dict[word];
  return value == null ? undefined : value;
}

function toMarkup(value: string): LspMarkupContent {
  return { kind: "markdown", value };
}

// 1. Hover — HoverEntry → { contents: MarkupContent }
function convertHover(entry: HoverEntry): { contents: LspMarkupContent } {
  return { contents: toMarkup(entry.contents.map((c) => c.value).join("\n\n")) };
}

// 2. Completion — CECompletionItem → LspCompletionItem
function convertCompletionItem(c: CECompletionItem): LspCompletionItem {
  const docs = docText(c.documentation);
  return {
    label: labelText(c.label),
    kind: asNumber(c.kind),
    detail: c.detail,
    documentation: docs ? toMarkup(docs) : undefined,
    insertText: c.insertText,
    insertTextFormat: c.insertTextRules === 4 ? 2 : 1,
    sortText: c.sortText,
  };
}

function convertCompletionList(data: CompletionData): LspCompletionList {
  return { isIncomplete: false, items: (data.completions ?? []).map(convertCompletionItem) };
}

// 3. Signature Help — SignatureHelpData → LspSignatureHelp
function convertParameter(p: SignatureParameter): LspParameterInformation {
  const docs = docText(p.documentation);
  return { label: p.label, documentation: docs ? toMarkup(docs) : undefined };
}

function convertSignature(s: SignatureEntry): LspSignatureInformation {
  const docs = docText(s.documentation);
  return {
    label: s.label,
    documentation: docs ? toMarkup(docs) : undefined,
    parameters: (s.parameters ?? []).map(convertParameter),
  };
}

function convertSignatureHelp(data: SignatureHelpData): LspSignatureHelp {
  return {
    signatures: (data.signatures ?? []).map(convertSignature),
    activeSignature: 0,
    activeParameter: 0,
  };
}

// 4-7. Definition/Declaration/TypeDefinition → LocationLink[]
function convertToLocationLink(scheme: string, entry: { module?: string }): LspLocationLink {
  return { targetUri: `context://${scheme}/${entry.module || "builtin"}`, targetRange: ZERO_RANGE, targetSelectionRange: ZERO_RANGE };
}

// 9. Document Highlight — HighlightEntry → LspDocumentHighlight
function convertDocumentHighlight(entry: HighlightEntry): LspDocumentHighlight {
  return { range: ZERO_RANGE, kind: entry.kind };
}

// 10. Document Symbol — SymbolPattern → LspDocumentSymbol
function convertDocumentSymbol(p: SymbolPattern): LspDocumentSymbol {
  return { name: p.name, kind: asNumber(p.kind) ?? 0, range: ZERO_RANGE, selectionRange: ZERO_RANGE };
}

// 11. Code Action — CodeActionEntry → LspCodeAction
function convertCodeAction(a: CodeActionEntry): LspCodeAction {
  return {
    title: a.title, kind: a.kind, isPreferred: a.isPreferred,
    diagnostics: a.diagnostic ? [{ range: ZERO_RANGE, severity: a.severity ?? 2, message: a.description || a.title, source: "context-engine" }] : undefined,
  };
}

// 12. Code Lens — CodeLensPattern → LspCodeLens
function convertCodeLens(p: CodeLensPattern): LspCodeLens {
  return { range: ZERO_RANGE, command: { title: p.title, command: p.commandId }, data: { pattern: p.pattern, captureGroup: p.captureGroup } };
}

// 13. Document Link — LinkPattern → LspDocumentLink
function convertDocumentLink(p: LinkPattern): LspDocumentLink {
  return { range: ZERO_RANGE, tooltip: p.tooltip, data: { pattern: p.pattern, captureGroup: p.captureGroup, linkKind: p.linkKind } };
}

// 14. Color Presentation — string → LspColorPresentation
function convertColorPresentation(label: string): LspColorPresentation {
  return { label };
}

// 19. Folding Range — FoldingRule → LspFoldingRange
function convertFoldingRange(r: FoldingRule): LspFoldingRange {
  return { startLine: 0, endLine: 0, kind: r.kind === "comment" ? "comment" : r.kind === "imports" ? "imports" : "region" };
}

// 20. Selection Range — expansion hierarchy → nested chain
function buildSelectionRangeChain(hierarchy: string[]): LspSelectionRange | null {
  let current: LspSelectionRange | undefined;
  for (let i = hierarchy.length - 1; i >= 0; i--) {
    current = { range: ZERO_RANGE, parent: current };
  }
  return current ?? null;
}

// 23. Inlay Hint — InlayHintPattern → LspInlayHint
function convertInlayHint(p: InlayHintPattern): LspInlayHint {
  return { position: { line: 0, character: 0 }, label: p.label ?? "", kind: p.kind === 1 ? 1 : p.kind === 2 ? 2 : undefined, paddingLeft: p.paddingLeft, paddingRight: p.paddingRight, data: { pattern: p.pattern, position: p.position } };
}

// 24. Inline Completion — CEInlineCompletionItem → LspInlineCompletionItem
function convertInlineCompletion(c: CEInlineCompletionItem): LspInlineCompletionItem {
  return { insertText: c.insertText, filterText: c.triggerPattern };
}

function convertInlineCompletionList(data: InlineCompletionsData): LspInlineCompletionList {
  return { items: data.inlineCompletions.map(convertInlineCompletion) };
}

// ── Diagnostics ─────────────────────────────────────────────────────
// Patterns are compiled once per language (memoized via lang.derive) and
// reused across keystrokes, instead of being rebuilt on every change.
// Matching stays line-by-line: benchmarked against a whole-document scan
// with a line-offset index, per-line was faster on match-dense documents
// and keeps ^/$ semantics identical, so the index bought nothing.

export interface CompiledDiagnostic {
  regex: RegExp;
  severity: number;
  message: string;
}

/** Compile a language's diagnostic-producing code actions. Runs once. */
export function compileDiagnostics(actions: CodeActionEntry[]): CompiledDiagnostic[] {
  const compiled: CompiledDiagnostic[] = [];
  for (const action of actions) {
    if (!action.diagnostic || !action.pattern) continue;
    // `g` is required for the exec loop to advance.
    let flags = action.flags || "g";
    if (!flags.includes("g")) flags += "g";
    try {
      compiled.push({
        regex: new RegExp(action.pattern, flags),
        severity: action.severity ?? 2,
        message: action.title || action.description || "Issue detected",
      });
    } catch {
      // Invalid regex — dropped once here rather than re-thrown per keystroke.
    }
  }
  return compiled;
}

export function buildDiagnosticsFromText(
  text: string,
  rules: CompiledDiagnostic[]
): LspDiagnostic[] {
  // No diagnostic patterns (the case for every language currently shipped):
  // return before splitting the document. Previously every keystroke paid an
  // O(n) split and scan to produce an empty array.
  if (rules.length === 0) return [];

  const diagnostics: LspDiagnostic[] = [];
  const lines = text.split("\n");

  for (const rule of rules) {
    const { regex } = rule;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        diagnostics.push({
          range: {
            start: { line: i, character: match.index },
            end: { line: i, character: match.index + match[0].length },
          },
          severity: rule.severity,
          source: "context-engine",
          message: rule.message,
        });
        // A zero-length match would otherwise spin forever.
        if (match[0].length === 0) regex.lastIndex++;
      }
    }
  }
  return diagnostics;
}

// ═══════════════════════════════════════════════════════════════════
// JSON-RPC helpers
// ═══════════════════════════════════════════════════════════════════

function sendResult(writer: JsonRpcWriter, id: number | string, result: unknown): void {
  writer.write({ jsonrpc: "2.0", id, result });
}

function sendError(writer: JsonRpcWriter, id: number | string, code: number, message: string): void {
  writer.write({ jsonrpc: "2.0", id, error: { code, message } });
}

function sendNotification(writer: JsonRpcWriter, method: string, params: unknown): void {
  writer.write({ jsonrpc: "2.0", method, params });
}

/** The document URI a request refers to, if it carries one. */
function extractUri(params: any): string | undefined {
  const u = params?.textDocument?.uri;
  return typeof u === "string" ? u : undefined;
}

/** The LSP position a request refers to, if it carries one. */
function extractPosition(params: any): LspPosition | undefined {
  const p = params?.position;
  if (p && typeof p.line === "number" && typeof p.character === "number") {
    return { line: p.line, character: p.character };
  }
  return undefined;
}

export interface PatternLike { pattern?: string; captureGroup?: number }

/**
 * Run a set of `{ pattern, captureGroup }` rules over the document and return
 * LocationLinks for the ones whose captured name equals `word`.
 *
 * With no `word`, every match is returned — used by providers that list all
 * constructs rather than resolving one symbol.
 */
function matchNamed(
  index: DocumentIndex,
  uri: string,
  patterns: PatternLike[],
  word: string
): LspLocationLink[] {
  const out: LspLocationLink[] = [];
  for (const p of patterns) {
    if (!p.pattern) continue;
    for (const m of scan(index, p.pattern, p.captureGroup ?? 1)) {
      if (word && m.name !== word) continue;
      out.push({
        targetUri: uri,
        targetRange: m.contentRange,
        targetSelectionRange: m.groupRange ?? m.contentRange,
      });
    }
  }
  return out;
}

/**
 * String and comment delimiters for a language, so the formatter knows what
 * it must not rewrite. Memoized — it is two small file reads.
 */
function maskSourcesFor(c: Ctx): MaskSources {
  return c.lang.derive("fmt:mask", "languageConfiguration", (cfg) => {
    // `lineComment` is either a string or a { comment, noIndent } object.
    const comments: Record<string, unknown> = (cfg.comments ?? {}) as Record<string, unknown>;
    const lc = comments["lineComment"];
    const lineComment =
      typeof lc === "string" ? lc
      : (lc && typeof lc === "object" && typeof (lc as { comment?: unknown }).comment === "string")
        ? (lc as { comment: string }).comment
        : null;
    const bc = comments["blockComment"];
    const block =
      Array.isArray(bc) && bc.length === 2 && typeof bc[0] === "string" && typeof bc[1] === "string"
        ? ([bc[0], bc[1]] as [string, string])
        : null;
    return {
      stringDelimiters: c.lang.get("selectionRange")?.selectionRanges?.stringDelimiters ?? [],
      lineComment,
      blockComment: block,
    } satisfies MaskSources;
  }) ?? { stringDelimiters: [], lineComment: null, blockComment: null };
}

function formattingOptions(c: Ctx): { tabSize: number; insertSpaces: boolean } {
  const o = c.params?.options;
  const fmt = c.lang.get("formatting")?.formatting;
  return {
    tabSize: typeof o?.tabSize === "number" ? o.tabSize : (fmt?.defaultTabSize ?? 4),
    insertSpaces: typeof o?.insertSpaces === "boolean"
      ? o.insertSpaces
      : (fmt?.defaultInsertSpaces ?? true),
  };
}

/** Line index of the document a request refers to, when it is open. */
function indexFor(c: Ctx): DocumentIndex | undefined {
  const uri = extractUri(c.params);
  return uri ? getIndex(c.connectionId, uri) : undefined;
}

/**
 * The word a request is about.
 *
 * Prefers an explicit `word` (this server's own extension, and what the
 * tests use), then falls back to reading it out of the document at the
 * given position — which is what a standard LSP client sends.
 */
function resolveWord(c: Ctx, index?: DocumentIndex): string {
  const explicit = extractWord(c.params);
  if (explicit) return explicit;
  const pos = extractPosition(c.params);
  if (!index || !pos) return "";
  const wordPattern = c.lang.get("rename")?.wordPattern;
  return wordAt(index, pos, wordPattern || undefined)?.word ?? "";
}

function extractWord(params: unknown): string {
  const p = params as Record<string, any> | undefined;
  if (p?.context?.word) return p.context.word;
  if (p?.word) return p.word;
  return "";
}

// ── Request handler ─────────────────────────────────────────────────
export function handleRequest(
  message: JsonRpcRequest,
  connectionId: string,
  languageId: string,
  lang: LanguageHandle,
  capabilities: ServerCapabilities,
  writer: JsonRpcWriter
): void {
  const { id, method, params } = message;

  // A malformed request must not take down the process (and with it every
  // other connected client) — answer it as a JSON-RPC error instead.
  try {
    dispatchRequest(id, method, params, connectionId, languageId, lang, capabilities, writer);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[${languageId}] ${method} failed: ${detail}`);
    sendError(writer, id, -32603, `Internal error handling ${method}: ${detail}`);
  }
}

/**
 * Request dispatch.
 *
 * A Map lookup rather than a 50-arm string switch: method resolution is a
 * single hash probe, O(1) in the number of methods, instead of walking the
 * cases. Handlers close over nothing, so the table is built once at module
 * load and shared by every connection.
 */
interface Ctx {
  id: number | string;
  params: any;
  connectionId: string;
  languageId: string;
  lang: LanguageHandle;
  capabilities: ServerCapabilities;
  writer: JsonRpcWriter;
}

type Handler = (c: Ctx) => void;

/** Reply with a memoized, already-converted list; null when absent/empty. */
function sendList<K extends Parameters<LanguageHandle["derive"]>[1], T>(
  c: Ctx,
  view: string,
  provider: K,
  factory: (data: any) => T[] | null
): void {
  const list = c.lang.derive(view, provider, factory as any) as T[] | null | undefined;
  sendResult(c.writer, c.id, list && list.length > 0 ? list : null);
}

const HANDLERS = new Map<string, Handler>([
  // ── Lifecycle ───────────────────────────────────────────────────
  ["initialize", (c) =>
    sendResult(c.writer, c.id, {
      capabilities: c.capabilities,
      serverInfo: { name: "context-engine-lsp", version: "1.15.0" },
    })],
  ["shutdown", (c) => sendResult(c.writer, c.id, null)],

  // ── Word lookups — O(1) hash probe into the provider's dictionary ─
  ["textDocument/hover", (c) => {
    const entry = lookup(c.lang.get("hover")?.hovers, extractWord(c.params));
    sendResult(c.writer, c.id, entry ? convertHover(entry) : null);
  }],
  ["textDocument/definition", (c) => {
    const uri = extractUri(c.params);
    const index = indexFor(c);
    const word = resolveWord(c, index);

    // A definition in the file the user is editing beats a synthetic
    // context:// link to a documentation entry.
    if (index && uri && word) {
      const links = matchNamed(index, uri, c.lang.get("declaration")?.declarationPatterns ?? [], word);
      if (links.length) { sendResult(c.writer, c.id, links); return; }
    }
    const entry = lookup(c.lang.get("definition")?.definitions, word);
    sendResult(c.writer, c.id, entry ? [convertToLocationLink("definition", entry)] : null);
  }],
  // declarationPatterns are populated for all 96 languages; the dict of
  // builtin declarations only for 31. Prefer a real in-document location,
  // fall back to the dict entry.
  ["textDocument/declaration", (c) => {
    const uri = extractUri(c.params);
    const index = indexFor(c);
    const word = resolveWord(c, index);
    const data = c.lang.get("declaration");

    if (index && uri && word) {
      const links = matchNamed(index, uri, data?.declarationPatterns ?? [], word);
      if (links.length) { sendResult(c.writer, c.id, links); return; }
    }
    const decls = data?.declarations;
    const entry = Array.isArray(decls) ? undefined : lookup(decls, word);
    sendResult(c.writer, c.id, entry ? [convertToLocationLink("declaration", entry)] : null);
  }],
  ["textDocument/typeDefinition", (c) => {
    const entry = lookup(c.lang.get("typeDefinition")?.typeDefinitions, extractWord(c.params));
    sendResult(c.writer, c.id, entry ? [convertToLocationLink("typeDefinition", entry)] : null);
  }],
  // Highlights every occurrence in the document. The highlights table
  // supplies the kind (read/write/text) when the word is a known keyword.
  ["textDocument/documentHighlight", (c) => {
    const index = indexFor(c);
    const word = resolveWord(c, index);
    const entry = lookup(c.lang.get("documentHighlight")?.highlights, word);
    if (!index) {
      sendResult(c.writer, c.id, entry ? [convertDocumentHighlight(entry)] : null);
      return;
    }
    const kind = entry ? asNumber(entry.kind) ?? 0 : 0;
    const hits = scanWord(index, word).map((m): LspDocumentHighlight => ({ range: m.range, kind }));
    sendResult(c.writer, c.id, hits.length ? hits : null);
  }],

  // ── List responses — converted once per language, then O(1) ──────
  ["textDocument/completion", (c) => {
    const list = c.lang.derive("lsp:completion", "completion", convertCompletionList);
    sendResult(c.writer, c.id, list ?? null);
  }],
  ["textDocument/signatureHelp", (c) => {
    const help = c.lang.derive("lsp:signatureHelp", "signatureHelp", (d) =>
      d.signatures?.length ? convertSignatureHelp(d) : null);
    sendResult(c.writer, c.id, help ?? null);
  }],
  ["textDocument/inlineCompletion", (c) => {
    const list = c.lang.derive("lsp:inlineCompletion", "inlineCompletions", convertInlineCompletionList);
    sendResult(c.writer, c.id, list ?? null);
  }],
  // Runs the language's symbolPatterns over the document, so the outline
  // reflects real positions. Falls back to the pattern list (all at 0,0)
  // when the document is not open — a client that never sent didOpen.
  ["textDocument/documentSymbol", (c) => {
    const index = indexFor(c);
    const patterns = c.lang.get("documentSymbol")?.symbolPatterns ?? [];
    if (!index) {
      sendResult(c.writer, c.id, patterns.length ? patterns.map(convertDocumentSymbol) : null);
      return;
    }
    const out: LspDocumentSymbol[] = [];
    for (const pat of patterns) {
      if (!pat.pattern) continue;
      for (const m of scan(index, pat.pattern, pat.captureGroup ?? 1)) {
        out.push({
          name: m.name,
          kind: asNumber(pat.kind) ?? 13,
          range: m.contentRange,
          selectionRange: m.groupRange ?? m.contentRange,
        });
      }
    }
    out.sort((a, b) =>
      a.range.start.line - b.range.start.line ||
      a.range.start.character - b.range.start.character);
    sendResult(c.writer, c.id, out.length ? out : null);
  }],
  ["textDocument/codeAction", (c) =>
    sendList(c, "lsp:codeAction", "codeActions", (d) =>
      (d.codeActions ?? []).map(convertCodeAction))],
  ["textDocument/codeLens", (c) => {
    const index = indexFor(c);
    const patterns = c.lang.get("codeLens")?.codeLensPatterns ?? [];
    if (!index) {
      sendResult(c.writer, c.id, patterns.length ? patterns.map(convertCodeLens) : null);
      return;
    }
    const out: LspCodeLens[] = [];
    for (const p of patterns) {
      if (!p.pattern) continue;
      for (const m of scan(index, p.pattern, p.captureGroup ?? 1)) {
        out.push({
          range: m.groupRange ?? m.contentRange,
          command: { title: p.title, command: p.commandId, arguments: [m.name] },
          data: { symbol: m.name },
        });
      }
    }
    out.sort((a, b) => a.range.start.line - b.range.start.line);
    sendResult(c.writer, c.id, out.length ? out : null);
  }],
  ["textDocument/documentLink", (c) => {
    const index = indexFor(c);
    const patterns = c.lang.get("links")?.linkPatterns ?? [];
    if (!index) {
      sendResult(c.writer, c.id, patterns.length ? patterns.map(convertDocumentLink) : null);
      return;
    }
    const out: LspDocumentLink[] = [];
    for (const p of patterns) {
      if (!p.pattern) continue;
      for (const m of scan(index, p.pattern, p.captureGroup ?? 1)) {
        // A bare URL is directly resolvable; anything else (a module path,
        // an import target) needs client-side resolution, so pass the
        // captured text through as data rather than inventing a URL.
        const isUrl = /^(?:https?|file|ftp):\/\//.test(m.name);
        out.push({
          range: m.groupRange ?? m.contentRange,
          tooltip: p.tooltip,
          ...(isUrl ? { target: m.name } : {}),
          data: { target: m.name, linkKind: p.linkKind, pattern: p.pattern },
        });
      }
    }
    sendResult(c.writer, c.id, out.length ? out : null);
  }],
  ["textDocument/foldingRange", (c) => {
    const index = indexFor(c);
    const data = c.lang.get("foldingRange");
    const rules = data?.foldingRules ?? [];
    if (!index) {
      sendResult(c.writer, c.id, rules.length ? rules.map(convertFoldingRange) : null);
      return;
    }
    const ranges = computeFoldingRanges(index, rules as FoldRule[]);
    // Region markers from languageConfiguration-style folding markers.
    const markers = data?.markers;
    if (markers?.start && markers?.end) {
      for (const r of computeFoldingRanges(index, [
        { startPattern: markers.start, endPattern: markers.end, kind: "region" },
      ])) ranges.push(r);
    }
    const out: LspFoldingRange[] = ranges.map((r) => ({
      startLine: r.startLine,
      endLine: r.endLine,
      kind: r.kind === "comment" || r.kind === "imports" || r.kind === "region"
        ? r.kind : undefined,
    }));
    sendResult(c.writer, c.id, out.length ? out : null);
  }],
  ["textDocument/inlayHint", (c) => {
    const index = indexFor(c);
    const patterns = (c.lang.get("inlayHints")?.inlayHintPatterns ?? []) as InlayHintPattern[];
    if (!index) {
      sendResult(c.writer, c.id, patterns.length ? patterns.map(convertInlayHint) : null);
      return;
    }
    const out: LspInlayHint[] = [];
    for (const p of patterns) {
      if (!p.pattern) continue;
      // Only hints with a literal label can be placed without type
      // inference; templated labels ({inferred_type}, {param_name}) need a
      // real analyser, so they are skipped rather than shown as literals.
      const label = typeof p.label === "string" ? p.label : "";
      if (!label || label.includes("{")) continue;

      for (const m of scan(index, p.pattern, p.captureGroup ?? 1)) {
        const anchor = m.groupRange ?? m.contentRange;
        const after = typeof p.position === "string" && p.position.startsWith("after");
        out.push({
          position: after ? anchor.end : anchor.start,
          label,
          kind: p.kind === 1 ? 1 : p.kind === 2 ? 2 : undefined,
          paddingLeft: p.paddingLeft,
          paddingRight: p.paddingRight,
        });
      }
    }
    sendResult(c.writer, c.id, out.length ? out : null);
  }],
  ["textDocument/colorPresentation", (c) => {
    const list = c.lang.derive("lsp:colorPresentation", "color", (d) =>
      (d.colorPresentations ?? []).map(convertColorPresentation));
    sendResult(c.writer, c.id, list ?? []);
  }],
  // Builds a real expansion chain: every pattern range containing the
  // cursor, ordered innermost-first so each is the parent of the last.
  ["textDocument/selectionRange", (c) => {
    const index = indexFor(c);
    const positions: LspPosition[] = Array.isArray(c.params?.positions)
      ? c.params.positions
      : (extractPosition(c.params) ? [extractPosition(c.params)!] : []);

    if (!index || positions.length === 0) {
      const chain = c.lang.derive("lsp:selectionRange", "selectionRange", (d) => {
        const sr = d.selectionRanges;
        return sr ? buildSelectionRangeChain(sr.expansionHierarchy ?? []) : null;
      });
      sendResult(c.writer, c.id, chain ? [chain] : null);
      return;
    }

    const data = c.lang.get("selectionRange");
    const pats = (data?.selectionPatterns ?? []) as PatternLike[];
    const wordPattern = data?.selectionRanges?.wordPattern;

    const out = positions.map((pos) => {
      const spans: LspRange[] = [];
      const w = wordAt(index, pos, wordPattern || undefined);
      if (w) spans.push(w.range);

      for (const p of pats) {
        if (!p.pattern) continue;
        for (const m of scan(index, p.pattern, 0)) {
          if (containsPosition(m.range, pos)) spans.push(m.range);
        }
      }
      spans.push({
        start: { line: 0, character: 0 },
        end: positionAt(index, index.text.length),
      });

      // innermost first, so the chain nests correctly
      spans.sort((a, b) => rangeSize(a) - rangeSize(b));

      let node: LspSelectionRange | undefined;
      for (let i = spans.length - 1; i >= 0; i--) node = { range: spans[i]!, parent: node };
      return node!;
    });

    sendResult(c.writer, c.id, out);
  }],
  // Pairs an open/close construct (an HTML tag, mainly) so renaming one
  // end renames the other.
  ["textDocument/linkedEditingRange", (c) => {
    const ler = c.lang.get("linkedEditingRange");
    if (!ler?.supported) { sendResult(c.writer, c.id, null); return; }

    const index = indexFor(c);
    const pos = extractPosition(c.params);
    if (!index || !pos) {
      sendResult(c.writer, c.id, { ranges: [], wordPattern: ler.wordPattern } as LspLinkedEditingRanges);
      return;
    }

    for (const p of ler.linkedEditingPatterns ?? []) {
      if (!p.openPattern || !p.closePattern) continue;
      const opens = scan(index, p.openPattern, 1);
      const closes = scan(index, p.closePattern, 1);

      const hit = opens.find((m) => containsPosition(m.groupRange ?? m.range, pos))
               ?? closes.find((m) => containsPosition(m.groupRange ?? m.range, pos));
      if (!hit) continue;

      // Match on the captured name so <div> pairs with </div>, not </span>.
      const partner = (opens.includes(hit) ? closes : opens)
        .filter((m) => m.name === hit.name)
        .sort((a, b) => Math.abs(a.offset - hit.offset) - Math.abs(b.offset - hit.offset))[0];
      if (!partner) continue;

      const ranges = [hit.groupRange ?? hit.range, partner.groupRange ?? partner.range]
        .sort((a, b) => a.start.line - b.start.line || a.start.character - b.start.character);
      sendResult(c.writer, c.id, { ranges, wordPattern: ler.wordPattern } as LspLinkedEditingRanges);
      return;
    }

    sendResult(c.writer, c.id, null);
  }],

  // ── Presence-only responses — answered from the path index, no I/O ─
  ["textDocument/prepareRename", (c) => {
    if (!c.lang.has("rename")) { sendResult(c.writer, c.id, null); return; }
    const index = indexFor(c);
    const pos = extractPosition(c.params);
    const data = c.lang.get("rename");
    if (!index || !pos) { sendResult(c.writer, c.id, { defaultBehavior: true }); return; }

    const w = wordAt(index, pos, data?.wordPattern || undefined);
    if (!w) { sendResult(c.writer, c.id, null); return; }
    // Reserved words cannot be renamed.
    const reserved = (data?.identifierRules as { reservedWords?: string[] } | undefined)?.reservedWords;
    if (reserved?.includes(w.word)) { sendResult(c.writer, c.id, null); return; }
    sendResult(c.writer, c.id, { range: w.range, placeholder: w.word });
  }],
  ["textDocument/semanticTokens/full", (c) => {
    if (!c.lang.has("semanticTokens")) { sendResult(c.writer, c.id, null); return; }
    const index = indexFor(c);
    const data = c.lang.get("semanticTokens");
    if (!index) { sendResult(c.writer, c.id, { data: [] } as LspSemanticTokens); return; }
    sendResult(c.writer, c.id, {
      data: buildSemanticTokens(index, data?.semanticRules ?? [], data?.legend),
    } as LspSemanticTokens);
  }],
  ["textDocument/semanticTokens/range", (c) => {
    if (!c.lang.has("rangeSemanticTokens")) { sendResult(c.writer, c.id, null); return; }
    const index = indexFor(c);
    const data = c.lang.get("rangeSemanticTokens");
    if (!index) { sendResult(c.writer, c.id, { data: [] } as LspSemanticTokens); return; }
    const clip: LspRange | undefined = c.params?.range;
    // rangeTokenRules use `type`, the full-document rules use `tokenType`.
    const rules = (data?.rangeTokenRules ?? []).map((r: any) => ({
      tokenType: r.type ?? r.tokenType,
      pattern: r.pattern,
      tokenModifiers: r.modifiers ?? r.tokenModifiers,
    }));
    sendResult(c.writer, c.id, {
      data: buildSemanticTokens(index, rules, data?.tokenLegend, clip),
    } as LspSemanticTokens);
  }],

  // ── Not backed by positional data — constant null/empty ──────────
  // Every occurrence of the identifier in the open document.
  ["textDocument/references", (c) => {
    const uri = extractUri(c.params);
    const index = indexFor(c);
    const word = resolveWord(c, index);
    if (!index || !uri || !word) { sendResult(c.writer, c.id, null); return; }

    const includeDecl = c.params?.context?.includeDeclaration !== false;
    const locs = scanWord(index, word).map((m) => ({ uri, range: m.range }));
    const out = includeDecl ? locs : locs.slice(1);
    sendResult(c.writer, c.id, out.length ? out : null);
  }],
  // implementationPatterns capture the declaring construct (class X(Base)).
  ["textDocument/implementation", (c) => {
    const uri = extractUri(c.params);
    const index = indexFor(c);
    const word = resolveWord(c, index);
    if (!index || !uri) { sendResult(c.writer, c.id, null); return; }

    const pats = c.lang.get("implementation")?.implementationPatterns ?? [];
    const links = matchNamed(index, uri, pats as PatternLike[], word);
    sendResult(c.writer, c.id, links.length ? links : null);
  }],
  // Applies the language's formatting rules, skipping any match that would
  // land inside a string literal or comment.
  ["textDocument/formatting", (c) => {
    const index = indexFor(c);
    const rules = (c.lang.get("formatting")?.formatting?.rules ?? []) as FormatRule[];
    if (!index || rules.length === 0) { sendResult(c.writer, c.id, null); return; }
    sendResult(c.writer, c.id, formatDocument(index, rules, maskSourcesFor(c)));
  }],
  ["textDocument/rangeFormatting", (c) => {
    const index = indexFor(c);
    const range: LspRange | undefined = c.params?.range;
    // The range rules are declarative actions (reindent, align, ...) rather
    // than substitutions, so the document rules are applied to the selected
    // lines instead.
    const rules = (c.lang.get("formatting")?.formatting?.rules ?? []) as FormatRule[];
    if (!index || !range || rules.length === 0) { sendResult(c.writer, c.id, null); return; }
    sendResult(c.writer, c.id, formatRange(index, range, rules, maskSourcesFor(c)));
  }],
  ["textDocument/onTypeFormatting", (c) => {
    const index = indexFor(c);
    const pos = extractPosition(c.params);
    const ch = typeof c.params?.ch === "string" ? c.params.ch : "";
    const data = c.lang.get("onTypeFormatting");
    if (!index || !pos || !ch || !data) { sendResult(c.writer, c.id, null); return; }
    // formatRules/indentation are loosely typed in the data interfaces.
    const triggers = Array.isArray(data.formatRules) ? (data.formatRules as OnTypeTrigger[]) : [];
    const indentation = (data.indentation ?? undefined) as IndentationRules | undefined;
    sendResult(c.writer, c.id, onTypeEdits(index, pos, ch, triggers, indentation, formattingOptions(c)));
  }],
  ["textDocument/rename", (c) => {
    const uri = extractUri(c.params);
    const index = indexFor(c);
    const pos = extractPosition(c.params);
    const newName = typeof c.params?.newName === "string" ? c.params.newName : "";
    if (!uri || !index || !pos || !newName) { sendResult(c.writer, c.id, null); return; }

    const data = c.lang.get("rename");
    const w = wordAt(index, pos, data?.wordPattern || undefined);
    if (!w) { sendResult(c.writer, c.id, null); return; }

    const edits = scanWord(index, w.word).map((m) => ({ range: m.range, newText: newName }));
    sendResult(c.writer, c.id, edits.length ? { changes: { [uri]: edits } } : null);
  }],
  // Parses the colour literals colorPatterns describe into real
  // ColorInformation. Only formats we can decode are emitted.
  ["textDocument/documentColor", (c) => {
    const index = indexFor(c);
    if (!index) { sendResult(c.writer, c.id, []); return; }

    const patterns = c.lang.get("color")?.colorPatterns ?? [];
    const out: LspColorInformation[] = [];
    const seen = new Set<string>();

    for (const p of patterns) {
      if (!p.pattern) continue;
      for (const m of scan(index, p.pattern, 0)) {
        const color = parseColor(m.text);
        if (!color) continue;
        const key = `${m.range.start.line}:${m.range.start.character}:${m.range.end.character}`;
        if (seen.has(key)) continue; // overlapping patterns match the same literal
        seen.add(key);
        out.push({ range: m.range, color });
      }
    }
    sendResult(c.writer, c.id, out);
  }],

  // ── Monaco-specific / context-engine extensions ──────────────────
  ["textDocument/monarchTokens", (c) => {
    const mt = c.lang.get("monarchTokens");
    if (!mt) { sendResult(c.writer, c.id, null); return; }
    sendResult(c.writer, c.id, {
      tokenPostfix: mt.tokenPostfix,
      defaultToken: mt.defaultToken,
      keywords: mt.keywords,
      typeKeywords: mt.typeKeywords,
      operators: mt.operators,
      symbols: mt.symbols,
      escapes: mt.escapes,
      digits: mt.digits,
      brackets: mt.brackets,
      tokenizer: mt.tokenizer,
    });
  }],
  ["textDocument/newSymbolNames", (c) => {
    const ns = c.lang.get("newSymbolNames");
    if (!ns) { sendResult(c.writer, c.id, null); return; }

    // Rule patterns are compiled once per language, not per request.
    const rules = c.lang.derive("rx:newSymbolNames", "newSymbolNames", (d) => {
      const out: { regex: RegExp; names: { newSymbolName: string; tags: number[] }[] }[] = [];
      for (const r of d.renameSuggestionRules ?? []) {
        try {
          out.push({ regex: new RegExp(r.pattern), names: r.suggestedNames ?? [] });
        } catch { /* invalid pattern — drop it permanently */ }
      }
      return out;
    }) ?? [];

    const word = extractWord(c.params);
    const suggestions: { newSymbolName: string; tags: number[] }[] = [];
    for (const rule of rules) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(word)) suggestions.push(...rule.names);
    }

    sendResult(c.writer, c.id, {
      triggerKinds: ns.triggerKinds,
      tags: ns.tags,
      symbolKinds: ns.symbolKinds,
      namingConventions: ns.namingConventions,
      suggestions,
      reservedWords: ns.reservedWords,
      identifierRules: ns.identifierRules,
    });
  }],
  ["textDocument/multiDocumentHighlight", (c) => {
    const mdh = c.lang.get("multiDocumentHighlight");
    if (!mdh) { sendResult(c.writer, c.id, null); return; }
    sendResult(c.writer, c.id, {
      selector: mdh.selector,
      highlightKinds: mdh.highlightKinds,
      crossFileSymbols: mdh.crossFileSymbols,
      importExportPatterns: mdh.importExportPatterns,
      scopeRules: mdh.scopeRules,
      writeOperations: mdh.writeOperations,
      readOperations: mdh.readOperations,
      declarationPatterns: mdh.declarationPatterns,
      referencePatterns: mdh.referencePatterns,
      specialHighlights: mdh.specialHighlights,
    });
  }],

  // ── context/* — raw provider data ────────────────────────────────
  ["context/languageData", (c) => sendResult(c.writer, c.id, c.lang.all())],
  ["context/listLanguages", (c) => sendResult(c.writer, c.id, listLanguages())],
]);

// Raw passthrough methods share one handler, resolved through a second
// O(1) map rather than a case per method.
const RAW_METHODS = new Map<string, Parameters<LanguageHandle["derive"]>[1]>([
  ["context/references", "references"],
  ["context/implementation", "implementation"],
  ["context/formatting", "formatting"],
  ["context/rangeFormatting", "documentRangeFormatting"],
  ["context/onTypeFormatting", "onTypeFormatting"],
  ["context/rename", "rename"],
  ["context/foldingRange", "foldingRange"],
  ["context/selectionRange", "selectionRange"],
  ["context/color", "color"],
  ["context/semanticTokens", "semanticTokens"],
  ["context/rangeSemanticTokens", "rangeSemanticTokens"],
  ["context/languageConfiguration", "languageConfiguration"],
]);

for (const [method, provider] of RAW_METHODS) {
  HANDLERS.set(method, (c) => sendResult(c.writer, c.id, c.lang.get(provider) ?? null));
}

function dispatchRequest(
  id: number | string,
  method: string,
  params: any,
  connectionId: string,
  languageId: string,
  lang: LanguageHandle,
  capabilities: ServerCapabilities,
  writer: JsonRpcWriter
): void {
  const handler = HANDLERS.get(method);
  if (!handler) {
    sendError(writer, id, -32601, `Method not found: ${method}`);
    return;
  }
  handler({ id, params, connectionId, languageId, lang, capabilities, writer });
}

// ── Notification handler ────────────────────────────────────────────
export function handleNotification(
  message: JsonRpcNotification,
  connectionId: string,
  languageId: string,
  lang: LanguageHandle,
  writer: JsonRpcWriter
): void {
  const { method, params } = message;

  // Notifications have no id to reply to, so a throw here would be an
  // unhandled exception. Log and carry on.
  try {
    dispatchNotification(method, params, connectionId, languageId, lang, writer);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[${languageId}] notification ${method} failed: ${detail}`);
  }
}

function dispatchNotification(
  method: string,
  params: any,
  connectionId: string,
  languageId: string,
  lang: LanguageHandle,
  writer: JsonRpcWriter
): void {
  switch (method) {
    case "initialized":
      console.log(`[${languageId}] client initialized`);
      break;

    case "textDocument/didOpen": {
      const uri = params?.textDocument?.uri;
      const text = params?.textDocument?.text;
      console.log(`[${languageId}] didOpen: ${uri}`);
      if (uri && typeof text === "string") {
        setDocument(connectionId, uri, text);
        publishDiagnostics(uri, text, lang, writer);
      }
      break;
    }

    case "textDocument/didChange": {
      const uri = params?.textDocument?.uri;
      const changes = params?.contentChanges;
      const text = changes?.[changes.length - 1]?.text;
      if (uri && typeof text === "string") {
        setDocument(connectionId, uri, text);
        publishDiagnostics(uri, text, lang, writer);
      }
      break;
    }

    case "textDocument/didClose": {
      const uri = params?.textDocument?.uri;
      if (uri) {
        removeDocument(connectionId, uri);
        // Clear diagnostics for the closed document.
        const payload: LspPublishDiagnosticsParams = { uri, diagnostics: [] };
        sendNotification(writer, "textDocument/publishDiagnostics", payload);
      }
      console.log(
        `[${languageId}] didClose: ${uri} (${documentCount(connectionId)} still open)`
      );
      break;
    }

    case "exit":
      break;
    default:
      break;
  }
}

// ── Diagnostics from codeActions data ───────────────────────────────
function publishDiagnostics(
  uri: string,
  text: string,
  lang: LanguageHandle,
  writer: JsonRpcWriter
): void {
  // Compiled once per language and memoized; a keystroke costs a cache
  // hit, not 'recompile every pattern'.
  const rules =
    lang.derive("rx:diagnostics", "codeActions", (d) => compileDiagnostics(d.codeActions ?? [])) ?? [];

  // buildDiagnosticsFromText short-circuits when there are no rules, so a
  // language with no diagnostic patterns (currently every one shipped)
  // never touches the document text. The notification is still sent, so
  // the protocol behaviour is unchanged.
  const diagnostics: LspDiagnostic[] = buildDiagnosticsFromText(text, rules);
  const payload: LspPublishDiagnosticsParams = { uri, diagnostics };
  sendNotification(writer, "textDocument/publishDiagnostics", payload);
}
