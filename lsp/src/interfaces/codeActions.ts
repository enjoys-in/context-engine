export interface CodeActionEntry {
  title: string;
  kind: string;
  description: string;
  pattern: string;
  isPreferred: boolean;
  diagnostic?: boolean;
  severity?: number;
  flags?: string;
}

export interface CodeActionsData {
  language: string;
  codeActions: CodeActionEntry[];
  providedCodeActionKinds: string[];
}
