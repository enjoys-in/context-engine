export interface InlayHintPattern {
  pattern?: string;
  /** InlayHintKind (spec §32): Type=1, Parameter=2. */
  kind?: number;
  label?: string;
  position?: string;
  paddingLeft?: boolean;
  paddingRight?: boolean;
  description?: string;
  display?: string;
  tooltip?: string;
  captureGroup?: number;
  [key: string]: unknown;
}

export interface TypeInferenceRule {
  pattern?: string;
  type?: string;
  [key: string]: unknown;
}

export interface InlayHintsData {
  language?: string;
  inlayHintPatterns?: InlayHintPattern[] | Array<Record<string, unknown>>;
  typeInferenceRules?: Record<string, TypeInferenceRule> | TypeInferenceRule[] | unknown;
  [key: string]: unknown;
}
