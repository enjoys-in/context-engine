export interface DefinitionParameter {
  name: string;
  type: string;
  description: string;
}

export interface DefinitionEntry {
  signature: string;
  description: string;
  type: string;
  module: string;
  parameters?: DefinitionParameter[];
  returns?: string;
}

export interface DefinitionData {
  language: string;
  definitions: Record<string, DefinitionEntry>;
}
