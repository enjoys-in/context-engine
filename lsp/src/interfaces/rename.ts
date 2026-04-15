export interface IdentifierRules {
  start?: string;
  continue?: string;
  forbidden?: string[];
}

export interface RenameValidation {
  allowEmpty?: boolean;
  maxLength?: number;
  pattern?: string;
}

export interface PrepareRenamePattern {
  pattern: string;
  captureGroup?: number;
  description?: string;
}

export interface RenameData {
  language?: string;
  wordPattern?: string;
  identifierRules?: IdentifierRules | Record<string, unknown>;
  renameValidation?: RenameValidation | Record<string, unknown>;
  prepareRenamePatterns?: PrepareRenamePattern[] | Array<Record<string, unknown>>;
  [key: string]: unknown;
}
