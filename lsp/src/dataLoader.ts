import * as fs from "node:fs";
import * as path from "node:path";
import type { Manifest, LanguageProviders, LanguageData } from "./types.ts";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "..", "data");
const MANIFEST_PATH = path.join(DATA_DIR, "manifest.json");

/** Every provider folder name — also the keys of `LanguageProviders`. */
export type ProviderName = keyof LanguageProviders;

const PROVIDERS: readonly ProviderName[] = [
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
  "languageConfiguration",
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
  "monarchTokens",
  "newSymbolNames",
  "multiDocumentHighlight",
];

// ── Tuning (env-overridable) ─────────────────────────────────────────
// The cache exists only to avoid re-reading the same file on back-to-back
// keystrokes. It is deliberately small: the parsed payload for one
// provider is dropped as soon as it is idle or the budget is exceeded.
const CACHE_MAX_BYTES = Number(process.env.CE_LSP_CACHE_MAX_BYTES ?? 16 * 1024 * 1024);
const CACHE_MAX_ENTRIES = Number(process.env.CE_LSP_CACHE_MAX_ENTRIES ?? 24);
const CACHE_TTL_MS = Number(process.env.CE_LSP_CACHE_TTL_MS ?? 60_000);

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

export function resolveLanguageId(id: string): string {
  const lower = id.toLowerCase();
  return Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, lower)
    ? LANGUAGE_ALIASES[lower]!
    : lower;
}

// ── Path index ───────────────────────────────────────────────────────
// The ONLY thing held for the process lifetime: for each language, the
// absolute path of each provider's JSON file. Resolved once at startup so
// a request can read its file immediately, with no manifest lookup or
// path work on the hot path. Strings only — no provider payload.
const pathIndex = new Map<string, Map<ProviderName, string>>();

/**
 * Per-language set of available providers, built once at startup and
 * shared by every handle for that language. Acquiring a connection is
 * then O(1) instead of rebuilding a 30-element Set each time.
 */
const availableIndex = new Map<string, ReadonlySet<ProviderName>>();

/** Direct `extends` parent per language, before chain resolution. */
const parentOf = new Map<string, string | undefined>();

/** Frozen language list, built once — `listLanguages()` is O(1). */
let LANGUAGE_IDS: readonly string[] = [];

/**
 * Resolved inheritance chain per language, base-last.
 * `typescript` -> ["typescript", "javascript"].
 *
 * Overlay languages (typescript, angular, scss, ...) are authored as layers
 * on a base and share almost none of its symbols — measured label overlap
 * was 0-15%. Serving them flat lost the base entirely, so a TypeScript file
 * saw no `console`, no `Promise`, no keywords. Resolved once at startup so a
 * request never walks the chain.
 */
const chainIndex = new Map<string, readonly string[]>();

{
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  for (const lang of manifest.languages) {
    const paths = new Map<ProviderName, string>();
    for (const provider of PROVIDERS) {
      const rel = lang.files[provider];
      if (rel) paths.set(provider, path.join(DATA_DIR, rel));
    }
    pathIndex.set(lang.id, paths);
    parentOf.set(lang.id, typeof lang.extends === "string" ? lang.extends : undefined);
  }

  // Resolve each chain once, stopping on an unknown or repeated id so a bad
  // manifest cannot produce an infinite walk.
  for (const id of pathIndex.keys()) {
    const chain: string[] = [];
    const seen = new Set<string>();
    for (let cur: string | undefined = id; cur && pathIndex.has(cur) && !seen.has(cur); cur = parentOf.get(cur)) {
      seen.add(cur);
      chain.push(cur);
    }
    chainIndex.set(id, Object.freeze(chain));

    // A language offers a provider if it, or anything it inherits from, has one.
    const available = new Set<ProviderName>();
    for (const link of chain) {
      const paths = pathIndex.get(link);
      if (paths) for (const provider of paths.keys()) available.add(provider);
    }
    availableIndex.set(id, available);
  }

  LANGUAGE_IDS = Object.freeze([...pathIndex.keys()]);
  // `manifest` goes out of scope here; only the path strings are retained.
}

// ── Bounded payload cache ────────────────────────────────────────────
// Keyed "<language>:<provider>". Map iteration order is insertion order,
// which gives LRU for free: re-insert on hit, evict from the front.
interface CacheSlot {
  value: unknown;
  bytes: number;
  lastUsed: number;
  language: string;
}

const payloadCache = new Map<string, CacheSlot>();
let cachedBytes = 0;

/**
 * language -> the cache keys it owns (raw payloads and derived views).
 * Lets `release()` drop exactly what a language actually loaded in
 * O(keys-it-loaded) instead of probing all 30 provider slots.
 */
const keysByLanguage = new Map<string, Set<string>>();

function payloadKey(languageId: string, provider: ProviderName): string {
  return `${languageId}:${provider}`;
}

function viewKeyOf(languageId: string, view: string): string {
  return `${languageId}:@:${view}`;
}

function store(key: string, language: string, value: unknown, bytes: number): void {
  payloadCache.set(key, { value, bytes, lastUsed: Date.now(), language });
  cachedBytes += bytes;

  let keys = keysByLanguage.get(language);
  if (!keys) {
    keys = new Set();
    keysByLanguage.set(language, keys);
  }
  keys.add(key);

  enforceBudget();
}

/** Move a hit to the MRU end of the Map's iteration order. O(1). */
function touch(key: string, slot: CacheSlot): void {
  slot.lastUsed = Date.now();
  payloadCache.delete(key);
  payloadCache.set(key, slot);
}

function evict(key: string): void {
  const slot = payloadCache.get(key);
  if (!slot) return;
  cachedBytes -= slot.bytes;
  slot.value = undefined; // release the parsed object immediately
  payloadCache.delete(key);

  const keys = keysByLanguage.get(slot.language);
  if (keys) {
    keys.delete(key);
    if (keys.size === 0) keysByLanguage.delete(slot.language);
  }
}

/** Evict oldest entries until both the entry and byte budgets are met. */
function enforceBudget(): void {
  for (const key of payloadCache.keys()) {
    if (payloadCache.size <= CACHE_MAX_ENTRIES && cachedBytes <= CACHE_MAX_BYTES) return;
    evict(key);
  }
}

/** Evict everything not touched within the TTL. */
export function sweepIdle(now = Date.now()): number {
  let swept = 0;
  for (const [key, slot] of payloadCache) {
    if (now - slot.lastUsed >= CACHE_TTL_MS) {
      evict(key);
      swept++;
    }
  }
  return swept;
}

// Idle sweeper. unref'd so it never keeps the process alive on its own.
const sweeper = setInterval(() => sweepIdle(), Math.max(1000, Math.floor(CACHE_TTL_MS / 2)));
sweeper.unref?.();

/**
 * Read one provider's JSON for a language. Served from the small cache
 * when warm, otherwise read from the pre-resolved path immediately.
 * Returns undefined when this language has no file for that provider.
 */
export function readProvider<K extends ProviderName>(
  languageId: string,
  provider: K
): LanguageProviders[K] | undefined {
  return readResolved(resolveLanguageId(languageId), provider);
}

/**
 * Merge a base provider payload under an overlay's.
 *
 * Arrays concatenate overlay-first so the overlay's entries rank ahead of
 * the base's; entries are de-duplicated on the field that identifies them
 * (a completion `label`, a hover key, a pattern) so a symbol the overlay
 * redefines does not appear twice. Objects merge key-wise with the overlay
 * winning. Scalars take the overlay's value.
 */
function identityOf(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const label = o["label"];
  if (typeof label === "string") return "l:" + label;
  if (label && typeof label === "object") {
    const inner = (label as Record<string, unknown>)["label"];
    if (typeof inner === "string") return "l:" + inner;
  }
  for (const k of ["symbol", "name", "pattern", "startPattern", "openPattern", "commandId", "title", "tokenType"]) {
    const x = o[k];
    if (typeof x === "string") return k + ":" + x;
  }
  return undefined;
}

function mergeProviderData(base: unknown, overlay: unknown): unknown {
  if (base === undefined || base === null) return overlay;
  if (overlay === undefined || overlay === null) return base;

  if (Array.isArray(base) && Array.isArray(overlay)) {
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const v of [...overlay, ...base]) {
      const id = identityOf(v);
      if (id !== undefined) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(v);
    }
    return out;
  }

  const bothObjects =
    typeof base === "object" && typeof overlay === "object" &&
    !Array.isArray(base) && !Array.isArray(overlay);

  if (bothObjects) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(overlay as Record<string, unknown>)) {
      out[k] = k in out ? mergeProviderData(out[k], v) : v;
    }
    return out;
  }

  return overlay; // scalar, or a type change between layers
}

/**
 * Read a provider for a language, merging in whatever it inherits.
 *
 * For a language with no `extends` this is a single file read. For an
 * overlay the merged result is memoized in the same cache as raw payloads,
 * so the merge runs once and is evicted with everything else.
 */
function readResolved<K extends ProviderName>(
  resolved: string,
  provider: K
): LanguageProviders[K] | undefined {
  const chain = chainIndex.get(resolved);
  if (!chain || chain.length <= 1) return readOwn(resolved, provider);

  const key = viewKeyOf(resolved, `merged:${provider}`);
  const hit = payloadCache.get(key);
  if (hit) {
    touch(key, hit);
    return hit.value as LanguageProviders[K];
  }

  // Walk base-first so each overlay merges on top of what it inherits.
  //
  // Layers are read with populate=false: caching a base payload under the
  // base's own name would attribute it to a language that may have no live
  // handle, so release() could not reclaim it. Only the merged view is
  // cached, owned by the language that asked for it.
  let merged: unknown;
  let bytes = 0;
  for (let i = chain.length - 1; i >= 0; i--) {
    const layer = loadOwn(chain[i]!, provider, false);
    if (!layer) continue;
    bytes += layer.bytes;
    merged = merged === undefined ? layer.value : mergeProviderData(merged, layer.value);
  }
  if (merged === undefined) return undefined;

  store(key, resolved, merged, bytes);
  return merged as LanguageProviders[K];
}

/** Read one language's own file for a provider, with no inheritance. */
function readOwn<K extends ProviderName>(
  resolved: string,
  provider: K
): LanguageProviders[K] | undefined {
  return loadOwn(resolved, provider, true)?.value as LanguageProviders[K] | undefined;
}

/**
 * Load one language's own provider file.
 *
 * A cached payload is always reused. `populate` controls whether a fresh
 * read is *stored*: direct reads cache, merge-layer reads do not (see
 * readResolved).
 */
function loadOwn(
  resolved: string,
  provider: ProviderName,
  populate: boolean
): { value: unknown; bytes: number } | undefined {
  const key = payloadKey(resolved, provider);
  const hit = payloadCache.get(key);
  if (hit) {
    touch(key, hit);
    return { value: hit.value, bytes: hit.bytes };
  }

  const filePath = pathIndex.get(resolved)?.get(provider);
  if (!filePath) return undefined;

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined; // file missing
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined; // invalid JSON
  }

  if (populate) store(key, resolved, value, raw.length);
  return { value, bytes: raw.length };
}

// ── Language handles ─────────────────────────────────────────────────
// A connection holds a handle, not a payload. The handle knows which
// providers exist (from the path index, no I/O) and reads them on demand.

export interface LanguageHandle {
  readonly languageId: string;
  /** Providers this language has a file for. Derived from paths — no I/O. */
  readonly available: ReadonlySet<ProviderName>;
  /** True if a file exists for this provider. No I/O. */
  has(provider: ProviderName): boolean;
  /** Read a provider's data now. Undefined if absent or unreadable. */
  get<K extends ProviderName>(provider: K): LanguageProviders[K] | undefined;
  /**
   * Memoized derived view of one provider — e.g. the LSP-shaped payload
   * converted from the raw data, or a set of precompiled regexes.
   *
   * The source data is immutable for the life of the file, so the factory
   * runs once and every later request is an O(1) cache hit instead of
   * re-converting the whole list. Derived values are evicted alongside the
   * provider they came from, so they never outlive their source.
   */
  derive<K extends ProviderName, T>(
    view: string,
    provider: K,
    factory: (data: NonNullable<LanguageProviders[K]>) => T
  ): T | undefined;
  /** Read every available provider. Only for the bulk context/* request. */
  all(): LanguageData;
  /** Release this handle. Idempotent. */
  release(): void;
}

/** How many live handles reference each language. */
const refs = new Map<string, number>();

export function acquireLanguage(languageId: string): LanguageHandle | null {
  const resolved = resolveLanguageId(languageId);
  // Precomputed at startup and shared — acquiring is O(1), not O(providers).
  const available = availableIndex.get(resolved);
  if (!available) return null;

  refs.set(resolved, (refs.get(resolved) ?? 0) + 1);

  let released = false;

  return {
    languageId: resolved,
    available,
    has(provider) {
      return available.has(provider); // O(1) Set membership, no I/O
    },
    get(provider) {
      if (released) return undefined;
      return readResolved(resolved, provider);
    },
    derive(view, provider, factory) {
      if (released) return undefined;

      const key = viewKeyOf(resolved, view);
      const hit = payloadCache.get(key);
      if (hit) {
        touch(key, hit);
        return hit.value as ReturnType<typeof factory>;
      }

      const data = readResolved(resolved, provider);
      if (data === undefined) return undefined;

      const value = factory(data as NonNullable<typeof data>);
      // Charge the derived view roughly what its source costs, so it is
      // covered by the same byte budget rather than escaping it.
      const sourceBytes = payloadCache.get(payloadKey(resolved, provider))?.bytes ?? 0;
      store(key, resolved, value, sourceBytes);
      return value;
    },
    all() {
      const providers: LanguageProviders = {};
      if (released) return { language: resolved, providers };
      for (const provider of available) {
        const value = readResolved(resolved, provider);
        if (value !== undefined) {
          (providers as Record<string, unknown>)[provider] = value;
        }
      }
      return { language: resolved, providers };
    },
    release() {
      if (released) return; // never let a double-release drive refs negative
      released = true;

      const remaining = (refs.get(resolved) ?? 1) - 1;
      if (remaining > 0) {
        refs.set(resolved, remaining);
        return;
      }
      refs.delete(resolved);

      // Last handle for this language — drop exactly the keys it loaded
      // (payloads and derived views), not all 30 possible slots.
      const keys = keysByLanguage.get(resolved);
      if (keys) for (const key of [...keys]) evict(key);
    },
  };
}

export function hasLanguage(id: string): boolean {
  return pathIndex.has(resolveLanguageId(id));
}

export function listLanguages(): readonly string[] {
  return LANGUAGE_IDS; // frozen, built once
}

/** Absolute path of a provider's file, for diagnostics. No I/O. */
export function providerPath(languageId: string, provider: ProviderName): string | undefined {
  const resolved = resolveLanguageId(languageId);
  for (const link of chainIndex.get(resolved) ?? [resolved]) {
    const p = pathIndex.get(link)?.get(provider);
    if (p) return p;
  }
  return undefined;
}

/** Inheritance chain for a language, base-last. */
export function languageChain(languageId: string): readonly string[] {
  const resolved = resolveLanguageId(languageId);
  return chainIndex.get(resolved) ?? [];
}

export function cacheStats(): {
  entries: number;
  bytes: number;
  maxBytes: number;
  maxEntries: number;
  ttlMs: number;
  languages: { language: string; refs: number }[];
} {
  return {
    entries: payloadCache.size,
    bytes: cachedBytes,
    maxBytes: CACHE_MAX_BYTES,
    maxEntries: CACHE_MAX_ENTRIES,
    ttlMs: CACHE_TTL_MS,
    languages: [...refs.entries()].map(([language, r]) => ({ language, refs: r })),
  };
}

/** Drop every cached payload. Safe at any time — files are re-read on demand. */
export function clearCache(): void {
  for (const key of [...payloadCache.keys()]) evict(key);
  payloadCache.clear();
  keysByLanguage.clear();
  cachedBytes = 0;
}

/** Stop the idle sweeper. For process shutdown. */
export function stopSweeper(): void {
  clearInterval(sweeper);
}
