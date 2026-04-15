export interface OnTypeFormatRule {
  action?: string;
  pattern?: string;
  description?: string;
  options?: Record<string, unknown>;
}

export interface OnTypeFormatTrigger {
  trigger: string;
  description?: string;
  rules?: OnTypeFormatRule[];
  action?: string;
  context?: string;
  pattern?: string;
  options?: Record<string, unknown>;
}

export interface OnTypeFormattingData {
  language?: string;
  autoFormatTriggerCharacters?: string[];
  triggerCharacters?: string[];
  formatRules?: OnTypeFormatTrigger[] | Array<Record<string, unknown>> | unknown;
  indentation?: {
    increasePattern?: string;
    decreasePattern?: string;
  } | Record<string, unknown>;
  [key: string]: unknown;
}
