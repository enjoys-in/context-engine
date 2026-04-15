export interface CrossFileSymbol {
  symbolKind?: string;
  kind?: string;
  pattern: string;
  importPattern?: string;
  exportPattern?: string;
  highlightKind?: number;
  description: string;
  crossFileCapable?: boolean;
}

export interface ImportExportPatterns {
  importStatements: string[];
  exportStatements: string[];
  reExportStatements: string[];
}

export interface ScopeRule {
  patterns?: string[];
  highlightKind?: number;
}

export interface ScopeRules {
  globalScope?: ScopeRule;
  moduleScope?: ScopeRule;
  classScope?: ScopeRule;
  functionScope?: ScopeRule;
  blockScope?: ScopeRule;
}

export interface ScopeRuleListItem {
  scope: string;
  description: string;
}

export interface AccessOperationRule {
  pattern: string;
  kind?: string;
  description?: string;
}

export interface SpecialHighlights {
  typeReferences: boolean;
  decorators: boolean;
  comments: boolean;
}

export interface MultiDocumentHighlightData {
  language?: string;
  selector?: { language: string; scheme: string } | Record<string, unknown>;
  highlightKinds?: { text: number; read: number; write: number } | Record<string, unknown>;
  crossFileSymbols?: CrossFileSymbol[] | Array<Record<string, unknown>>;
  importExportPatterns?: ImportExportPatterns | Record<string, unknown>;
  scopeRules?: ScopeRules | ScopeRuleListItem[] | Record<string, unknown>;
  writeOperations?: string[] | AccessOperationRule[];
  readOperations?: string[] | AccessOperationRule[];
  declarationPatterns?: string[] | AccessOperationRule[];
  referencePatterns?: string[] | AccessOperationRule[];
  specialHighlights?: SpecialHighlights | AccessOperationRule[] | Record<string, unknown>;
  [key: string]: unknown;
}
