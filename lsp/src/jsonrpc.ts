import type { WebSocket } from "ws";

// ── JSON-RPC message shape ──────────────────────────────────────────
export interface JsonRpcMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── Writer: serialises JSON-RPC messages and sends over WS ──────────
export interface JsonRpcWriter {
  write(message: JsonRpcMessage): void;
  dispose(): void;
}

export function createWriter(ws: WebSocket): JsonRpcWriter {
  let disposed = false;
  return {
    write(message) {
      if (disposed || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify(message));
    },
    dispose() {
      disposed = true;
    },
  };
}

// ── Reader: parses incoming WS data as JSON-RPC and dispatches ──────
export interface JsonRpcReader {
  listen(callback: (message: JsonRpcMessage) => void): void;
  dispose(): void;
}

export function createReader(ws: WebSocket): JsonRpcReader {
  const listeners: ((msg: JsonRpcMessage) => void)[] = [];
  let disposed = false;

  const onMessage = (data: Buffer | string) => {
    if (disposed) return;
    try {
      const message = JSON.parse(String(data)) as JsonRpcMessage;
      for (const cb of listeners) cb(message);
    } catch {
      // malformed JSON — ignore
    }
  };

  ws.on("message", onMessage);

  return {
    listen(callback) {
      listeners.push(callback);
    },
    dispose() {
      disposed = true;
      listeners.length = 0;
      ws.off("message", onMessage);
    },
  };
}
