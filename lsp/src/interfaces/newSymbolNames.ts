export interface NewSymbolNameSuggestion {
  newSymbolName: string;
  tags: number[];
}

export interface RenameSuggestionRule {
  symbolKind: string;
  pattern: string;
  suggestedNames: NewSymbolNameSuggestion[];
  description: string;
}

export interface NamingPrefixes {
  variable: string[];
  function: string[];
  class: string[];
  interface: string[];
  constant: string[];
  boolean: string[];
}

export interface NamingSuffixes {
  variable: string[];
  function: string[];
  class: string[];
  interface: string[];
  constant: string[];
  enum: string[];
}

export interface NamingPatterns {
  variable: string;
  function: string;
  class: string;
  constant: string;
  interface: string;
  enum: string;
  typeParameter: string;
  parameter: string;
}

export interface NamingConventions {
  casing: string[];
  prefixes: NamingPrefixes;
  suffixes: NamingSuffixes;
  patterns: NamingPatterns;
}

export interface NewSymbolIdentifierRules {
  start: string;
  continue: string;
  maxLength: number;
  caseSensitive: boolean;
  unicodeSupport: boolean;
}

export interface NewSymbolNamesData {
  language: string;
  triggerKinds: { invoke: number; automatic: number };
  tags: { aiGenerated: number };
  namingConventions: NamingConventions;
  symbolKinds: string[];
  renameSuggestionRules: RenameSuggestionRule[];
  reservedWords: string[];
  identifierRules: NewSymbolIdentifierRules;
}
