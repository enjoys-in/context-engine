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
  /** CompletionItemKind (spec §32) — numeric. */
  kind: number;
  detail: string;
  documentation?: CompletionDocumentation | string;
  insertText: string;
  insertTextRules?: number;
  sortText?: string;
}

export interface CompletionData {
  language: string;
  /** CompletionItemProvider.triggerCharacters */
  triggerCharacters: string[];
  completions: CompletionItem[];
}
