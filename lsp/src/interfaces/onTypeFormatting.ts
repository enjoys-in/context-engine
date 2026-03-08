export interface OnTypeFormatRule {
  action: string;
  pattern: string;
  description: string;
}

export interface OnTypeFormatTrigger {
  trigger: string;
  description: string;
  rules: OnTypeFormatRule[];
}

export interface OnTypeFormattingData {
  language: string;
  autoFormatTriggerCharacters: string[];
  formatRules: OnTypeFormatTrigger[];
  indentation: {
    increasePattern: string;
    decreasePattern: string;
  };
}
