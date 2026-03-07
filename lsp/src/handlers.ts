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
      const sigs = providers.signatureHelp?.signatures ?? [];
      sendResult(writer, id, { signatures: sigs, activeSignature: 0, activeParameter: 0 });
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
      sendResult(writer, id, providers.implementation?.implementations ?? []);
      break;
    }

    case "textDocument/references": {
      sendResult(writer, id, providers.references?.references ?? []);
      break;
    }

    case "textDocument/documentHighlight": {
      sendResult(writer, id, providers.documentHighlight?.highlights ?? []);
      break;
    }

    case "textDocument/documentSymbol": {
      sendResult(writer, id, providers.documentSymbol?.symbolPatterns ?? []);
      break;
    }

    case "textDocument/codeAction": {
      sendResult(writer, id, providers.codeActions?.actions ?? []);
      break;
    }

    case "textDocument/codeLens": {
      sendResult(writer, id, providers.codeLens?.lenses ?? []);
      break;
    }

    case "textDocument/documentLink": {
      sendResult(writer, id, providers.links?.links ?? []);
      break;
    }

    case "textDocument/documentColor": {
      sendResult(writer, id, providers.color?.colors ?? []);
      break;
    }

    case "textDocument/formatting": {
      sendResult(writer, id, providers.formatting?.edits ?? []);
      break;
    }

    case "textDocument/rangeFormatting": {
      sendResult(writer, id, providers.documentRangeFormatting?.edits ?? []);
      break;
    }

    case "textDocument/onTypeFormatting": {
      sendResult(writer, id, providers.onTypeFormatting?.edits ?? []);
      break;
    }

    case "textDocument/rename": {
      sendResult(writer, id, providers.rename?.edits ?? null);
      break;
    }

    case "textDocument/foldingRange": {
      sendResult(writer, id, providers.foldingRange?.ranges ?? []);
      break;
    }

    case "textDocument/selectionRange": {
      sendResult(writer, id, providers.selectionRange?.ranges ?? []);
      break;
    }

    case "textDocument/linkedEditingRange": {
      sendResult(writer, id, providers.linkedEditingRange?.ranges ?? null);
      break;
    }

    case "textDocument/inlayHint": {
      sendResult(writer, id, providers.inlayHints?.hints ?? []);
      break;
    }

    case "textDocument/inlineCompletion": {
      sendResult(writer, id, { items: providers.inlineCompletions?.items ?? [] });
      break;
    }

    case "textDocument/semanticTokens/full": {
      sendResult(writer, id, { data: providers.semanticTokens?.data ?? [] });
      break;
    }

    case "textDocument/semanticTokens/range": {
      sendResult(writer, id, { data: providers.rangeSemanticTokens?.data ?? [] });
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
