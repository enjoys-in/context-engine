export interface CompletionDocumentation {
  value: string;
}

export interface CompletionLabelObject {
  label: string;
  detail?: string;
  description?: string;
}

export interface CompletionItem {
  label: string | CompletionLabelObject;
  kind: number | string;
  detail: string;
  documentation?: CompletionDocumentation | string;
  insertText: string;
  insertTextRules?: number;
  sortText?: string;
}

export interface CompletionData {
  language: string;
  completions: CompletionItem[];
}
