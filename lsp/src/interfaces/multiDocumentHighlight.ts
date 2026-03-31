export interface CrossFileSymbol {
  symbolKind: string;
  pattern: string;
  importPattern: string;
  exportPattern: string;
  highlightKind: number;
  description: string;
  crossFileCapable: boolean;
}

export interface ImportExportPatterns {
  importStatements: string[];
  exportStatements: string[];
  reExportStatements: string[];
}

export interface ScopeRule {
  patterns: string[];
  highlightKind: number;
}

export interface ScopeRules {
  globalScope: ScopeRule;
  moduleScope: ScopeRule;
  classScope: ScopeRule;
  functionScope: ScopeRule;
  blockScope: ScopeRule;
}

export interface SpecialHighlights {
  typeReferences: boolean;
  decorators: boolean;
  comments: boolean;
}

export interface MultiDocumentHighlightData {
  language: string;
  selector: { language: string; scheme: string };
  highlightKinds: { text: number; read: number; write: number };
  crossFileSymbols: CrossFileSymbol[];
  importExportPatterns: ImportExportPatterns;
  scopeRules: ScopeRules;
  writeOperations: string[];
  readOperations: string[];
  declarationPatterns: string[];
  referencePatterns: string[];
  specialHighlights: SpecialHighlights;
}
