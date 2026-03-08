export interface HoverContent {
  value: string;
}

export interface HoverEntry {
  contents: HoverContent[];
}

export interface HoverData {
  language: string;
  hovers: Record<string, HoverEntry>;
}
