export interface RangeFormattingRule {
  description: string;
  pattern: string;
  action: string;
  options: Record<string, any>;
}

export interface RangeFormattingData {
  language: string;
  defaultOptions: {
    tabSize: number;
    insertSpaces: boolean;
  };
  rangeFormattingRules: RangeFormattingRule[];
  adjustToSyntaxNode: boolean;
  supportedRangeTypes: string[];
}
