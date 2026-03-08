export interface ImplementationPattern {
  interface: string;
  implementationKeyword: string;
  pattern: string;
  description: string;
}

export interface ImplementationKeywords {
  interface: string[];
  implementation: string[];
}

export interface ImplementationData {
  language: string;
  implementationPatterns: ImplementationPattern[];
  keywords: ImplementationKeywords;
}
