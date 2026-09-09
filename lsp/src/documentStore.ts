// ── Per-connection document store ───────────────────────────────────
// Tracks open document text so providers can run the language's patterns
// against it. Entries are added on textDocument/didOpen + didChange,
// dropped on didClose, and the whole store is torn down when the
// connection closes.
//
// The parsed line index is cached alongside the text and rebuilt only when
// the text changes, so N providers answering against one document version
// share a single O(n) index build.

import { buildIndex, type DocumentIndex } from "./documentIndex.ts";

interface Entry {
  text: string;
  index?: DocumentIndex;
}

const stores = new Map<string, Map<string, Entry>>();

export function createDocumentStore(connectionId: string): void {
  stores.set(connectionId, new Map());
}

export function destroyDocumentStore(connectionId: string): void {
  const store = stores.get(connectionId);
  if (!store) return;
  // Clear before deleting so text and indices are released even if
  // something still holds a reference to the inner map.
  store.clear();
  stores.delete(connectionId);
}

export function setDocument(connectionId: string, uri: string, text: string): void {
  const store = stores.get(connectionId);
  if (!store) return;
  const existing = store.get(uri);
  if (existing && existing.text === text) return; // no-op change, keep the index
  // New text invalidates the index; it is rebuilt lazily on next use.
  store.set(uri, { text });
}

export function getDocument(connectionId: string, uri: string): string | undefined {
  return stores.get(connectionId)?.get(uri)?.text;
}

/**
 * Line index for an open document, built on first use and reused for every
 * later provider request against the same text.
 */
export function getIndex(connectionId: string, uri: string): DocumentIndex | undefined {
  const entry = stores.get(connectionId)?.get(uri);
  if (!entry) return undefined;
  if (!entry.index) entry.index = buildIndex(entry.text);
  return entry.index;
}

export function removeDocument(connectionId: string, uri: string): void {
  stores.get(connectionId)?.delete(uri);
}

/** Number of documents currently held open for a connection. */
export function documentCount(connectionId: string): number {
  return stores.get(connectionId)?.size ?? 0;
}

/** Total documents held across all connections. Diagnostics only. */
export function totalDocumentCount(): number {
  let total = 0;
  for (const store of stores.values()) total += store.size;
  return total;
}
