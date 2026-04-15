export interface ReferencePattern {
  symbol?: string;
  patterns?: string[];
  pattern?: string;
  kind?: string;
  name?: string;
  captureGroup?: number;
  includeDeclaration: boolean;
  description: string;
}

export interface ReferencesData {
  language: string;
  referencePatterns: ReferencePattern[];
  identifierPattern?: string;
}
