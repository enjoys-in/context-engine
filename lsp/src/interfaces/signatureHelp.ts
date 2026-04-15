export interface SignatureParameterDocumentation {
  value?: string;
}

export interface SignatureParameter {
  label: string;
  documentation?: SignatureParameterDocumentation | string;
}

export interface SignatureDocumentation {
  value?: string;
}

export interface SignatureEntry {
  label: string;
  documentation?: SignatureDocumentation | string;
  parameters?: SignatureParameter[];
}

export interface SignatureHelpData {
  language: string;
  triggerCharacters?: string[];
  retriggerCharacters?: string[];
  signatures?: SignatureEntry[];
}
