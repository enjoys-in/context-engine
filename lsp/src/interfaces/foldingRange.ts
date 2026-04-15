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

export interface FoldingStrategy {
  strategy?: string;
  start?: string;
  end?: string;
  kind?: string;
}

export interface FoldingRangeData {
  language: string;
  offSide?: boolean;
  markers?: FoldingMarkers;
  foldingRules?: FoldingRule[];
  displayName?: string;
  capabilities?: Record<string, unknown>;
  strategies?: FoldingStrategy[];
}
