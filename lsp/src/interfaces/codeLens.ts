export interface CodeLensPattern {
  pattern: string;
  captureGroup?: number;
  commandId: string;
  title: string;
  description: string;
  tooltip?: string;
}

export interface CodeLensData {
  language: string;
  codeLensPatterns: CodeLensPattern[];
}
