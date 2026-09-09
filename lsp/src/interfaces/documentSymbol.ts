export interface SymbolPattern {
  name: string;
  pattern: string;
  captureGroup: number;
  /** SymbolKind (spec §32) — numeric. */
  kind: number;
  type?: string;
  detail?: string;
}

export interface DocumentSymbolData {
  language: string;
  symbolPatterns: SymbolPattern[];
}
