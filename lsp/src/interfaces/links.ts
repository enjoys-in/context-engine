export interface LinkPattern {
  pattern: string;
  captureGroup: number;
  tooltip: string;
  linkKind?: string;
}

export interface LinksData {
  language: string;
  linkPatterns: LinkPattern[];
}
