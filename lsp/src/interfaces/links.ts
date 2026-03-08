export interface LinkPattern {
  pattern: string;
  captureGroup: number;
  tooltip: string;
}

export interface LinksData {
  language: string;
  linkPatterns: LinkPattern[];
}
