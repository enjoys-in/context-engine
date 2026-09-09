import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import * as url from "node:url";
import * as crypto from "node:crypto";
import { createReader, createWriter } from "./jsonrpc.ts";
import type { JsonRpcRequest, JsonRpcNotification, ServerCapabilities } from "./types.ts";
import {
  hasLanguage,
  listLanguages,
  acquireLanguage,
  cacheStats,
  clearCache,
  stopSweeper,
  resolveLanguageId,
  type LanguageHandle,
} from "./dataLoader.ts";
import { createDocumentStore, destroyDocumentStore } from "./documentStore.ts";
import { buildCapabilities } from "./capabilities.ts";
import { handleRequest, handleNotification } from "./handlers.ts";

const PORT = parseInt(process.env.PORT || "9257", 10);

function memoryLine(): string {
  const c = cacheStats();
  const heap = (process.memoryUsage().heapUsed / 1048576).toFixed(1);
  const cached = (c.bytes / 1048576).toFixed(2);
  const langs = c.languages.map((l) => `${l.language}x${l.refs}`).join(",") || "none";
  return `heap ${heap}MB, cache ${c.entries} files/${cached}MB, langs ${langs}`;
}

const wss = new WebSocketServer({ port: PORT, path: "/lsp" }, () => {
  const c = cacheStats();
  console.log(`Context-Engine LSP WebSocket server listening on ws://127.0.0.1:${PORT}/lsp`);
  console.log(`Connect with /lsp?lang=<id>  (e.g. ws://127.0.0.1:${PORT}/lsp?lang=javascript)`);
  console.log(
    `Provider files are read on demand; cache holds <=${c.maxEntries} files / ` +
      `${(c.maxBytes / 1048576).toFixed(0)}MB and releases after ${c.ttlMs}ms idle`
  );
  console.log(`Available languages: ${listLanguages().length}`);
});

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const query = url.parse(req.url || "", true).query;
  const rawLang = typeof query.lang === "string" ? query.lang.toLowerCase() : "";
  const languageId = resolveLanguageId(rawLang);

  if (!languageId) {
    ws.close(4000, "Missing ?lang= query parameter");
    return;
  }

  if (!hasLanguage(languageId)) {
    ws.close(4001, `Unknown language: ${languageId}`);
    return;
  }

  // The handle carries only this language's provider file paths — no
  // payload is read until a request actually needs one.
  const handle = acquireLanguage(languageId);
  if (!handle) {
    ws.close(4001, `Unknown language: ${languageId}`);
    return;
  }

  const connectionId = crypto.randomUUID();
  console.log(
    `[${languageId}] client connected (${connectionId}) — ` +
      `${handle.available.size} providers available; ${memoryLine()}`
  );

  createDocumentStore(connectionId);

  const reader = createReader(ws);
  const writer = createWriter(ws);

  // Mutable so cleanup() can drop the closure's references.
  let lang: LanguageHandle | null = handle;
  let capabilities: ServerCapabilities | null = null;

  reader.listen((message) => {
    if (message.method === undefined) return;
    if (!lang) return; // connection already torn down

    // Built on first use rather than at connect time, so a client that
    // never initializes costs zero file reads.
    if (!capabilities) capabilities = buildCapabilities(lang);

    if (message.id !== undefined && message.id !== null) {
      handleRequest(
        message as JsonRpcRequest,
        connectionId,
        languageId,
        lang,
        capabilities,
        writer
      );
    } else {
      handleNotification(
        message as JsonRpcNotification,
        connectionId,
        languageId,
        lang,
        writer
      );
    }
  });

  let cleaned = false;
  const cleanup = (why: string) => {
    if (cleaned) return; // 'error' is followed by 'close' — tear down once
    cleaned = true;

    reader.dispose();
    writer.dispose();

    // This connection's own state...
    destroyDocumentStore(connectionId);

    // ...then drop the closure's references before releasing the handle,
    // so releasing actually frees rather than leaving the payload pinned
    // by these very handlers.
    const releasing = lang;
    lang = null;
    capabilities = null;
    releasing?.release();

    console.log(`[${languageId}] client disconnected (${connectionId}) — ${why}; ${memoryLine()}`);
  };

  ws.on("close", () => cleanup("close"));
  ws.on("error", (err: Error) => cleanup(`error: ${err.message}`));
});

wss.on("error", (err: Error) => console.error(`server error: ${err.message}`));

// ── Process shutdown ────────────────────────────────────────────────
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down`);

  // Closing each socket fires its 'close' handler, which runs the
  // per-connection cleanup above.
  for (const client of wss.clients) client.close(1001, "Server shutting down");

  wss.close(() => {
    stopSweeper();
    clearCache();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
