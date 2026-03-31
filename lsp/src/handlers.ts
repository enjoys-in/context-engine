import type { JsonRpcWriter } from "./jsonrpc.ts";
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  LanguageProviders,
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
import { loadLanguageData, listLanguages } from "./dataLoader.ts";

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
interface LspDocumentLink { range: LspRange; tooltip?: string; data?: unknown }
interface LspColorPresentation { label: string }

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

function toMarkup(value: string): LspMarkupContent {
  return { kind: "markdown", value };
}

// 1. Hover — HoverEntry → { contents: MarkupContent }
function convertHover(entry: HoverEntry): { contents: LspMarkupContent } {
  return { contents: toMarkup(entry.contents.map((c) => c.value).join("\n\n")) };
}

// 2. Completion — CECompletionItem → LspCompletionItem
function convertCompletionItem(c: CECompletionItem): LspCompletionItem {
  return {
    label: c.label,
    kind: c.kind,
    detail: c.detail,
    documentation: c.documentation?.value ? toMarkup(c.documentation.value) : undefined,
    insertText: c.insertText,
    insertTextFormat: c.insertTextRules === 4 ? 2 : 1,
    sortText: c.sortText,
  };
}

function convertCompletionList(data: CompletionData): LspCompletionList {
  return { isIncomplete: false, items: data.completions.map(convertCompletionItem) };
}

// 3. Signature Help — SignatureHelpData → LspSignatureHelp
function convertParameter(p: SignatureParameter): LspParameterInformation {
  return { label: p.label, documentation: p.documentation?.value ? toMarkup(p.documentation.value) : undefined };
}

function convertSignature(s: SignatureEntry): LspSignatureInformation {
  return { label: s.label, documentation: s.documentation?.value ? toMarkup(s.documentation.value) : undefined, parameters: s.parameters.map(convertParameter) };
}

function convertSignatureHelp(data: SignatureHelpData): LspSignatureHelp {
  return { signatures: data.signatures.map(convertSignature), activeSignature: 0, activeParameter: 0 };
}

// 4-7. Definition/Declaration/TypeDefinition → LocationLink[]
function convertToLocationLink(scheme: string, entry: { module: string }): LspLocationLink {
  return { targetUri: `context://${scheme}/${entry.module || "builtin"}`, targetRange: ZERO_RANGE, targetSelectionRange: ZERO_RANGE };
}

// 9. Document Highlight — HighlightEntry → LspDocumentHighlight
function convertDocumentHighlight(entry: HighlightEntry): LspDocumentHighlight {
  return { range: ZERO_RANGE, kind: entry.kind };
}

// 10. Document Symbol — SymbolPattern → LspDocumentSymbol
function convertDocumentSymbol(p: SymbolPattern): LspDocumentSymbol {
  return { name: p.name, kind: p.kind, range: ZERO_RANGE, selectionRange: ZERO_RANGE };
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
  return { position: { line: 0, character: 0 }, label: p.label, kind: p.kind === 1 ? 1 : p.kind === 2 ? 2 : undefined, paddingLeft: p.paddingLeft, paddingRight: p.paddingRight, data: { pattern: p.pattern, position: p.position } };
}

// 24. Inline Completion — CEInlineCompletionItem → LspInlineCompletionItem
function convertInlineCompletion(c: CEInlineCompletionItem): LspInlineCompletionItem {
  return { insertText: c.insertText, filterText: c.triggerPattern };
}

function convertInlineCompletionList(data: InlineCompletionsData): LspInlineCompletionList {
  return { items: data.inlineCompletions.map(convertInlineCompletion) };
}

// Diagnostics — build from codeAction patterns against document text
function buildDiagnosticsFromText(text: string, actions: CodeActionEntry[]): LspDiagnostic[] {
  const diagnostics: LspDiagnostic[] = [];
  const lines = text.split("\n");
  for (const action of actions) {
    if (!action.diagnostic || !action.pattern) continue;
    try {
      const regex = new RegExp(action.pattern, action.flags || "g");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
          diagnostics.push({
            range: { start: { line: i, character: match.index }, end: { line: i, character: match.index + match[0].length } },
            severity: action.severity ?? 2,
            source: "context-engine",
            message: action.title || action.description || "Issue detected",
          });
        }
      }
    } catch { /* invalid regex — skip */ }
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
  providers: LanguageProviders,
  capabilities: ServerCapabilities,
  writer: JsonRpcWriter
): void {
  const { id, method, params } = message;

  switch (method) {
    // ── Lifecycle ─────────────────────────────────────────────────

    case "initialize": {
      sendResult(writer, id, {
        capabilities,
        serverInfo: { name: "context-engine-lsp", version: "1.15.0" },
      });
      break;
    }

    case "shutdown": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/completion → CompletionList | null ──────────

    case "textDocument/completion": {
      const data = providers.completion;
      if (!data) { sendResult(writer, id, null); break; }
      sendResult(writer, id, convertCompletionList(data));
      break;
    }

    // ── textDocument/hover → HoverResponse | null ───────────────

    case "textDocument/hover": {
      const word = extractWord(params);
      const entry = providers.hover?.hovers?.[word];
      if (!entry) { sendResult(writer, id, null); break; }
      sendResult(writer, id, convertHover(entry));
      break;
    }

    // ── textDocument/signatureHelp → SignatureHelp | null ────────

    case "textDocument/signatureHelp": {
      const data = providers.signatureHelp;
      if (!data?.signatures?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, convertSignatureHelp(data));
      break;
    }

    // ── textDocument/definition → LocationLink[] | null ─────────

    case "textDocument/definition": {
      const word = extractWord(params);
      const entry = providers.definition?.definitions?.[word];
      if (!entry) { sendResult(writer, id, null); break; }
      sendResult(writer, id, [convertToLocationLink("definition", entry)]);
      break;
    }

    // ── textDocument/declaration → LocationLink[] | null ────────

    case "textDocument/declaration": {
      const word = extractWord(params);
      const entry = providers.declaration?.declarations?.[word];
      if (!entry) { sendResult(writer, id, null); break; }
      sendResult(writer, id, [convertToLocationLink("declaration", entry)]);
      break;
    }

    // ── textDocument/typeDefinition → LocationLink[] | null ─────

    case "textDocument/typeDefinition": {
      const word = extractWord(params);
      const entry = providers.typeDefinition?.typeDefinitions?.[word];
      if (!entry) { sendResult(writer, id, null); break; }
      sendResult(writer, id, [convertToLocationLink("typeDefinition", entry)]);
      break;
    }

    // ── textDocument/implementation → null (pattern-only data) ──

    case "textDocument/implementation": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/references → null (pattern-only data) ──────

    case "textDocument/references": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/documentHighlight → DocumentHighlight[] | null

    case "textDocument/documentHighlight": {
      const word = extractWord(params);
      const entry = providers.documentHighlight?.highlights?.[word];
      if (!entry) { sendResult(writer, id, null); break; }
      sendResult(writer, id, [convertDocumentHighlight(entry)]);
      break;
    }

    // ── textDocument/documentSymbol → DocumentSymbol[] | null ────

    case "textDocument/documentSymbol": {
      const patterns = providers.documentSymbol?.symbolPatterns;
      if (!patterns?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, patterns.map(convertDocumentSymbol));
      break;
    }

    // ── textDocument/codeAction → CodeAction[] | null ───────────

    case "textDocument/codeAction": {
      const actions = providers.codeActions?.codeActions;
      if (!actions?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, actions.map(convertCodeAction));
      break;
    }

    // ── textDocument/codeLens → CodeLens[] | null ───────────────

    case "textDocument/codeLens": {
      const patterns = providers.codeLens?.codeLensPatterns;
      if (!patterns?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, patterns.map(convertCodeLens));
      break;
    }

    // ── textDocument/documentLink → DocumentLink[] | null ───────

    case "textDocument/documentLink": {
      const patterns = providers.links?.linkPatterns;
      if (!patterns?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, patterns.map(convertDocumentLink));
      break;
    }

    // ── textDocument/documentColor → ColorInformation[] ─────────

    case "textDocument/documentColor": {
      sendResult(writer, id, []);
      break;
    }

    // ── textDocument/colorPresentation → ColorPresentation[] ────

    case "textDocument/colorPresentation": {
      const presentations = providers.color?.colorPresentations ?? [];
      sendResult(writer, id, presentations.map(convertColorPresentation));
      break;
    }

    // ── textDocument/formatting → TextEdit[] | null ─────────────

    case "textDocument/formatting": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/rangeFormatting → TextEdit[] | null ────────

    case "textDocument/rangeFormatting": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/onTypeFormatting → TextEdit[] | null ───────

    case "textDocument/onTypeFormatting": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/rename → WorkspaceEdit | null ──────────────

    case "textDocument/rename": {
      sendResult(writer, id, null);
      break;
    }

    // ── textDocument/prepareRename → PrepareRenameResult | null ─

    case "textDocument/prepareRename": {
      if (!providers.rename) { sendResult(writer, id, null); break; }
      sendResult(writer, id, { defaultBehavior: true });
      break;
    }

    // ── textDocument/foldingRange → FoldingRange[] | null ───────

    case "textDocument/foldingRange": {
      const rules = providers.foldingRange?.foldingRules;
      if (!rules?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, rules.map(convertFoldingRange));
      break;
    }

    // ── textDocument/selectionRange → SelectionRange[] | null ───

    case "textDocument/selectionRange": {
      const sr = providers.selectionRange?.selectionRanges;
      if (!sr) { sendResult(writer, id, null); break; }
      const chain = buildSelectionRangeChain(sr.expansionHierarchy);
      sendResult(writer, id, chain ? [chain] : null);
      break;
    }

    // ── textDocument/linkedEditingRange → LinkedEditingRanges | null

    case "textDocument/linkedEditingRange": {
      const ler = providers.linkedEditingRange;
      if (!ler?.supported) { sendResult(writer, id, null); break; }
      const result: LspLinkedEditingRanges = { ranges: [], wordPattern: ler.wordPattern };
      sendResult(writer, id, result);
      break;
    }

    // ── textDocument/inlayHint → InlayHint[] | null ─────────────

    case "textDocument/inlayHint": {
      const patterns = providers.inlayHints?.inlayHintPatterns;
      if (!patterns?.length) { sendResult(writer, id, null); break; }
      sendResult(writer, id, patterns.map(convertInlayHint));
      break;
    }

    // ── textDocument/inlineCompletion → InlineCompletionList | null

    case "textDocument/inlineCompletion": {
      const data = providers.inlineCompletions;
      if (!data) { sendResult(writer, id, null); break; }
      sendResult(writer, id, convertInlineCompletionList(data));
      break;
    }

    // ── textDocument/semanticTokens/full → SemanticTokens | null ─

    case "textDocument/semanticTokens/full": {
      if (!providers.semanticTokens) { sendResult(writer, id, null); break; }
      const result: LspSemanticTokens = { data: [] };
      sendResult(writer, id, result);
      break;
    }

    // ── textDocument/semanticTokens/range → SemanticTokens | null

    case "textDocument/semanticTokens/range": {
      if (!providers.rangeSemanticTokens) { sendResult(writer, id, null); break; }
      const result: LspSemanticTokens = { data: [] };
      sendResult(writer, id, result);
      break;
    }

    // ═════════════════════════════════════════════════════════════
    // Custom methods — Monaco-specific / context-engine extensions
    // ═════════════════════════════════════════════════════════════

    // ── textDocument/monarchTokens (Monaco IMonarchLanguage) ────

    case "textDocument/monarchTokens": {
      const mt = providers.monarchTokens;
      if (!mt) { sendResult(writer, id, null); break; }
      sendResult(writer, id, {
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
      break;
    }

    // ── textDocument/newSymbolNames (rename suggestions) ────────

    case "textDocument/newSymbolNames": {
      const ns = providers.newSymbolNames;
      if (!ns) { sendResult(writer, id, null); break; }
      const word = extractWord(params);
      const matchingRules = ns.renameSuggestionRules.filter((r) => {
        try { return new RegExp(r.pattern).test(word); }
        catch { return false; }
      });
      sendResult(writer, id, {
        triggerKinds: ns.triggerKinds,
        tags: ns.tags,
        symbolKinds: ns.symbolKinds,
        namingConventions: ns.namingConventions,
        suggestions: matchingRules.flatMap((r) =>
          r.suggestedNames.map((s) => ({ newSymbolName: s.newSymbolName, tags: s.tags })),
        ),
        reservedWords: ns.reservedWords,
        identifierRules: ns.identifierRules,
      });
      break;
    }

    // ── textDocument/multiDocumentHighlight ──────────────────────

    case "textDocument/multiDocumentHighlight": {
      const mdh = providers.multiDocumentHighlight;
      if (!mdh) { sendResult(writer, id, null); break; }
      sendResult(writer, id, {
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
      break;
    }

    // ═════════════════════════════════════════════════════════════
    // context/* — raw provider data (for clients needing full schema)
    // ═════════════════════════════════════════════════════════════

    case "context/languageData": {
      sendResult(writer, id, loadLanguageData(connectionId, languageId));
      break;
    }

    case "context/listLanguages": {
      sendResult(writer, id, listLanguages());
      break;
    }

    case "context/references":          { sendResult(writer, id, providers.references ?? null); break; }
    case "context/implementation":      { sendResult(writer, id, providers.implementation ?? null); break; }
    case "context/formatting":          { sendResult(writer, id, providers.formatting ?? null); break; }
    case "context/rangeFormatting":      { sendResult(writer, id, providers.documentRangeFormatting ?? null); break; }
    case "context/onTypeFormatting":     { sendResult(writer, id, providers.onTypeFormatting ?? null); break; }
    case "context/rename":              { sendResult(writer, id, providers.rename ?? null); break; }
    case "context/foldingRange":        { sendResult(writer, id, providers.foldingRange ?? null); break; }
    case "context/selectionRange":      { sendResult(writer, id, providers.selectionRange ?? null); break; }
    case "context/color":               { sendResult(writer, id, providers.color ?? null); break; }
    case "context/semanticTokens":      { sendResult(writer, id, providers.semanticTokens ?? null); break; }
    case "context/rangeSemanticTokens": { sendResult(writer, id, providers.rangeSemanticTokens ?? null); break; }

    default: {
      sendError(writer, id, -32601, `Method not found: ${method}`);
    }
  }
}

// ── Notification handler ────────────────────────────────────────────
export function handleNotification(
  message: JsonRpcNotification,
  languageId: string,
  providers: LanguageProviders,
  writer: JsonRpcWriter
): void {
  const { method, params } = message;

  switch (method) {
    case "initialized":
      console.log(`[${languageId}] client initialized`);
      break;

    case "textDocument/didOpen": {
      const uri = params?.textDocument?.uri;
      const text = params?.textDocument?.text;
      console.log(`[${languageId}] didOpen: ${uri}`);
      if (uri && text) {
        publishDiagnostics(uri, text, providers, writer);
      }
      break;
    }

    case "textDocument/didChange": {
      const uri = params?.textDocument?.uri;
      const changes = params?.contentChanges;
      const text = changes?.[changes.length - 1]?.text;
      if (uri && text) {
        publishDiagnostics(uri, text, providers, writer);
      }
      break;
    }

    case "textDocument/didClose": {
      const uri = params?.textDocument?.uri;
      console.log(`[${languageId}] didClose: ${uri}`);
      if (uri) {
        const payload: LspPublishDiagnosticsParams = { uri, diagnostics: [] };
        sendNotification(writer, "textDocument/publishDiagnostics", payload);
      }
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
  providers: LanguageProviders,
  writer: JsonRpcWriter
): void {
  const diagnostics: LspDiagnostic[] = buildDiagnosticsFromText(text, providers.codeActions?.codeActions ?? []);

  const payload: LspPublishDiagnosticsParams = { uri, diagnostics };
  sendNotification(writer, "textDocument/publishDiagnostics", payload);
}
