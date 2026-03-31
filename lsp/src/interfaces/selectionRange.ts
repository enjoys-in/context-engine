export interface BlockPattern {
  start: string;
  end: string;
  description: string;
}

export interface SelectionRanges {
  bracketPairs: string[][];
  stringDelimiters: string[];
  blockPatterns: BlockPattern[];
  expansionHierarchy: string[];
}

export interface SelectionRangeData {
  language: string;
  selectionRanges: SelectionRanges & { wordPattern?: string };
}
