export interface TokenLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

export interface SemanticTokenRule {
  type?: string;
  tokenType?: string;
  pattern: string;
  modifiers?: string[];
  tokenModifiers?: string[];
  description: string;
}

export interface SemanticTokensData {
  language: string;
  tokenTypes?: string[];
  tokenModifiers?: string[];
  tokenLegend?: TokenLegend;
  legend?: TokenLegend;
  semanticRules: SemanticTokenRule[];
}
