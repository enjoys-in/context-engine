export interface DefinitionParameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
}

export interface DefinitionEntry {
  signature?: string;
  description: string;
  type?: string;
  module?: string;
  parameters?: DefinitionParameter[];
  returns?: string;
  members?: Record<string, unknown>;
  url?: string;
  section?: string;
  [key: string]: unknown;
}

export interface DefinitionData {
  language: string;
  definitions: Record<string, DefinitionEntry>;
}
