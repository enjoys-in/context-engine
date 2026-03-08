export interface CompletionDocumentation {
  value: string;
}

export interface CompletionItem {
  label: string;
  kind: number;
  detail: string;
  documentation: CompletionDocumentation;
  insertText: string;
  insertTextRules: number;
  sortText: string;
}

export interface CompletionData {
  language: string;
  completions: CompletionItem[];
}
