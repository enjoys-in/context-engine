export interface SymbolPattern {
  name: string;
  pattern: string;
  captureGroup: number;
  kind: number;
  type: string;
}

export interface DocumentSymbolData {
  language: string;
  symbolPatterns: SymbolPattern[];
}
