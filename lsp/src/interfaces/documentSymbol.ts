export interface SymbolPattern {
  name: string;
  pattern: string;
  captureGroup: number;
  kind: number | string;
  type?: string;
  detail?: string;
}

export interface DocumentSymbolData {
  language: string;
  symbolPatterns: SymbolPattern[];
}
