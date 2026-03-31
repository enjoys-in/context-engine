export interface ReferencePattern {
  symbol: string;
  patterns: string[];
  includeDeclaration: boolean;
  description: string;
}

export interface ReferencesData {
  language: string;
  referencePatterns: ReferencePattern[];
  identifierPattern?: string;
}
