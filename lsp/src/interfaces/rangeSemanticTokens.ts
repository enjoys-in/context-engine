import type { TokenLegend } from "./semanticTokens";

export interface RangeSemanticTokenRule {
  type: string;
  pattern: string;
  modifiers: string[];
  description: string;
  rangeScope: string;
}

export interface RangeSemanticTokensData {
  language: string;
  tokenTypes: string[];
  tokenModifiers: string[];
  tokenLegend: TokenLegend;
  rangeTokenRules: RangeSemanticTokenRule[];
}
