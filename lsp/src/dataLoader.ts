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
  "commands",
] as const;

// ── Language aliases ─────────────────────────────────────────────────
// Normalizes common alternative IDs to the canonical manifest ID.
const LANGUAGE_ALIASES: Record<string, string> = {
  shellscript: "shell",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  zshell: "shell",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  ts: "typescript",
  js: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  md: "markdown",
  yml: "yaml",
  tf: "hcl",
  proto: "protobuf",
  objc: "objective-c",
};

function resolveLanguageId(id: string): string {
  const lower = id.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

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
  const resolved = resolveLanguageId(languageId);
  const connCache = connectionCaches.get(connectionId);
  if (connCache?.has(resolved)) return connCache.get(resolved)!;

  const entry = languageIndex.get(resolved);
  if (!entry) return null;

  const data: LanguageData = { language: resolved, providers: {} };

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

  connCache?.set(resolved, data);
  return data;
}

export function hasLanguage(id: string): boolean {
  return languageIndex.has(resolveLanguageId(id));
}

export function listLanguages(): string[] {
  return [...languageIndex.keys()];
}

export { resolveLanguageId };
