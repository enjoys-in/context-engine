import type { WebSocketMessageWriter } from "vscode-ws-jsonrpc";
import type { JsonRpcRequest, JsonRpcNotification } from "./types.ts";
import { loadLanguageData, listLanguages } from "./dataLoader.ts";

// ── JSON-RPC helpers ────────────────────────────────────────────────
function sendResult(writer: WebSocketMessageWriter, id: number | string, result: any): void {
  writer.write({ jsonrpc: "2.0", id, result } as any);
}

function sendError(
  writer: WebSocketMessageWriter,
  id: number | string,
  code: number,
  message: string
): void {
  writer.write({ jsonrpc: "2.0", id, error: { code, message } } as any);
}

function sendNotification(writer: WebSocketMessageWriter, method: string, params: any): void {
  writer.write({ jsonrpc: "2.0", method, params } as any);
}

function extractWord(params: any): string {
  if (params?.context?.word) return params.context.word;
  if (params?.word) return params.word;
  return "";
}

// ── Request handler ─────────────────────────────────────────────────
export function handleRequest(
  message: JsonRpcRequest,
  connectionId: string,
  languageId: string,
  providers: Record<string, any>,
  capabilities: Record<string, any>,
  writer: WebSocketMessageWriter
): void {
  const { id, method, params } = message;

  switch (method) {
    case "initialize": {
      sendResult(writer, id, {
        capabilities,
        serverInfo: { name: "context-engine-lsp", version: "1.4.0" },
      });
      break;
    }

    case "shutdown": {
      sendResult(writer, id, null);
      break;
    }

    case "textDocument/completion": {
      const completions = providers.completion?.completions ?? [];
      sendResult(writer, id, { isIncomplete: false, items: completions });
      break;
    }

    case "textDocument/hover": {
      const word = extractWord(params);
      const entry = providers.hover?.hovers?.[word] ?? null;
      sendResult(writer, id, entry);
      break;
    }

    case "textDocument/signatureHelp": {
      const sh = providers.signatureHelp;
      sendResult(writer, id, {
        signatures: sh?.signatures ?? [],
        activeSignature: 0,
        activeParameter: 0,
        triggerCharacters: sh?.triggerCharacters ?? [],
        retriggerCharacters: sh?.retriggerCharacters ?? [],
      });
      break;
    }

    case "textDocument/definition": {
      const word = extractWord(params);
      sendResult(writer, id, providers.definition?.definitions?.[word] ?? null);
      break;
    }

    case "textDocument/declaration": {
      const word = extractWord(params);
      sendResult(writer, id, providers.declaration?.declarations?.[word] ?? null);
      break;
    }

    case "textDocument/typeDefinition": {
      const word = extractWord(params);
      sendResult(writer, id, providers.typeDefinition?.typeDefinitions?.[word] ?? null);
      break;
    }

    case "textDocument/implementation": {
      const impl = providers.implementation;
      sendResult(writer, id, {
        implementationPatterns: impl?.implementationPatterns ?? [],
        keywords: impl?.keywords ?? null,
      });
      break;
    }

    case "textDocument/references": {
      sendResult(writer, id, providers.references?.referencePatterns ?? []);
      break;
    }

    case "textDocument/documentHighlight": {
      sendResult(writer, id, providers.documentHighlight?.highlights ?? {});
      break;
    }

    case "textDocument/documentSymbol": {
      sendResult(writer, id, providers.documentSymbol?.symbolPatterns ?? []);
      break;
    }

    case "textDocument/codeAction": {
      const ca = providers.codeActions;
      sendResult(writer, id, {
        codeActions: ca?.codeActions ?? [],
        providedCodeActionKinds: ca?.providedCodeActionKinds ?? [],
      });
      break;
    }

    case "textDocument/codeLens": {
      sendResult(writer, id, providers.codeLens?.codeLensPatterns ?? []);
      break;
    }

    case "textDocument/documentLink": {
      sendResult(writer, id, providers.links?.linkPatterns ?? []);
      break;
    }

    case "textDocument/documentColor": {
      const color = providers.color;
      sendResult(writer, id, {
        colorPatterns: color?.colorPatterns ?? [],
        colorPresentations: color?.colorPresentations ?? [],
        namedColors: color?.namedColors ?? {},
      });
      break;
    }

    case "textDocument/formatting": {

      sendResult(writer, id, providers.formatting?.formatting ?? []);
      break;
    }

    case "textDocument/rangeFormatting": {
      const rf = providers.documentRangeFormatting;
      sendResult(writer, id, {
        defaultOptions: rf?.defaultOptions ?? null,
        rangeFormattingRules: rf?.rangeFormattingRules ?? [],
        adjustToSyntaxNode: rf?.adjustToSyntaxNode ?? false,
        supportedRangeTypes: rf?.supportedRangeTypes ?? [],
      });
      break;
    }

    case "textDocument/onTypeFormatting": {
      const otf = providers.onTypeFormatting;
      sendResult(writer, id, {
        autoFormatTriggerCharacters: otf?.autoFormatTriggerCharacters ?? [],
        formatRules: otf?.formatRules ?? [],
        indentation: otf?.indentation ?? null,
      });
      break;
    }

    case "textDocument/rename": {
      const rn = providers.rename;
      sendResult(writer, id, {
        wordPattern: rn?.wordPattern ?? null,
        identifierRules: rn?.identifierRules ?? null,
        renameValidation: rn?.renameValidation ?? null,
        prepareRenamePatterns: rn?.prepareRenamePatterns ?? [],
      });
      break;
    }

    case "textDocument/foldingRange": {
      sendResult(writer, id, {
        offSide: providers.foldingRange?.offSide ?? false,
        markers: providers.foldingRange?.markers ?? null,
        foldingRules: providers.foldingRange?.foldingRules ?? [],
      });
      break;
    }

    case "textDocument/selectionRange": {
      sendResult(writer, id, providers.selectionRange?.selectionRanges ?? null);
      break;
    }

    case "textDocument/linkedEditingRange": {
      sendResult(writer, id, {
        wordPattern: providers.linkedEditingRange?.wordPattern ?? null,
        linkedEditingPatterns: providers.linkedEditingRange?.linkedEditingPatterns ?? [],
        supported: providers.linkedEditingRange?.supported ?? false,
      });
      break;
    }

    case "textDocument/inlayHint": {
      const ih = providers.inlayHints;
      sendResult(writer, id, {
        inlayHintPatterns: ih?.inlayHintPatterns ?? [],
        typeInferenceRules: ih?.typeInferenceRules ?? {},
      });
      break;
    }

    case "textDocument/inlineCompletion": {
      sendResult(writer, id, { items: providers.inlineCompletions?.inlineCompletions ?? [] });
      break;
    }

    case "textDocument/semanticTokens/full": {
      const st = providers.semanticTokens;
      sendResult(writer, id, {
        tokenTypes: st?.tokenTypes ?? [],
        tokenModifiers: st?.tokenModifiers ?? [],
        tokenLegend: st?.tokenLegend ?? null,
        semanticRules: st?.semanticRules ?? [],
      });
      break;
    }

    case "textDocument/semanticTokens/range": {
      const rst = providers.rangeSemanticTokens;
      sendResult(writer, id, {
        tokenTypes: rst?.tokenTypes ?? [],
        tokenModifiers: rst?.tokenModifiers ?? [],
        tokenLegend: rst?.tokenLegend ?? null,
        rangeTokenRules: rst?.rangeTokenRules ?? [],
      });
      break;
    }

    // ── Custom methods ────────────────────────────────────────────
    case "context/languageData": {
      sendResult(writer, id, loadLanguageData(connectionId, languageId));
      break;
    }

    case "context/listLanguages": {
      sendResult(writer, id, listLanguages());
      break;
    }

    default: {
      sendError(writer, id, -32601, `Method not found: ${method}`);
    }
  }
}

// ── Notification handler ────────────────────────────────────────────
export function handleNotification(
  message: JsonRpcNotification,
  languageId: string,
  providers: Record<string, any>,
  writer: WebSocketMessageWriter
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
      // Clear diagnostics on close
      if (uri) {
        sendNotification(writer, "textDocument/publishDiagnostics", {
          uri,
          diagnostics: [],
        });
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
  providers: Record<string, any>,
  writer: WebSocketMessageWriter
): void {
  const diagnostics: any[] = [];
  const actions = providers.codeActions?.codeActions;

  if (Array.isArray(actions)) {
    const lines = text.split("\n");
    for (const action of actions) {
      // Only emit diagnostics for actions explicitly marked as diagnostic
      if (!action.diagnostic || !action.pattern) continue;
      try {
        const regex = new RegExp(action.pattern, action.flags || "g");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          let match: RegExpExecArray | null;
          regex.lastIndex = 0;
          while ((match = regex.exec(line)) !== null) {
            diagnostics.push({
              range: {
                start: { line: i, character: match.index },
                end: { line: i, character: match.index + match[0].length },
              },
              severity: action.severity ?? 2, // Warning
              source: "context-engine",
              message: action.title || action.description || "Issue detected",
            });
          }
        }
      } catch {
        // invalid regex in data — skip
      }
    }
  }

  sendNotification(writer, "textDocument/publishDiagnostics", {
    uri,
    diagnostics,
  });
}
