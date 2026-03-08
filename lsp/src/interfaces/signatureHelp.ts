export interface SignatureParameterDocumentation {
  value: string;
}

export interface SignatureParameter {
  label: string;
  documentation: SignatureParameterDocumentation;
}

export interface SignatureDocumentation {
  value: string;
}

export interface SignatureEntry {
  label: string;
  documentation: SignatureDocumentation;
  parameters: SignatureParameter[];
}

export interface SignatureHelpData {
  language: string;
  triggerCharacters: string[];
  retriggerCharacters: string[];
  signatures: SignatureEntry[];
}
