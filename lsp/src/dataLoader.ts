import * as fs from "node:fs";
import * as path from "node:path";
import type { Manifest, ManifestLanguage, LanguageData } from "./types.ts";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "..", "data");
const MANIFEST_PATH = path.join(DATA_DIR, "manifest.json");

const PROVIDERS = [
  "completion",
  "definition",
  "hover",
  "codeActions",
  "codeLens",
  "color",
  "declaration",
  "documentHighlight",
  "documentSymbol",
  "formatting",
  "implementation",
  "inlayHints",
  "inlineCompletions",
  "links",
  "references",
  "typeDefinition",
  "signatureHelp",
  "foldingRange",
  "rename",
  "selectionRange",
  "linkedEditingRange",
  "onTypeFormatting",
  "documentRangeFormatting",
  "semanticTokens",
  "rangeSemanticTokens",
] as const;

// ── Manifest index (loaded once) ────────────────────────────────────
const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

const languageIndex = new Map<string, ManifestLanguage>();
for (const lang of manifest.languages) {
  languageIndex.set(lang.id, lang);
}

// ── Per-connection cache ────────────────────────────────────────────
// Each connection gets its own cache keyed by a unique connection id,
// so data is freed when the connection closes.
const connectionCaches = new Map<string, Map<string, LanguageData>>();

export function createConnectionCache(connectionId: string): void {
  connectionCaches.set(connectionId, new Map());
}

export function destroyConnectionCache(connectionId: string): void {
  const c = connectionCaches.get(connectionId);
  if (c) {
    c.clear();
    connectionCaches.delete(connectionId);
  }
}

export function loadLanguageData(
  connectionId: string,
  languageId: string
): LanguageData | null {
  const connCache = connectionCaches.get(connectionId);
  if (connCache?.has(languageId)) return connCache.get(languageId)!;

  const entry = languageIndex.get(languageId);
  if (!entry) return null;

  const data: LanguageData = { language: languageId, providers: {} };

  for (const provider of PROVIDERS) {
    const relPath = entry.files[provider];
    if (!relPath) continue;

    const fullPath = path.join(DATA_DIR, relPath);
    try {
      data.providers[provider] = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    } catch {
      // file missing or invalid — skip
    }
  }

  connCache?.set(languageId, data);
  return data;
}

export function hasLanguage(id: string): boolean {
  return languageIndex.has(id);
}

export function listLanguages(): string[] {
  return [...languageIndex.keys()];
}
