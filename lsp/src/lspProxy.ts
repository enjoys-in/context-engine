import { createServerProcess, createWebSocketConnection, forward } from "vscode-ws-jsonrpc/server";
import type { IConnection } from "vscode-ws-jsonrpc/server";
import type { IWebSocket } from "./types.ts";
import type { LanguageServerConfig } from "./languageServers.ts";

export interface ProxyConnection {
  serverConnection: IConnection;
  dispose: () => void;
}

/**
 * Spawns a real language server process and bridges all messages
 * between the WebSocket client and the server's stdio.
 *
 * Returns the proxy, or undefined if the process fails to start.
 */
export function createLspProxy(
  socket: IWebSocket,
  config: LanguageServerConfig,
  languageId: string
): ProxyConnection | undefined {
  const serverConnection = createServerProcess(
    `${languageId}-lsp`,
    config.command,
    config.args,
    { env: { ...process.env, ...config.env } }
  );

  if (!serverConnection) {
    console.error(`[${languageId}] failed to spawn ${config.command}`);
    return undefined;
  }

  const clientConnection = createWebSocketConnection(socket);

  // Bidirectional message forwarding
  forward(clientConnection, serverConnection);

  console.log(`[${languageId}] proxy started → ${config.command} ${config.args.join(" ")}`);

  return {
    serverConnection,
    dispose() {
      clientConnection.dispose();
      serverConnection.dispose();
      console.log(`[${languageId}] proxy disposed`);
    },
  };
}
