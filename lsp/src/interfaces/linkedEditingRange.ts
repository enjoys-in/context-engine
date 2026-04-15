export interface LinkedEditingPattern {
  type?: string;
  openPattern?: string;
  closePattern?: string;
  description?: string;
  [key: string]: unknown;
}

export interface LinkedEditingRangeData {
  language?: string;
  wordPattern?: string;
  linkedEditingPatterns?: LinkedEditingPattern[];
  supported?: boolean;
  [key: string]: unknown;
}
