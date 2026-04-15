export interface BlockPattern {
  start?: string;
  end?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SelectionRanges {
  bracketPairs?: string[][];
  stringDelimiters?: string[];
  blockPatterns?: BlockPattern[];
  expansionHierarchy?: string[];
}

export interface SelectionRangeData {
  language?: string;
  selectionRanges?: SelectionRanges & { wordPattern?: string };
  selectionPatterns?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
