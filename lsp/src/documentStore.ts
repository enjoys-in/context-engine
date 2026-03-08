// ── Per-connection document store ───────────────────────────────────
// Tracks open document text so formatting handlers can access content.

const stores = new Map<string, Map<string, string>>();

export function createDocumentStore(connectionId: string): void {
  stores.set(connectionId, new Map());
}

export function destroyDocumentStore(connectionId: string): void {
  stores.delete(connectionId);
}

export function setDocument(connectionId: string, uri: string, text: string): void {
  stores.get(connectionId)?.set(uri, text);
}

export function getDocument(connectionId: string, uri: string): string | undefined {
  return stores.get(connectionId)?.get(uri);
}

export function removeDocument(connectionId: string, uri: string): void {
  stores.get(connectionId)?.delete(uri);
}
