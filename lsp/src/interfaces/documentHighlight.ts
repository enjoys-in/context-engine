export interface HighlightEntry {
  kind: number;
  description: string;
}

export interface DocumentHighlightData {
  language: string;
  highlights: Record<string, HighlightEntry>;
}
