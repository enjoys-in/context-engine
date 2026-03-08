export interface DeclarationEntry {
  signature: string;
  description: string;
  type: string;
  module: string;
}

export interface DeclarationData {
  language: string;
  declarations: Record<string, DeclarationEntry>;
}
