export interface FormattingRule {
  description: string;
  pattern?: string;
  replacement?: string;
  flags?: string;
  context?: string;
  rule?: string;
}

export interface FormattingIndentation {
  increasePattern?: string;
  decreasePattern?: string;
  [key: string]: unknown;
}

export interface FormattingData {
  language: string;
  formatting: {
    defaultTabSize: number;
    defaultInsertSpaces: boolean;
    rules: FormattingRule[];
    indentation: FormattingIndentation;
  };
}
