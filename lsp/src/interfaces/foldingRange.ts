export interface FoldingMarkers {
  start: string;
  end: string;
}

export interface FoldingRule {
  kind?: string;
  startPattern?: string;
  endPattern?: string;
  description: string;
  groupConsecutive?: boolean;
  indentBased?: boolean;
}

export interface FoldingRangeData {
  language: string;
  offSide?: boolean;
  markers?: FoldingMarkers;
  foldingRules?: FoldingRule[];
}
