import { WebSocketServer } from "ws";
import * as url from "node:url";
import * as crypto from "node:crypto";
import { createReader, createWriter } from "./jsonrpc.ts";
import type { JsonRpcRequest, JsonRpcNotification, LanguageProviders, ServerCapabilities } from "./types.ts";
import {
  hasLanguage,
  listLanguages,
  loadLanguageData,
  createConnectionCache,
  destroyConnectionCache,
  resolveLanguageId,
} from "./dataLoader.ts";
import { buildCapabilities } from "./capabilities.ts";
import { handleRequest, handleNotification } from "./handlers.ts";

const PORT = parseInt(process.env.PORT || "9257", 10);

const wss = new WebSocketServer({ port: PORT, path: "/lsp" }, () => {
  console.log(`Context-Engine LSP WebSocket server listening on ws://127.0.0.1:${PORT}/lsp`);
  console.log(`Connect with /lsp?lang=<id>  (e.g. ws://127.0.0.1:${PORT}/lsp?lang=javascript)`);
  console.log(`Available languages: ${listLanguages().join(", ")}`);
});

wss.on("connection", (ws, req) => {
  const query = url.parse(req.url || "", true).query;
  const rawLang =
    typeof query.lang === "string" ? query.lang.toLowerCase() : "";
  const languageId = resolveLanguageId(rawLang);

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

  createConnectionCache(connectionId);

  const reader = createReader(ws);
  const writer = createWriter(ws);

  const langData = loadLanguageData(connectionId, languageId);
  const providers: LanguageProviders = langData?.providers ?? {};
  const capabilities: ServerCapabilities = buildCapabilities(providers);

  reader.listen((message) => {
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
        handleNotification(message as JsonRpcNotification, languageId, providers, writer);
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
