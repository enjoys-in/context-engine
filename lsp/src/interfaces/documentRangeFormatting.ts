export interface RangeFormattingRule {
  description: string;
  pattern?: string;
  action?: string;
  options?: unknown;
}

export interface RangeFormattingData {
  language: string;
  defaultOptions?: {
    tabSize: number;
    insertSpaces: boolean;
  };
  rangeFormattingRules?: RangeFormattingRule[];
  adjustToSyntaxNode?: boolean;
  supportedRangeTypes?: string[];
  options?: Record<string, unknown>;
  displayName?: string;
  capabilities?: Record<string, unknown>;
}
