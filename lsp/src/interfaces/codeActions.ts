export interface CodeActionEntry {
  title: string;
  kind: string;
  description: string;
  pattern: string;
  isPreferred?: boolean;
  diagnostic?: boolean;
  severity?: number;
  flags?: string;
  edit?: Record<string, unknown>;
}

export interface CodeActionsData {
  language: string;
  codeActions: CodeActionEntry[];
  providedCodeActionKinds: string[];
}
