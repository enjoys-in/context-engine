export interface TokenLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

export interface SemanticTokenRule {
  type: string;
  pattern: string;
  modifiers: string[];
  description: string;
}

export interface SemanticTokensData {
  language: string;
  tokenTypes: string[];
  tokenModifiers: string[];
  tokenLegend: TokenLegend;
  semanticRules: SemanticTokenRule[];
}
