export interface LinkedEditingPattern {
  type: string;
  openPattern: string;
  closePattern: string;
  description: string;
}

export interface LinkedEditingRangeData {
  language: string;
  wordPattern: string;
  linkedEditingPatterns: LinkedEditingPattern[];
  supported: boolean;
}
