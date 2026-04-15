export interface DeclarationEntry {
  signature?: string;
  description: string;
  type?: string;
  module?: string;
  pattern?: string;
  captureGroup?: number;
  kind?: number | string;
  url?: string;
  [key: string]: unknown;
}

export interface DeclarationPattern {
  name?: string;
  pattern: string;
  captureGroup?: number;
  type?: string;
  description?: string;
  kind?: number | string;
  [key: string]: unknown;
}

export interface DeclarationData {
  language: string;
  declarations: Record<string, DeclarationEntry> | DeclarationPattern[];
  declarationPatterns?: DeclarationPattern[];
}
