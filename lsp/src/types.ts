import type { WebSocketMessageReader, WebSocketMessageWriter } from "vscode-ws-jsonrpc";

export interface IWebSocket {
  send(content: string): void;
  onMessage(cb: (data: string) => void): void;
  onError(cb: (reason: string) => void): void;
  onClose(cb: (code: number, reason: string) => void): void;
  dispose(): void;
}

export interface ManifestLanguage {
  id: string;
  name: string;
  files: Record<string, string>;
}

export interface Manifest {
  version: string;
  description: string;
  generatedAt: string;
  languages: ManifestLanguage[];
}

export interface LanguageData {
  language: string;
  providers: Record<string, any>;
}

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

export interface JsonRpcNotification {
  jsonrpc: string;
  method: string;
  params?: any;
}

export interface ConnectionContext {
  languageId: string;
  providers: Record<string, any>;
  capabilities: Record<string, any>;
  reader: WebSocketMessageReader;
  writer: WebSocketMessageWriter;
}
