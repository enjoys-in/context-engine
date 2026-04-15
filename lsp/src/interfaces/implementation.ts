export interface ImplementationPattern {
  interface?: string;
  implementationKeyword?: string;
  pattern?: string;
  description?: string;
  captureGroup?: number;
  kind?: string;
  [key: string]: unknown;
}

export interface ImplementationKeywords {
  interface?: string[];
  implementation?: string[];
  [key: string]: unknown;
}

export interface ImplementationData {
  language?: string;
  implementationPatterns?: ImplementationPattern[];
  keywords?: ImplementationKeywords;
  [key: string]: unknown;
}
