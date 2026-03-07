import { WebSocketServer, type WebSocket } from "ws";
import * as url from "node:url";
import * as crypto from "node:crypto";
import { WebSocketMessageReader, WebSocketMessageWriter } from "vscode-ws-jsonrpc";
import type { IWebSocket, JsonRpcRequest, JsonRpcNotification } from "./types.ts";
import {
  hasLanguage,
  listLanguages,
  loadLanguageData,
  createConnectionCache,
  destroyConnectionCache,
} from "./dataLoader.ts";
import { buildCapabilities } from "./capabilities.ts";
import { handleRequest, handleNotification } from "./handlers.ts";

const PORT = parseInt(process.env.PORT || "9257", 10);

function wrapSocket(ws: WebSocket): IWebSocket {
  return {
    send: (content) => ws.send(content),
    onMessage: (cb) => ws.on("message", (data) => cb(String(data))),
    onError: (cb) => ws.on("error", (e) => cb(e.message ?? String(e))),
    onClose: (cb) => ws.on("close", (code, reason) => cb(code, String(reason))),
    dispose: () => ws.close(),
  }; 
}

const wss = new WebSocketServer({ port: PORT, path: "/lsp" }, () => {
  console.log(`Context-Engine LSP WebSocket server listening on ws://127.0.0.1:${PORT}/lsp`);
  console.log(`Connect with /lsp?lang=<id>  (e.g. ws://127.0.0.1:${PORT}/lsp?lang=javascript)`);
  console.log(`Available languages: ${listLanguages().join(", ")}`);
});

wss.on("connection", (ws, req) => {
  const query = url.parse(req.url || "", true).query;
  const languageId =
    typeof query.lang === "string" ? query.lang.toLowerCase() : "";

  if (!languageId) {
    ws.close(4000, "Missing ?lang= query parameter");
    return;
  }

  if (!hasLanguage(languageId)) {
    ws.close(4001, `Unknown language: ${languageId}`);
    return;
  }

  const connectionId = crypto.randomUUID();
  console.log(`[${languageId}] client connected (${connectionId})`);

  // Allocate per-connection cache
  createConnectionCache(connectionId);

  const socket = wrapSocket(ws);
  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);

  const langData = loadLanguageData(connectionId, languageId);
  const providers = langData?.providers ?? {};
  const capabilities = buildCapabilities(providers);

  reader.listen((message: any) => {
    if (message.method !== undefined) {
      if (message.id !== undefined && message.id !== null) {
        handleRequest(
          message as JsonRpcRequest,
          connectionId,
          languageId,
          providers,
          capabilities,
          writer
        );
      } else {
        handleNotification(message as JsonRpcNotification, languageId);
      }
    }
  });

  ws.on("close", () => {
    console.log(`[${languageId}] client disconnected (${connectionId})`);
    reader.dispose();
    writer.dispose();
    destroyConnectionCache(connectionId);
  });
});
