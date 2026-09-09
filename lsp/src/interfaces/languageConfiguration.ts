/** A Monaco `CharacterPair` — `[open, close]`. */
export type CharacterPair = [string, string];

export interface AutoClosingPair {
  open: string;
  close: string;
  /** Scopes the pair must not auto-close in, e.g. `["string", "comment"]`. */
  notIn?: string[];
}

export interface CommentRule {
  lineComment?: string;
  blockComment?: CharacterPair;
}

/** Regex sources — JSON cannot hold a RegExp, so callers construct one. */
export interface IndentationRule {
  increaseIndentPattern: string;
  decreaseIndentPattern: string;
  indentNextLinePattern?: string;
  unIndentedLinePattern?: string;
}

/** `indentAction` is the numeric IndentAction enum (spec §32). */
export interface EnterAction {
  indentAction: 0 | 1 | 2 | 3;
  appendText?: string;
  removeText?: number;
}

export interface OnEnterRule {
  beforeText: string;
  afterText?: string;
  previousLineText?: string;
  action: EnterAction;
  /** Authoring note; stripped before the config reaches Monaco. */
  description?: string;
}

export interface FoldingRules {
  offSide: boolean;
  markers?: { start: string; end: string };
}

/** Shape of `data/languageConfiguration/<lang>.json` — mirrors `monaco.languages.LanguageConfiguration`. */
export interface LanguageConfigurationData {
  language: string;
  comments: CommentRule;
  brackets: CharacterPair[];
  autoClosingPairs: AutoClosingPair[];
  surroundingPairs: AutoClosingPair[];
  colorizedBracketPairs: CharacterPair[];
  autoCloseBefore: string;
  /** Regex source. */
  wordPattern: string;
  indentationRules: IndentationRule;
  onEnterRules: OnEnterRule[];
  folding: FoldingRules;
}
