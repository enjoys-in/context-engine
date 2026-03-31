export interface MonarchBracket {
  open: string;
  close: string;
  token: string;
}

export interface MonarchAction {
  cases: Record<string, string>;
}

export type MonarchTokenRule =
  | [string, string]
  | [string, string, string]
  | [string, MonarchAction]
  | { include: string };

export interface MonarchTokenizer {
  root: MonarchTokenRule[];
  whitespace: MonarchTokenRule[];
  comment: MonarchTokenRule[];
  string_double: MonarchTokenRule[];
  string_single: MonarchTokenRule[];
  string_backtick?: MonarchTokenRule[];
  string_triple?: MonarchTokenRule[];
  bracketCounting?: MonarchTokenRule[];
  [state: string]: MonarchTokenRule[] | undefined;
}

export interface MonarchTokensData {
  language: string;
  tokenPostfix: string;
  defaultToken: string;
  keywords: string[];
  typeKeywords: string[];
  operators: string[];
  symbols: string;
  escapes: string;
  digits: string;
  brackets: MonarchBracket[];
  tokenizer: MonarchTokenizer;
}
