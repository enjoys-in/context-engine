export interface FormattingRule {
  description: string;
  pattern: string;
  replacement: string;
  flags?: string;
}

export interface FormattingIndentation {
  increasePattern: string;
  decreasePattern: string;
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
