export interface InlayHintPattern {
  pattern: string;
  kind: number;
  label: string;
  position: string;
  paddingLeft?: boolean;
  paddingRight?: boolean;
  description: string;
}

export interface TypeInferenceRule {
  pattern: string;
  type: string;
}

export interface InlayHintsData {
  language: string;
  inlayHintPatterns: InlayHintPattern[];
  typeInferenceRules: Record<string, TypeInferenceRule>;
}
