export interface TypeDefinitionEntry {
  type: string;
  signature: string;
  description: string;
  module: string;
}

export interface TypeDefinitionData {
  language: string;
  typeDefinitions: Record<string, TypeDefinitionEntry>;
}
