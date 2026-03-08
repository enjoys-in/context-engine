export interface ColorPattern {
  pattern: string;
  format: string;
  description: string;
}

export interface ColorData {
  language: string;
  colorPatterns: ColorPattern[];
  colorPresentations: string[];
  namedColors: Record<string, any>;
}
