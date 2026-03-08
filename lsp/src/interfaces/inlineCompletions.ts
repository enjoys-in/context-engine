export interface InlineCompletionItem {
  triggerPattern: string;
  insertText: string;
  description: string;
  completeBracketPairs: boolean;
}

export interface InlineCompletionsData {
  language: string;
  inlineCompletions: InlineCompletionItem[];
}
