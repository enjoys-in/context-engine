import type { TokenLegend } from "./semanticTokens";

export interface RangeSemanticTokenRule {
  type?: string;
  tokenType?: string;
  pattern: string;
  modifiers?: string[];
  tokenModifiers?: string[];
  description: string;
  rangeScope?: string;
}

export interface RangeSemanticTokensData {
  language: string;
  tokenTypes?: string[];
  tokenModifiers?: string[];
  tokenLegend?: TokenLegend;
  legend?: TokenLegend;
  rangeTokenRules?: RangeSemanticTokenRule[];
  semanticRules?: RangeSemanticTokenRule[];
}
