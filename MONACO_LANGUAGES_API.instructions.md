# Monaco `monaco.languages.*` — Complete API Reference & Agent Instructions

> **Source of truth**: All interfaces, enums, and types below are copied verbatim from
> `node_modules/monaco-editor/monaco.d.ts` (`declare namespace languages` — lines 6516–8680).
> Do NOT paraphrase or simplify — use these exact shapes when implementing providers.

---

## Table of Contents

1. [Selectors & Utility Types](#1-selectors--utility-types)
2. [Language Registration](#2-language-registration)
3. [Token Providers](#3-token-providers)
4. [Language Configuration](#4-language-configuration)
5. [Completion Provider](#5-completion-provider)
6. [Hover Provider](#6-hover-provider)
7. [Signature Help Provider](#7-signature-help-provider)
8. [Definition Provider](#8-definition-provider)
9. [Declaration Provider](#9-declaration-provider)
10. [Type Definition Provider](#10-type-definition-provider)
11. [Implementation Provider](#11-implementation-provider)
12. [Reference Provider](#12-reference-provider)
13. [Document Symbol Provider](#13-document-symbol-provider)
14. [Document Highlight Provider](#14-document-highlight-provider)
15. [Linked Editing Range Provider](#15-linked-editing-range-provider)
16. [Document Formatting Provider](#16-document-formatting-provider)
17. [Document Range Formatting Provider](#17-document-range-formatting-provider)
18. [On Type Formatting Provider](#18-on-type-formatting-provider)
19. [Code Action Provider](#19-code-action-provider)
20. [Code Lens Provider](#20-code-lens-provider)
21. [Link Provider](#21-link-provider)
22. [Color Provider](#22-color-provider)
23. [Folding Range Provider](#23-folding-range-provider)
24. [Rename Provider](#24-rename-provider)
25. [New Symbol Names Provider](#25-new-symbol-names-provider)
26. [Selection Range Provider](#26-selection-range-provider)
27. [Inline Completions Provider](#27-inline-completions-provider)
28. [Inlay Hints Provider](#28-inlay-hints-provider)
29. [Document Semantic Tokens Provider](#29-document-semantic-tokens-provider)
30. [Document Range Semantic Tokens Provider](#30-document-range-semantic-tokens-provider)
31. [Monarch Tokenizer Types](#31-monarch-tokenizer-types)
32. [All Enums Quick Reference](#32-all-enums-quick-reference)
33. [Complete Register Function Index](#33-complete-register-function-index)
34. [Agent Rules](#34-agent-rules)

---

## Codebase Conventions

- **Type alias**: `type Monaco = typeof monacoNs` (import `* as monacoNs from "monaco-editor"`)
- **All `register*` functions return `IDisposable`** — always track and dispose them
- **Files using these APIs**: `core/plugin-context.ts`, `lib/lsp/providers.ts`, `lib/contextEngineProviders.ts`, `lib/hoverProvider.ts`, `lib/aiCompletions.ts`, `lib/loadSnippets.ts`, `lib/registerAutoClose.ts`, `extensions/monacoRegistrar.ts`, `core/language-registry.ts`

---

## 1. Selectors & Utility Types

```typescript
export class EditDeltaInfo {
	readonly linesAdded: number;
	readonly linesRemoved: number;
	readonly charsAdded: number;
	readonly charsRemoved: number;
	static fromText(text: string): EditDeltaInfo;
	static tryCreate(linesAdded: number | undefined, linesRemoved: number | undefined, charsAdded: number | undefined, charsRemoved: number | undefined): EditDeltaInfo | undefined;
	constructor(linesAdded: number, linesRemoved: number, charsAdded: number, charsRemoved: number);
}

export interface IRelativePattern {
	/**
	 * A base file path to which this pattern will be matched against relatively.
	 */
	readonly base: string;
	/**
	 * A file glob pattern like `*.{ts,js}` that will be matched on file paths
	 * relative to the base path.
	 *
	 * Example: Given a base of `/home/work/folder` and a file path of `/home/work/folder/index.js`,
	 * the file glob pattern will match on `index.js`.
	 */
	readonly pattern: string;
}

export type LanguageSelector = string | LanguageFilter | ReadonlyArray<string | LanguageFilter>;

export interface LanguageFilter {
	readonly language?: string;
	readonly scheme?: string;
	readonly pattern?: string | IRelativePattern;
	readonly notebookType?: string;
	/**
	 * This provider is implemented in the UI thread.
	 */
	readonly hasAccessToAllModels?: boolean;
	readonly exclusive?: boolean;
	/**
	 * This provider comes from a builtin extension.
	 */
	readonly isBuiltin?: boolean;
}

/**
 * A provider result represents the values a provider, like the HoverProvider,
 * may return. For once this is the actual result type `T`, like `Hover`, or a thenable that resolves
 * to that type `T`. In addition, `null` and `undefined` can be returned - either directly or from a
 * thenable.
 */
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

export interface Command {
	id: string;
	title: string;
	tooltip?: string;
	arguments?: unknown[];
}

export interface Location {
	/**
	 * The resource identifier of this location.
	 */
	uri: Uri;
	/**
	 * The document range of this locations.
	 */
	range: IRange;
}

export interface LocationLink {
	/**
	 * A range to select where this link originates from.
	 */
	originSelectionRange?: IRange;
	/**
	 * The target uri this link points to.
	 */
	uri: Uri;
	/**
	 * The full range this link points to.
	 */
	range: IRange;
	/**
	 * A range to select this link points to. Must be contained
	 * in `LocationLink.range`.
	 */
	targetSelectionRange?: IRange;
}

export type Definition = Location | Location[] | LocationLink[];

export interface SyntaxNode {
	startIndex: number;
	endIndex: number;
	startPosition: IPosition;
	endPosition: IPosition;
}

export interface QueryCapture {
	name: string;
	text?: string;
	node: SyntaxNode;
	encodedLanguageId: number;
}

/**
 * The state of the tokenizer between two lines.
 * It is useful to store flags such as in multiline comment, etc.
 * The model will clone the previous line's state and pass it in to tokenize the next line.
 */
export interface IState {
	clone(): IState;
	equals(other: IState): boolean;
}
```

---

## 2. Language Registration

```typescript
/**
 * Register information about a new language.
 */
export function register(language: ILanguageExtensionPoint): void;

/**
 * Get the information of all the registered languages.
 */
export function getLanguages(): ILanguageExtensionPoint[];

export function getEncodedLanguageId(languageId: string): number;

/**
 * An event emitted when a language is associated for the first time with a text model.
 * @event
 */
export function onLanguage(languageId: string, callback: () => void): IDisposable;

/**
 * An event emitted when a language is associated for the first time with a text model or
 * when a language is encountered during the tokenization of another language.
 * @event
 */
export function onLanguageEncountered(languageId: string, callback: () => void): IDisposable;
```

### `ILanguageExtensionPoint`

```typescript
export interface ILanguageExtensionPoint {
	id: string;
	extensions?: string[];
	filenames?: string[];
	filenamePatterns?: string[];
	firstLine?: string;
	aliases?: string[];
	mimetypes?: string[];
	configuration?: Uri;
}
```

---

## 3. Token Providers

```typescript
/**
 * Register a tokens provider factory for a language. This tokenizer will be exclusive with a tokenizer
 * set using `setTokensProvider` or one created using `setMonarchTokensProvider`, but will work together
 * with a tokens provider set using `registerDocumentSemanticTokensProvider` or `registerDocumentRangeSemanticTokensProvider`.
 */
export function registerTokensProviderFactory(languageId: string, factory: TokensProviderFactory): IDisposable;

/**
 * Set the tokens provider for a language (manual implementation). This tokenizer will be exclusive
 * with a tokenizer created using `setMonarchTokensProvider`, or with `registerTokensProviderFactory`,
 * but will work together with a tokens provider set using `registerDocumentSemanticTokensProvider`
 * or `registerDocumentRangeSemanticTokensProvider`.
 */
export function setTokensProvider(languageId: string, provider: TokensProvider | EncodedTokensProvider | Thenable<TokensProvider | EncodedTokensProvider>): IDisposable;

/**
 * Set the tokens provider for a language (monarch implementation). This tokenizer will be exclusive
 * with a tokenizer set using `setTokensProvider`, or with `registerTokensProviderFactory`, but will
 * work together with a tokens provider set using `registerDocumentSemanticTokensProvider` or
 * `registerDocumentRangeSemanticTokensProvider`.
 */
export function setMonarchTokensProvider(languageId: string, languageDef: IMonarchLanguage | Thenable<IMonarchLanguage>): IDisposable;

/**
 * Change the color map that is used for token colors.
 * Supported formats (hex): #RRGGBB, $RRGGBBAA, #RGB, #RGBA
 */
export function setColorMap(colorMap: string[] | null): void;
```

### Interfaces

```typescript
/**
 * A token.
 */
export interface IToken {
	startIndex: number;
	scopes: string;
}

/**
 * The result of a line tokenization.
 */
export interface ILineTokens {
	/**
	 * The list of tokens on the line.
	 */
	tokens: IToken[];
	/**
	 * The tokenization end state.
	 * A pointer will be held to this and the object should not be modified by the tokenizer after the pointer is returned.
	 */
	endState: IState;
}

/**
 * The result of a line tokenization.
 */
export interface IEncodedLineTokens {
	/**
	 * The tokens on the line in a binary, encoded format. Each token occupies two array indices. For token i:
	 *  - at offset 2*i => startIndex
	 *  - at offset 2*i + 1 => metadata
	 * Meta data is in binary format:
	 * - -------------------------------------------
	 *     3322 2222 2222 1111 1111 1100 0000 0000
	 *     1098 7654 3210 9876 5432 1098 7654 3210
	 * - -------------------------------------------
	 *     bbbb bbbb bfff ffff ffFF FFTT LLLL LLLL
	 * - -------------------------------------------
	 *  - L = EncodedLanguageId (8 bits): Use `getEncodedLanguageId` to get the encoded ID of a language.
	 *  - T = StandardTokenType (2 bits): Other = 0, Comment = 1, String = 2, RegEx = 3.
	 *  - F = FontStyle (4 bits): None = 0, Italic = 1, Bold = 2, Underline = 4, Strikethrough = 8.
	 *  - f = foreground ColorId (9 bits)
	 *  - b = background ColorId (9 bits)
	 *  - The color value for each colorId is defined in IStandaloneThemeData.customTokenColors:
	 * e.g. colorId = 1 is stored in IStandaloneThemeData.customTokenColors[1]. Color id = 0 means no color,
	 * id = 1 is for the default foreground color, id = 2 for the default background.
	 */
	tokens: Uint32Array;
	/**
	 * The tokenization end state.
	 * A pointer will be held to this and the object should not be modified by the tokenizer after the pointer is returned.
	 */
	endState: IState;
}

/**
 * A factory for token providers.
 */
export interface TokensProviderFactory {
	create(): ProviderResult<TokensProvider | EncodedTokensProvider | IMonarchLanguage>;
}

/**
 * A "manual" provider of tokens.
 */
export interface TokensProvider {
	/**
	 * The initial state of a language. Will be the state passed in to tokenize the first line.
	 */
	getInitialState(): IState;
	/**
	 * Tokenize a line given the state at the beginning of the line.
	 */
	tokenize(line: string, state: IState): ILineTokens;
}

/**
 * A "manual" provider of tokens, returning tokens in a binary form.
 */
export interface EncodedTokensProvider {
	/**
	 * The initial state of a language. Will be the state passed in to tokenize the first line.
	 */
	getInitialState(): IState;
	/**
	 * Tokenize a line given the state at the beginning of the line.
	 */
	tokenizeEncoded(line: string, state: IState): IEncodedLineTokens;
	/**
	 * Tokenize a line given the state at the beginning of the line.
	 */
	tokenize?(line: string, state: IState): ILineTokens;
}
```

---

## 4. Language Configuration

```typescript
/**
 * Set the editing configuration for a language.
 */
export function setLanguageConfiguration(languageId: string, configuration: LanguageConfiguration): IDisposable;
```

### Interfaces

```typescript
/**
 * The language configuration interface defines the contract between extensions and
 * various editor features, like automatic bracket insertion, automatic indentation etc.
 */
export interface LanguageConfiguration {
	/**
	 * The language's comment settings.
	 */
	comments?: CommentRule;
	/**
	 * The language's brackets.
	 * This configuration implicitly affects pressing Enter around these brackets.
	 */
	brackets?: CharacterPair[];
	/**
	 * The language's word definition.
	 * If the language supports Unicode identifiers (e.g. JavaScript), it is preferable
	 * to provide a word definition that uses exclusion of known separators.
	 * e.g.: A regex that matches anything except known separators (and dot is allowed to occur in a floating point number):
	 *   /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
	 */
	wordPattern?: RegExp;
	/**
	 * The language's indentation settings.
	 */
	indentationRules?: IndentationRule;
	/**
	 * The language's rules to be evaluated when pressing Enter.
	 */
	onEnterRules?: OnEnterRule[];
	/**
	 * The language's auto closing pairs. The 'close' character is automatically inserted with the
	 * 'open' character is typed. If not set, the configured brackets will be used.
	 */
	autoClosingPairs?: IAutoClosingPairConditional[];
	/**
	 * The language's surrounding pairs. When the 'open' character is typed on a selection, the
	 * selected string is surrounded by the open and close characters. If not set, the autoclosing pairs
	 * settings will be used.
	 */
	surroundingPairs?: IAutoClosingPair[];
	/**
	 * Defines a list of bracket pairs that are colorized depending on their nesting level.
	 * If not set, the configured brackets will be used.
	*/
	colorizedBracketPairs?: CharacterPair[];
	/**
	 * Defines what characters must be after the cursor for bracket or quote autoclosing to occur when using the 'languageDefined' autoclosing setting.
	 *
	 * This is typically the set of characters which can not start an expression, such as whitespace, closing brackets, non-unary operators, etc.
	 */
	autoCloseBefore?: string;
	/**
	 * The language's folding rules.
	 */
	folding?: FoldingRules;
	/**
	 * **Deprecated** Do not use.
	 *
	 * @deprecated Will be replaced by a better API soon.
	 */
	__electricCharacterSupport?: {
		docComment?: IDocComment;
	};
}

/**
 * Configuration for line comments.
 */
export interface LineCommentConfig {
	/**
	 * The line comment token, like `//`
	 */
	comment: string;
	/**
	 * Whether the comment token should not be indented and placed at the first column.
	 * Defaults to false.
	 */
	noIndent?: boolean;
}

/**
 * Describes how comments for a language work.
 */
export interface CommentRule {
	/**
	 * The line comment token, like `// this is a comment`.
	 * Can be a string or an object with comment and optional noIndent properties.
	 */
	lineComment?: string | LineCommentConfig | null;
	/**
	 * The block comment character pair, like `/* block comment */`
	 */
	blockComment?: CharacterPair | null;
}

/**
 * A tuple of two characters, like a pair of
 * opening and closing brackets.
 */
export type CharacterPair = [string, string];

export interface IAutoClosingPair {
	open: string;
	close: string;
}

export interface IAutoClosingPairConditional extends IAutoClosingPair {
	notIn?: string[];
}

/**
 * Describes indentation rules for a language.
 */
export interface IndentationRule {
	/**
	 * If a line matches this pattern, then all the lines after it should be unindented once (until another rule matches).
	 */
	decreaseIndentPattern: RegExp;
	/**
	 * If a line matches this pattern, then all the lines after it should be indented once (until another rule matches).
	 */
	increaseIndentPattern: RegExp;
	/**
	 * If a line matches this pattern, then **only the next line** after it should be indented once.
	 */
	indentNextLinePattern?: RegExp | null;
	/**
	 * If a line matches this pattern, then its indentation should not be changed and it should not be evaluated against the other rules.
	 */
	unIndentedLinePattern?: RegExp | null;
}

/**
 * Describes language specific folding markers such as '#region' and '#endregion'.
 * The start and end regexes will be tested against the contents of all lines and must be designed efficiently:
 * - the regex should start with '^'
 * - regexp flags (i, g) are ignored
 */
export interface FoldingMarkers {
	start: RegExp;
	end: RegExp;
}

/**
 * Describes folding rules for a language.
 */
export interface FoldingRules {
	/**
	 * Used by the indentation based strategy to decide whether empty lines belong to the previous or the next block.
	 * A language adheres to the off-side rule if blocks in that language are expressed by their indentation.
	 * See [wikipedia](https://en.wikipedia.org/wiki/Off-side_rule) for more information.
	 * If not set, `false` is used and empty lines belong to the previous block.
	 */
	offSide?: boolean;
	/**
	 * Region markers used by the language.
	 */
	markers?: FoldingMarkers;
}

/**
 * Describes a rule to be evaluated when pressing Enter.
 */
export interface OnEnterRule {
	/**
	 * This rule will only execute if the text before the cursor matches this regular expression.
	 */
	beforeText: RegExp;
	/**
	 * This rule will only execute if the text after the cursor matches this regular expression.
	 */
	afterText?: RegExp;
	/**
	 * This rule will only execute if the text above the this line matches this regular expression.
	 */
	previousLineText?: RegExp;
	/**
	 * The action to execute.
	 */
	action: EnterAction;
}

/**
 * Definition of documentation comments (e.g. Javadoc/JSdoc)
 */
export interface IDocComment {
	/**
	 * The string that starts a doc comment (e.g. '/**')
	 */
	open: string;
	/**
	 * The string that appears on the last line and closes the doc comment (e.g. ' * /').
	 */
	close?: string;
}

/**
 * Describes what to do when pressing Enter.
 */
export interface EnterAction {
	/**
	 * Describe what to do with the indentation.
	 */
	indentAction: IndentAction;
	/**
	 * Describes text to be appended after the new line and after the indentation.
	 */
	appendText?: string;
	/**
	 * Describes the number of characters to remove from the new line's indentation.
	 */
	removeText?: number;
}
```

---

## 5. Completion Provider

```typescript
/**
 * Register a completion item provider (use by e.g. suggestions).
 */
export function registerCompletionItemProvider(languageSelector: LanguageSelector, provider: CompletionItemProvider): IDisposable;
```

### Interfaces

```typescript
export interface CompletionItemLabel {
	label: string;
	detail?: string;
	description?: string;
}

export interface CompletionItemRanges {
	insert: IRange;
	replace: IRange;
}

/**
 * A completion item represents a text snippet that is
 * proposed to complete text that is being typed.
 */
export interface CompletionItem {
	/**
	 * The label of this completion item. By default
	 * this is also the text that is inserted when selecting
	 * this completion.
	 */
	label: string | CompletionItemLabel;
	/**
	 * The kind of this completion item. Based on the kind
	 * an icon is chosen by the editor.
	 */
	kind: CompletionItemKind;
	/**
	 * A modifier to the `kind` which affect how the item
	 * is rendered, e.g. Deprecated is rendered with a strikeout
	 */
	tags?: ReadonlyArray<CompletionItemTag>;
	/**
	 * A human-readable string with additional information
	 * about this item, like type or symbol information.
	 */
	detail?: string;
	/**
	 * A human-readable string that represents a doc-comment.
	 */
	documentation?: string | IMarkdownString;
	/**
	 * A string that should be used when comparing this item
	 * with other items. When `falsy` the label is used.
	 */
	sortText?: string;
	/**
	 * A string that should be used when filtering a set of
	 * completion items. When `falsy` the label is used.
	 */
	filterText?: string;
	/**
	 * Select this item when showing. *Note* that only one completion item can be selected and
	 * that the editor decides which item that is. The rule is that the *first* item of those
	 * that match best is selected.
	 */
	preselect?: boolean;
	/**
	 * A string or snippet that should be inserted in a document when selecting
	 * this completion.
	 */
	insertText: string;
	/**
	 * Additional rules (as bitmask) that should be applied when inserting
	 * this completion.
	 */
	insertTextRules?: CompletionItemInsertTextRule;
	/**
	 * A range of text that should be replaced by this completion item.
	 *
	 * *Note:* The range must be a single line and it must
	 * contain the position at which completion has been requested.
	 */
	range: IRange | CompletionItemRanges;
	/**
	 * An optional set of characters that when pressed while this completion is active will accept it first and
	 * then type that character. *Note* that all commit characters should have `length=1` and that superfluous
	 * characters will be ignored.
	 */
	commitCharacters?: string[];
	/**
	 * An optional array of additional text edits that are applied when
	 * selecting this completion. Edits must not overlap with the main edit
	 * nor with themselves.
	 */
	additionalTextEdits?: editor.ISingleEditOperation[];
	/**
	 * A command that should be run upon acceptance of this item.
	 */
	command?: Command;
	/**
	 * A command that should be run upon acceptance of this item.
	 */
	action?: Command;
}

export interface CompletionList {
	suggestions: CompletionItem[];
	incomplete?: boolean;
	dispose?(): void;
}

/**
 * Contains additional information about the context in which
 * completion provider is triggered.
 */
export interface CompletionContext {
	/**
	 * How the completion was triggered.
	 */
	triggerKind: CompletionTriggerKind;
	/**
	 * Character that triggered the completion item provider.
	 *
	 * `undefined` if provider was not triggered by a character.
	 */
	triggerCharacter?: string;
}

/**
 * The completion item provider interface defines the contract between extensions and
 * the IntelliSense.
 *
 * When computing *complete* completion items is expensive, providers can optionally implement
 * the `resolveCompletionItem`-function. In that case it is enough to return completion
 * items with a label from the provideCompletionItems-function. Subsequently,
 * when a completion item is shown in the UI and gains focus this provider is asked to resolve
 * the item, like adding doc-comment or details.
 */
export interface CompletionItemProvider {
	triggerCharacters?: string[];
	/**
	 * Provide completion items for the given position and document.
	 */
	provideCompletionItems(model: editor.ITextModel, position: Position, context: CompletionContext, token: CancellationToken): ProviderResult<CompletionList>;
	/**
	 * Given a completion item fill in more data, like doc-comment
	 * or details.
	 *
	 * The editor will only resolve a completion item once.
	 */
	resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem>;
}
```

---

## 6. Hover Provider

```typescript
/**
 * Register a hover provider (used by e.g. editor hover).
 */
export function registerHoverProvider(languageSelector: LanguageSelector, provider: HoverProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * A hover represents additional information for a symbol or word. Hovers are
 * rendered in a tooltip-like widget.
 */
export interface Hover {
	/**
	 * The contents of this hover.
	 */
	contents: IMarkdownString[];
	/**
	 * The range to which this hover applies. When missing, the
	 * editor will use the range at the current position or the
	 * current position itself.
	 */
	range?: IRange;
	/**
	 * Can increase the verbosity of the hover
	 */
	canIncreaseVerbosity?: boolean;
	/**
	 * Can decrease the verbosity of the hover
	 */
	canDecreaseVerbosity?: boolean;
}

/**
 * The hover provider interface defines the contract between extensions and
 * the hover-feature.
 */
export interface HoverProvider<THover = Hover> {
	/**
	 * Provide a hover for the given position, context and document. Multiple hovers at the same
	 * position will be merged by the editor. A hover can have a range which defaults
	 * to the word range at the position when omitted.
	 */
	provideHover(model: editor.ITextModel, position: Position, token: CancellationToken, context?: HoverContext<THover>): ProviderResult<THover>;
}

export interface HoverContext<THover = Hover> {
	/**
	 * Hover verbosity request
	 */
	verbosityRequest?: HoverVerbosityRequest<THover>;
}

export interface HoverVerbosityRequest<THover = Hover> {
	/**
	 * The delta by which to increase/decrease the hover verbosity level
	 */
	verbosityDelta: number;
	/**
	 * The previous hover for the same position
	 */
	previousHover: THover;
}
```

---

## 7. Signature Help Provider

```typescript
/**
 * Register a signature help provider (used by e.g. parameter hints).
 */
export function registerSignatureHelpProvider(languageSelector: LanguageSelector, provider: SignatureHelpProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export interface ParameterInformation {
	/**
	 * The label of this signature. Will be shown in
	 * the UI.
	 */
	label: string | [number, number];
	/**
	 * The human-readable doc-comment of this signature. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string | IMarkdownString;
}

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export interface SignatureInformation {
	/**
	 * The label of this signature. Will be shown in
	 * the UI.
	 */
	label: string;
	/**
	 * The human-readable doc-comment of this signature. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string | IMarkdownString;
	/**
	 * The parameters of this signature.
	 */
	parameters: ParameterInformation[];
	/**
	 * Index of the active parameter.
	 *
	 * If provided, this is used in place of `SignatureHelp.activeSignature`.
	 */
	activeParameter?: number;
}

/**
 * Signature help represents the signature of something
 * callable. There can be multiple signatures but only one
 * active and only one active parameter.
 */
export interface SignatureHelp {
	/**
	 * One or more signatures.
	 */
	signatures: SignatureInformation[];
	/**
	 * The active signature.
	 */
	activeSignature: number;
	/**
	 * The active parameter of the active signature.
	 */
	activeParameter: number;
}

export interface SignatureHelpResult extends IDisposable {
	value: SignatureHelp;
}

export interface SignatureHelpContext {
	readonly triggerKind: SignatureHelpTriggerKind;
	readonly triggerCharacter?: string;
	readonly isRetrigger: boolean;
	readonly activeSignatureHelp?: SignatureHelp;
}

/**
 * The signature help provider interface defines the contract between extensions and
 * the parameter hints-feature.
 */
export interface SignatureHelpProvider {
	readonly signatureHelpTriggerCharacters?: ReadonlyArray<string>;
	readonly signatureHelpRetriggerCharacters?: ReadonlyArray<string>;
	/**
	 * Provide help for the signature at the given position and document.
	 */
	provideSignatureHelp(model: editor.ITextModel, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelpResult>;
}
```

---

## 8. Definition Provider

```typescript
/**
 * Register a definition provider (used by e.g. go to definition).
 */
export function registerDefinitionProvider(languageSelector: LanguageSelector, provider: DefinitionProvider): IDisposable;
```

### Interface

```typescript
/**
 * The definition provider interface defines the contract between extensions and
 * the go to definition and peek definition features.
 */
export interface DefinitionProvider {
	/**
	 * Provide the definition of the symbol at the given position and document.
	 */
	provideDefinition(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]>;
}
```

---

## 9. Declaration Provider

```typescript
/**
 * Register a declaration provider
 */
export function registerDeclarationProvider(languageSelector: LanguageSelector, provider: DeclarationProvider): IDisposable;
```

### Interface

```typescript
/**
 * The definition provider interface defines the contract between extensions and
 * the go to definition and peek definition features.
 */
export interface DeclarationProvider {
	/**
	 * Provide the declaration of the symbol at the given position and document.
	 */
	provideDeclaration(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]>;
}
```

---

## 10. Type Definition Provider

```typescript
/**
 * Register a type definition provider (used by e.g. go to type definition).
 */
export function registerTypeDefinitionProvider(languageSelector: LanguageSelector, provider: TypeDefinitionProvider): IDisposable;
```

### Interface

```typescript
/**
 * The type definition provider interface defines the contract between extensions and
 * the go to type definition feature.
 */
export interface TypeDefinitionProvider {
	/**
	 * Provide the type definition of the symbol at the given position and document.
	 */
	provideTypeDefinition(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]>;
}
```

---

## 11. Implementation Provider

```typescript
/**
 * Register a implementation provider (used by e.g. go to implementation).
 */
export function registerImplementationProvider(languageSelector: LanguageSelector, provider: ImplementationProvider): IDisposable;
```

### Interface

```typescript
/**
 * The implementation provider interface defines the contract between extensions and
 * the go to implementation feature.
 */
export interface ImplementationProvider {
	/**
	 * Provide the implementation of the symbol at the given position and document.
	 */
	provideImplementation(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]>;
}
```

---

## 12. Reference Provider

```typescript
/**
 * Register a reference provider (used by e.g. reference search).
 */
export function registerReferenceProvider(languageSelector: LanguageSelector, provider: ReferenceProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * Value-object that contains additional information when
 * requesting references.
 */
export interface ReferenceContext {
	/**
	 * Include the declaration of the current symbol.
	 */
	includeDeclaration: boolean;
}

/**
 * The reference provider interface defines the contract between extensions and
 * the find references-feature.
 */
export interface ReferenceProvider {
	/**
	 * Provide a set of project-wide references for the given position and document.
	 */
	provideReferences(model: editor.ITextModel, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]>;
}
```

---

## 13. Document Symbol Provider

```typescript
/**
 * Register a document symbol provider (used by e.g. outline).
 */
export function registerDocumentSymbolProvider(languageSelector: LanguageSelector, provider: DocumentSymbolProvider): IDisposable;
```

### Interfaces

```typescript
export interface DocumentSymbol {
	name: string;
	detail: string;
	kind: SymbolKind;
	tags: ReadonlyArray<SymbolTag>;
	containerName?: string;
	range: IRange;
	selectionRange: IRange;
	children?: DocumentSymbol[];
}

/**
 * The document symbol provider interface defines the contract between extensions and
 * the go to symbol-feature.
 */
export interface DocumentSymbolProvider {
	displayName?: string;
	/**
	 * Provide symbol information for the given document.
	 */
	provideDocumentSymbols(model: editor.ITextModel, token: CancellationToken): ProviderResult<DocumentSymbol[]>;
}
```

---

## 14. Document Highlight Provider

```typescript
/**
 * Register a document highlight provider (used by e.g. highlight occurrences).
 */
export function registerDocumentHighlightProvider(languageSelector: LanguageSelector, provider: DocumentHighlightProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * A document highlight is a range inside a text document which deserves
 * special attention. Usually a document highlight is visualized by changing
 * the background color of its range.
 */
export interface DocumentHighlight {
	/**
	 * The range this highlight applies to.
	 */
	range: IRange;
	/**
	 * The highlight kind, default is text.
	 */
	kind?: DocumentHighlightKind;
}

/**
 * Represents a set of document highlights for a specific Uri.
 */
export interface MultiDocumentHighlight {
	/**
	 * The Uri of the document that the highlights belong to.
	 */
	uri: Uri;
	/**
	 * The set of highlights for the document.
	 */
	highlights: DocumentHighlight[];
}

/**
 * The document highlight provider interface defines the contract between extensions and
 * the word-highlight-feature.
 */
export interface DocumentHighlightProvider {
	/**
	 * Provide a set of document highlights, like all occurrences of a variable or
	 * all exit-points of a function.
	 */
	provideDocumentHighlights(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<DocumentHighlight[]>;
}

/**
 * A provider that can provide document highlights across multiple documents.
 */
export interface MultiDocumentHighlightProvider {
	readonly selector: LanguageSelector;
	/**
	 * Provide a Map of Uri --> document highlights, like all occurrences of a variable or
	 * all exit-points of a function.
	 *
	 * Used in cases such as split view, notebooks, etc. where there can be multiple documents
	 * with shared symbols.
	 *
	 * @param primaryModel The primary text model.
	 * @param position The position at which to provide document highlights.
	 * @param otherModels The other text models to search for document highlights.
	 * @param token A cancellation token.
	 * @returns A map of Uri to document highlights.
	 */
	provideMultiDocumentHighlights(primaryModel: editor.ITextModel, position: Position, otherModels: editor.ITextModel[], token: CancellationToken): ProviderResult<Map<Uri, DocumentHighlight[]>>;
}
```

---

## 15. Linked Editing Range Provider

```typescript
/**
 * Register an linked editing range provider.
 */
export function registerLinkedEditingRangeProvider(languageSelector: LanguageSelector, provider: LinkedEditingRangeProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * The linked editing range provider interface defines the contract between extensions and
 * the linked editing feature.
 */
export interface LinkedEditingRangeProvider {
	/**
	 * Provide a list of ranges that can be edited together.
	 */
	provideLinkedEditingRanges(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<LinkedEditingRanges>;
}

/**
 * Represents a list of ranges that can be edited together along with a word pattern to describe valid contents.
 */
export interface LinkedEditingRanges {
	/**
	 * A list of ranges that can be edited together. The ranges must have
	 * identical length and text content. The ranges cannot overlap
	 */
	ranges: IRange[];
	/**
	 * An optional word pattern that describes valid contents for the given ranges.
	 * If no pattern is provided, the language configuration's word pattern will be used.
	 */
	wordPattern?: RegExp;
}
```

---

## 16. Document Formatting Provider

```typescript
/**
 * Register a formatter that can handle only entire models.
 */
export function registerDocumentFormattingEditProvider(languageSelector: LanguageSelector, provider: DocumentFormattingEditProvider): IDisposable;
```

### Interfaces

```typescript
export interface TextEdit {
	range: IRange;
	text: string;
	eol?: editor.EndOfLineSequence;
}

/**
 * Interface used to format a model
 */
export interface FormattingOptions {
	/**
	 * Size of a tab in spaces.
	 */
	tabSize: number;
	/**
	 * Prefer spaces over tabs.
	 */
	insertSpaces: boolean;
}

/**
 * The document formatting provider interface defines the contract between extensions and
 * the formatting-feature.
 */
export interface DocumentFormattingEditProvider {
	readonly displayName?: string;
	/**
	 * Provide formatting edits for a whole document.
	 */
	provideDocumentFormattingEdits(model: editor.ITextModel, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]>;
}
```

---

## 17. Document Range Formatting Provider

```typescript
/**
 * Register a formatter that can handle a range inside a model.
 */
export function registerDocumentRangeFormattingEditProvider(languageSelector: LanguageSelector, provider: DocumentRangeFormattingEditProvider): IDisposable;
```

### Interface

```typescript
/**
 * The document formatting provider interface defines the contract between extensions and
 * the formatting-feature.
 */
export interface DocumentRangeFormattingEditProvider {
	readonly displayName?: string;
	/**
	 * Provide formatting edits for a range in a document.
	 *
	 * The given range is a hint and providers can decide to format a smaller
	 * or larger range. Often this is done by adjusting the start and end
	 * of the range to full syntax nodes.
	 */
	provideDocumentRangeFormattingEdits(model: editor.ITextModel, range: Range, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]>;
	provideDocumentRangesFormattingEdits?(model: editor.ITextModel, ranges: Range[], options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]>;
}
```

---

## 18. On Type Formatting Provider

```typescript
/**
 * Register a formatter than can do formatting as the user types.
 */
export function registerOnTypeFormattingEditProvider(languageSelector: LanguageSelector, provider: OnTypeFormattingEditProvider): IDisposable;
```

### Interface

```typescript
/**
 * The document formatting provider interface defines the contract between extensions and
 * the formatting-feature.
 */
export interface OnTypeFormattingEditProvider {
	autoFormatTriggerCharacters: string[];
	/**
	 * Provide formatting edits after a character has been typed.
	 *
	 * The given position and character should hint to the provider
	 * what range the position to expand to, like find the matching `{`
	 * when `}` has been entered.
	 */
	provideOnTypeFormattingEdits(model: editor.ITextModel, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]>;
}
```

---

## 19. Code Action Provider

```typescript
/**
 * Register a code action provider (used by e.g. quick fix).
 */
export function registerCodeActionProvider(languageSelector: LanguageSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): IDisposable;
```

### Interfaces

```typescript
/**
 * Contains additional diagnostic information about the context in which
 * a code action is run.
 */
export interface CodeActionContext {
	/**
	 * An array of diagnostics.
	 */
	readonly markers: editor.IMarkerData[];
	/**
	 * Requested kind of actions to return.
	 */
	readonly only?: string;
	/**
	 * The reason why code actions were requested.
	 */
	readonly trigger: CodeActionTriggerType;
}

export interface CodeAction {
	title: string;
	command?: Command;
	edit?: WorkspaceEdit;
	diagnostics?: editor.IMarkerData[];
	kind?: string;
	isPreferred?: boolean;
	isAI?: boolean;
	disabled?: string;
	ranges?: IRange[];
}

export interface CodeActionList extends IDisposable {
	readonly actions: ReadonlyArray<CodeAction>;
}

/**
 * The code action interface defines the contract between extensions and
 * the light bulb feature.
 */
export interface CodeActionProvider {
	/**
	 * Provide commands for the given document and range.
	 */
	provideCodeActions(model: editor.ITextModel, range: Range, context: CodeActionContext, token: CancellationToken): ProviderResult<CodeActionList>;
	/**
	 * Given a code action fill in the edit. Will only invoked when missing.
	 */
	resolveCodeAction?(codeAction: CodeAction, token: CancellationToken): ProviderResult<CodeAction>;
}

/**
 * Metadata about the type of code actions that a CodeActionProvider provides.
 */
export interface CodeActionProviderMetadata {
	/**
	 * List of code action kinds that a CodeActionProvider may return.
	 *
	 * This list is used to determine if a given `CodeActionProvider` should be invoked or not.
	 * To avoid unnecessary computation, every `CodeActionProvider` should list use `providedCodeActionKinds`. The
	 * list of kinds may either be generic, such as `["quickfix", "refactor", "source"]`, or list out every kind provided,
	 * such as `["quickfix.removeLine", "source.fixAll" ...]`.
	 */
	readonly providedCodeActionKinds?: readonly string[];
	readonly documentation?: ReadonlyArray<{
		readonly kind: string;
		readonly command: Command;
	}>;
}
```

---

## 20. Code Lens Provider

```typescript
/**
 * Register a code lens provider (used by e.g. inline code lenses).
 */
export function registerCodeLensProvider(languageSelector: LanguageSelector, provider: CodeLensProvider): IDisposable;
```

### Interfaces

```typescript
export interface CodeLens {
	range: IRange;
	id?: string;
	command?: Command;
}

export interface CodeLensList {
	readonly lenses: readonly CodeLens[];
	dispose?(): void;
}

export interface CodeLensProvider {
	onDidChange?: IEvent<this>;
	provideCodeLenses(model: editor.ITextModel, token: CancellationToken): ProviderResult<CodeLensList>;
	resolveCodeLens?(model: editor.ITextModel, codeLens: CodeLens, token: CancellationToken): ProviderResult<CodeLens>;
}
```

---

## 21. Link Provider

```typescript
/**
 * Register a link provider that can find links in text.
 */
export function registerLinkProvider(languageSelector: LanguageSelector, provider: LinkProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * A link inside the editor.
 */
export interface ILink {
	range: IRange;
	url?: Uri | string;
	tooltip?: string;
}

export interface ILinksList {
	links: ILink[];
	dispose?(): void;
}

/**
 * A provider of links.
 */
export interface LinkProvider {
	provideLinks(model: editor.ITextModel, token: CancellationToken): ProviderResult<ILinksList>;
	resolveLink?: (link: ILink, token: CancellationToken) => ProviderResult<ILink>;
}
```

---

## 22. Color Provider

```typescript
/**
 * Register a document color provider (used by Color Picker, Color Decorator).
 */
export function registerColorProvider(languageSelector: LanguageSelector, provider: DocumentColorProvider): IDisposable;
```

### Interfaces

```typescript
/**
 * A color in RGBA format.
 */
export interface IColor {
	/**
	 * The red component in the range [0-1].
	 */
	readonly red: number;
	/**
	 * The green component in the range [0-1].
	 */
	readonly green: number;
	/**
	 * The blue component in the range [0-1].
	 */
	readonly blue: number;
	/**
	 * The alpha component in the range [0-1].
	 */
	readonly alpha: number;
}

/**
 * String representations for a color
 */
export interface IColorPresentation {
	/**
	 * The label of this color presentation. It will be shown on the color
	 * picker header. By default this is also the text that is inserted when selecting
	 * this color presentation.
	 */
	label: string;
	/**
	 * An edit which is applied to a document when selecting
	 * this presentation for the color.
	 */
	textEdit?: TextEdit;
	/**
	 * An optional array of additional text edits that are applied when
	 * selecting this color presentation.
	 */
	additionalTextEdits?: TextEdit[];
}

/**
 * A color range is a range in a text model which represents a color.
 */
export interface IColorInformation {
	/**
	 * The range within the model.
	 */
	range: IRange;
	/**
	 * The color represented in this range.
	 */
	color: IColor;
}

/**
 * A provider of colors for editor models.
 */
export interface DocumentColorProvider {
	/**
	 * Provides the color ranges for a specific model.
	 */
	provideDocumentColors(model: editor.ITextModel, token: CancellationToken): ProviderResult<IColorInformation[]>;
	/**
	 * Provide the string representations for a color.
	 */
	provideColorPresentations(model: editor.ITextModel, colorInfo: IColorInformation, token: CancellationToken): ProviderResult<IColorPresentation[]>;
}
```

---

## 23. Folding Range Provider

```typescript
/**
 * Register a folding range provider
 */
export function registerFoldingRangeProvider(languageSelector: LanguageSelector, provider: FoldingRangeProvider): IDisposable;
```

### Interfaces

```typescript
export interface FoldingContext {
}

/**
 * A provider of folding ranges for editor models.
 */
export interface FoldingRangeProvider {
	/**
	 * An optional event to signal that the folding ranges from this provider have changed.
	 */
	onDidChange?: IEvent<this>;
	/**
	 * Provides the folding ranges for a specific model.
	 */
	provideFoldingRanges(model: editor.ITextModel, context: FoldingContext, token: CancellationToken): ProviderResult<FoldingRange[]>;
}

export interface FoldingRange {
	/**
	 * The one-based start line of the range to fold. The folded area starts after the line's last character.
	 */
	start: number;
	/**
	 * The one-based end line of the range to fold. The folded area ends with the line's last character.
	 */
	end: number;
	/**
	 * Describes the Kind of the folding range such as Comment or
	 * Region. The kind is used to categorize folding ranges and used by commands
	 * like 'Fold all comments'. See
	 * FoldingRangeKind for an enumeration of standardized kinds.
	 */
	kind?: FoldingRangeKind;
}

export class FoldingRangeKind {
	value: string;
	/**
	 * Kind for folding range representing a comment. The value of the kind is 'comment'.
	 */
	static readonly Comment: FoldingRangeKind;
	/**
	 * Kind for folding range representing a import. The value of the kind is 'imports'.
	 */
	static readonly Imports: FoldingRangeKind;
	/**
	 * Kind for folding range representing regions (for example marked by `#region`, `#endregion`).
	 * The value of the kind is 'region'.
	 */
	static readonly Region: FoldingRangeKind;
	/**
	 * Returns a FoldingRangeKind for the given value.
	 *
	 * @param value of the kind.
	 */
	static fromValue(value: string): FoldingRangeKind;
	/**
	 * Creates a new FoldingRangeKind.
	 *
	 * @param value of the kind.
	 */
	constructor(value: string);
}
```

---

## 24. Rename Provider

```typescript
/**
 * Register a rename provider (used by e.g. rename symbol).
 */
export function registerRenameProvider(languageSelector: LanguageSelector, provider: RenameProvider): IDisposable;
```

### Interfaces

```typescript
export interface Rejection {
	rejectReason?: string;
}

export interface RenameLocation {
	range: IRange;
	text: string;
}

export interface RenameProvider {
	provideRenameEdits(model: editor.ITextModel, position: Position, newName: string, token: CancellationToken): ProviderResult<WorkspaceEdit & Rejection>;
	resolveRenameLocation?(model: editor.ITextModel, position: Position, token: CancellationToken): ProviderResult<RenameLocation & Rejection>;
}

export interface WorkspaceEditMetadata {
	needsConfirmation: boolean;
	label: string;
	description?: string;
}

export interface WorkspaceFileEditOptions {
	overwrite?: boolean;
	ignoreIfNotExists?: boolean;
	ignoreIfExists?: boolean;
	recursive?: boolean;
	copy?: boolean;
	folder?: boolean;
	skipTrashBin?: boolean;
	maxSize?: number;
}

export interface IWorkspaceFileEdit {
	oldResource?: Uri;
	newResource?: Uri;
	options?: WorkspaceFileEditOptions;
	metadata?: WorkspaceEditMetadata;
}

export interface IWorkspaceTextEdit {
	resource: Uri;
	textEdit: TextEdit & {
		insertAsSnippet?: boolean;
		keepWhitespace?: boolean;
	};
	versionId: number | undefined;
	metadata?: WorkspaceEditMetadata;
}

export interface WorkspaceEdit {
	edits: Array<IWorkspaceTextEdit | IWorkspaceFileEdit | ICustomEdit>;
}

export interface ICustomEdit {
	readonly resource: Uri;
	readonly metadata?: WorkspaceEditMetadata;
	undo(): Promise<void> | void;
	redo(): Promise<void> | void;
}
```

---

## 25. New Symbol Names Provider

```typescript
/**
 * Register a new symbol-name provider (e.g., when a symbol is being renamed, show new possible symbol-names)
 */
export function registerNewSymbolNameProvider(languageSelector: LanguageSelector, provider: NewSymbolNamesProvider): IDisposable;
```

### Interfaces

```typescript
export interface NewSymbolName {
	readonly newSymbolName: string;
	readonly tags?: readonly NewSymbolNameTag[];
}

export interface NewSymbolNamesProvider {
	supportsAutomaticNewSymbolNamesTriggerKind?: Promise<boolean | undefined>;
	provideNewSymbolNames(model: editor.ITextModel, range: IRange, triggerKind: NewSymbolNameTriggerKind, token: CancellationToken): ProviderResult<NewSymbolName[]>;
}
```

---

## 26. Selection Range Provider

```typescript
/**
 * Register a selection range provider
 */
export function registerSelectionRangeProvider(languageSelector: LanguageSelector, provider: SelectionRangeProvider): IDisposable;
```

### Interfaces

```typescript
export interface SelectionRange {
	range: IRange;
}

export interface SelectionRangeProvider {
	/**
	 * Provide ranges that should be selected from the given position.
	 */
	provideSelectionRanges(model: editor.ITextModel, positions: Position[], token: CancellationToken): ProviderResult<SelectionRange[][]>;
}
```

---

## 27. Inline Completions Provider

```typescript
/**
 * Register an inline completions provider.
 */
export function registerInlineCompletionsProvider(languageSelector: LanguageSelector, provider: InlineCompletionsProvider): IDisposable;
```

### Interfaces

```typescript
export interface InlineCompletionContext {
	/**
	 * How the completion was triggered.
	 */
	readonly triggerKind: InlineCompletionTriggerKind;
	readonly selectedSuggestionInfo: SelectedSuggestionInfo | undefined;
	readonly includeInlineEdits: boolean;
	readonly includeInlineCompletions: boolean;
	readonly requestIssuedDateTime: number;
	readonly earliestShownDateTime: number;
}

export class SelectedSuggestionInfo {
	readonly range: IRange;
	readonly text: string;
	readonly completionKind: CompletionItemKind;
	readonly isSnippetText: boolean;
	constructor(range: IRange, text: string, completionKind: CompletionItemKind, isSnippetText: boolean);
	equals(other: SelectedSuggestionInfo): boolean;
}

export interface InlineCompletion {
	/**
	 * The text to insert.
	 * If the text contains a line break, the range must end at the end of a line.
	 * If existing text should be replaced, the existing text must be a prefix of the text to insert.
	 *
	 * The text can also be a snippet. In that case, a preview with default parameters is shown.
	 * When accepting the suggestion, the full snippet is inserted.
	*/
	readonly insertText: string | {
		snippet: string;
	} | undefined;
	/**
	 * The range to replace.
	 * Must begin and end on the same line.
	 * Refers to the current document or `uri` if provided.
	*/
	readonly range?: IRange;
	/**
	 * An optional array of additional text edits that are applied when
	 * selecting this completion. Edits must not overlap with the main edit
	 * nor with themselves.
	 * Refers to the current document or `uri` if provided.
	 */
	readonly additionalTextEdits?: editor.ISingleEditOperation[];
	/**
	 * The file for which the edit applies to.
	*/
	readonly uri?: UriComponents;
	/**
	 * A command that is run upon acceptance of this item.
	*/
	readonly command?: Command;
	readonly gutterMenuLinkAction?: Command;
	/**
	 * Is called the first time an inline completion is shown.
	 * @deprecated. Use `onDidShow` of the provider instead.
	*/
	readonly shownCommand?: Command;
	/**
	 * If set to `true`, unopened closing brackets are removed and unclosed opening brackets are closed.
	 * Defaults to `false`.
	*/
	readonly completeBracketPairs?: boolean;
	readonly isInlineEdit?: boolean;
	readonly showInlineEditMenu?: boolean;
	/** Only show the inline suggestion when the cursor is in the showRange. */
	readonly showRange?: IRange;
	readonly warning?: InlineCompletionWarning;
	readonly hint?: InlineCompletionHint;
	/**
	 * Used for telemetry.
	 */
	readonly correlationId?: string | undefined;
}

export interface InlineCompletionWarning {
	message: IMarkdownString | string;
	icon?: IconPath;
}

export interface InlineCompletionHint {
	/** Refers to the current document. */
	range: IRange;
	style: InlineCompletionHintStyle;
	content: string;
	jumpToEdit: boolean;
}

export type IconPath = editor.ThemeIcon;

export interface InlineCompletions<TItem extends InlineCompletion = InlineCompletion> {
	readonly items: readonly TItem[];
	/**
	 * A list of commands associated with the inline completions of this list.
	 */
	readonly commands?: InlineCompletionCommand[];
	readonly suppressSuggestions?: boolean | undefined;
	/**
	 * When set and the user types a suggestion without derivating from it, the inline suggestion is not updated.
	 */
	readonly enableForwardStability?: boolean | undefined;
}

export type InlineCompletionCommand = {
	command: Command;
	icon?: editor.ThemeIcon;
};

export type InlineCompletionProviderGroupId = string;

export interface InlineCompletionsProvider<T extends InlineCompletions = InlineCompletions> {
	provideInlineCompletions(model: editor.ITextModel, position: Position, context: InlineCompletionContext, token: CancellationToken): ProviderResult<T>;
	/**
	 * Will be called when an item is shown.
	 * @param updatedInsertText Is useful to understand bracket completion.
	*/
	handleItemDidShow?(completions: T, item: T['items'][number], updatedInsertText: string, editDeltaInfo: EditDeltaInfo): void;
	/**
	 * Will be called when an item is partially accepted.
	 * @param acceptedCharacters Deprecated. Use `info.acceptedCharacters` instead.
	 */
	handlePartialAccept?(completions: T, item: T['items'][number], acceptedCharacters: number, info: PartialAcceptInfo): void;
	/**
	 * @deprecated Use `handleEndOfLifetime` instead.
	*/
	handleRejection?(completions: T, item: T['items'][number]): void;
	/**
	 * Is called when an inline completion item is no longer being used.
	 * Provides a reason of why it is not used anymore.
	*/
	handleEndOfLifetime?(completions: T, item: T['items'][number], reason: InlineCompletionEndOfLifeReason<T['items'][number]>, lifetimeSummary: LifetimeSummary): void;
	/**
	 * Will be called when a completions list is no longer in use and can be garbage-collected.
	*/
	disposeInlineCompletions(completions: T, reason: InlineCompletionsDisposeReason): void;
	onDidChangeInlineCompletions?: IEvent<void>;
	/**
	 * Only used for yieldsToGroupIds.
	 * Multiple providers can have the same group id.
	 */
	groupId?: InlineCompletionProviderGroupId;
	/**
	 * Returns a list of preferred provider groupIds.
	 * The current provider is only requested for completions if no provider with a preferred group id returned a result.
	 */
	yieldsToGroupIds?: InlineCompletionProviderGroupId[];
	excludesGroupIds?: InlineCompletionProviderGroupId[];
	displayName?: string;
	debounceDelayMs?: number;
	toString?(): string;
}

export type InlineCompletionsDisposeReason = {
	kind: 'lostRace' | 'tokenCancellation' | 'other' | 'empty' | 'notTaken';
};

export type InlineCompletionEndOfLifeReason<TInlineCompletion = InlineCompletion> = {
	kind: InlineCompletionEndOfLifeReasonKind.Accepted;
} | {
	kind: InlineCompletionEndOfLifeReasonKind.Rejected;
} | {
	kind: InlineCompletionEndOfLifeReasonKind.Ignored;
	supersededBy?: TInlineCompletion;
	userTypingDisagreed: boolean;
};

/**
 * Info provided on partial acceptance.
 */
export interface PartialAcceptInfo {
	kind: PartialAcceptTriggerKind;
	acceptedLength: number;
}

export type LifetimeSummary = {
	requestUuid: string;
	correlationId: string | undefined;
	partiallyAccepted: number;
	partiallyAcceptedCountSinceOriginal: number;
	partiallyAcceptedRatioSinceOriginal: number;
	partiallyAcceptedCharactersSinceOriginal: number;
	shown: boolean;
	shownDuration: number;
	shownDurationUncollapsed: number;
	timeUntilShown: number | undefined;
	timeUntilProviderRequest: number;
	timeUntilProviderResponse: number;
	notShownReason: string | undefined;
	editorType: string;
	viewKind: string | undefined;
	preceeded: boolean;
	languageId: string;
	requestReason: string;
	cursorColumnDistance?: number;
	cursorLineDistance?: number;
	lineCountOriginal?: number;
	lineCountModified?: number;
	characterCountOriginal?: number;
	characterCountModified?: number;
	disjointReplacements?: number;
	sameShapeReplacements?: boolean;
	typingInterval: number;
	typingIntervalCharacterCount: number;
	selectedSuggestionInfo: boolean;
	availableProviders: string;
};
```

---

## 28. Inlay Hints Provider

```typescript
/**
 * Register an inlay hints provider.
 */
export function registerInlayHintsProvider(languageSelector: LanguageSelector, provider: InlayHintsProvider): IDisposable;
```

### Interfaces

```typescript
export interface InlayHintLabelPart {
	label: string;
	tooltip?: string | IMarkdownString;
	command?: Command;
	location?: Location;
}

export interface InlayHint {
	label: string | InlayHintLabelPart[];
	tooltip?: string | IMarkdownString;
	textEdits?: TextEdit[];
	position: IPosition;
	kind?: InlayHintKind;
	paddingLeft?: boolean;
	paddingRight?: boolean;
}

export interface InlayHintList {
	hints: InlayHint[];
	dispose(): void;
}

export interface InlayHintsProvider {
	displayName?: string;
	onDidChangeInlayHints?: IEvent<void>;
	provideInlayHints(model: editor.ITextModel, range: Range, token: CancellationToken): ProviderResult<InlayHintList>;
	resolveInlayHint?(hint: InlayHint, token: CancellationToken): ProviderResult<InlayHint>;
}
```

---

## 29. Document Semantic Tokens Provider

```typescript
/**
 * Register a document semantic tokens provider. A semantic tokens provider will complement and enhance a
 * simple top-down tokenizer. Simple top-down tokenizers can be set either via `setMonarchTokensProvider`
 * or `setTokensProvider`.
 *
 * For the best user experience, register both a semantic tokens provider and a top-down tokenizer.
 */
export function registerDocumentSemanticTokensProvider(languageSelector: LanguageSelector, provider: DocumentSemanticTokensProvider): IDisposable;
```

### Interfaces

```typescript
export interface SemanticTokensLegend {
	readonly tokenTypes: string[];
	readonly tokenModifiers: string[];
}

export interface SemanticTokens {
	readonly resultId?: string;
	readonly data: Uint32Array;
}

export interface SemanticTokensEdit {
	readonly start: number;
	readonly deleteCount: number;
	readonly data?: Uint32Array;
}

export interface SemanticTokensEdits {
	readonly resultId?: string;
	readonly edits: SemanticTokensEdit[];
}

export interface DocumentSemanticTokensProvider {
	readonly onDidChange?: IEvent<void>;
	getLegend(): SemanticTokensLegend;
	provideDocumentSemanticTokens(model: editor.ITextModel, lastResultId: string | null, token: CancellationToken): ProviderResult<SemanticTokens | SemanticTokensEdits>;
	releaseDocumentSemanticTokens(resultId: string | undefined): void;
}
```

---

## 30. Document Range Semantic Tokens Provider

```typescript
/**
 * Register a document range semantic tokens provider. A semantic tokens provider will complement and enhance a
 * simple top-down tokenizer. Simple top-down tokenizers can be set either via `setMonarchTokensProvider`
 * or `setTokensProvider`.
 *
 * For the best user experience, register both a semantic tokens provider and a top-down tokenizer.
 */
export function registerDocumentRangeSemanticTokensProvider(languageSelector: LanguageSelector, provider: DocumentRangeSemanticTokensProvider): IDisposable;
```

### Interface

```typescript
export interface DocumentRangeSemanticTokensProvider {
	readonly onDidChange?: IEvent<void>;
	getLegend(): SemanticTokensLegend;
	provideDocumentRangeSemanticTokens(model: editor.ITextModel, range: Range, token: CancellationToken): ProviderResult<SemanticTokens>;
}
```

---

## 31. Monarch Tokenizer Types

> Types for `setMonarchTokensProvider`.

```typescript
/**
 * A Monarch language definition
 */
export interface IMonarchLanguage {
	/**
	 * map from string to ILanguageRule[]
	 */
	tokenizer: {
		[name: string]: IMonarchLanguageRule[];
	};
	/**
	 * is the language case insensitive?
	 */
	ignoreCase?: boolean;
	/**
	 * is the language unicode-aware? (i.e., /\u{1D306}/)
	 */
	unicode?: boolean;
	/**
	 * if no match in the tokenizer assign this token class (default 'source')
	 */
	defaultToken?: string;
	/**
	 * for example [['{','}','delimiter.curly']]
	 */
	brackets?: IMonarchLanguageBracket[];
	/**
	 * start symbol in the tokenizer (by default the first entry is used)
	 */
	start?: string;
	/**
	 * attach this to every token class (by default '.' + name)
	 */
	tokenPostfix?: string;
	/**
	 * include line feeds (in the form of a \n character) at the end of lines
	 * Defaults to false
	 */
	includeLF?: boolean;
	/**
	 * Other keys that can be referred to by the tokenizer.
	 */
	[key: string]: any;
}

/**
 * A rule is either a regular expression and an action
 * 		shorthands: [reg,act] == { regex: reg, action: act}
 *		and       : [reg,act,nxt] == { regex: reg, action: act{ next: nxt }}
 */
export type IShortMonarchLanguageRule1 = [string | RegExp, IMonarchLanguageAction];

export type IShortMonarchLanguageRule2 = [string | RegExp, IMonarchLanguageAction, string];

export interface IExpandedMonarchLanguageRule {
	/**
	 * match tokens
	 */
	regex?: string | RegExp;
	/**
	 * action to take on match
	 */
	action?: IMonarchLanguageAction;
	/**
	 * or an include rule. include all rules from the included state
	 */
	include?: string;
}

export type IMonarchLanguageRule = IShortMonarchLanguageRule1 | IShortMonarchLanguageRule2 | IExpandedMonarchLanguageRule;

/**
 * An action is either an array of actions...
 * ... or a case statement with guards...
 * ... or a basic action with a token value.
 */
export type IShortMonarchLanguageAction = string;

export interface IExpandedMonarchLanguageAction {
	/**
	 * array of actions for each parenthesized match group
	 */
	group?: IMonarchLanguageAction[];
	/**
	 * map from string to ILanguageAction
	 */
	cases?: Object;
	/**
	 * token class (ie. css class) (or "@brackets" or "@rematch")
	 */
	token?: string;
	/**
	 * the next state to push, or "@push", "@pop", "@popall"
	 */
	next?: string;
	/**
	 * switch to this state
	 */
	switchTo?: string;
	/**
	 * go back n characters in the stream
	 */
	goBack?: number;
	/**
	 * @open or @close
	 */
	bracket?: string;
	/**
	 * switch to embedded language (using the mimetype) or get out using "@pop"
	 */
	nextEmbedded?: string;
	/**
	 * log a message to the browser console window
	 */
	log?: string;
}

export type IMonarchLanguageAction = IShortMonarchLanguageAction | IExpandedMonarchLanguageAction | (IShortMonarchLanguageAction | IExpandedMonarchLanguageAction)[];

/**
 * This interface can be shortened as an array, ie. ['{','}','delimiter.curly']
 */
export interface IMonarchLanguageBracket {
	/**
	 * open bracket
	 */
	open: string;
	/**
	 * closing bracket
	 */
	close: string;
	/**
	 * token class
	 */
	token: string;
}
```

---

## 32. All Enums Quick Reference

```typescript
export enum IndentAction {
	None = 0,
	Indent = 1,
	IndentOutdent = 2,
	Outdent = 3
}

export enum CompletionItemKind {
	Method = 0, Function = 1, Constructor = 2, Field = 3, Variable = 4,
	Class = 5, Struct = 6, Interface = 7, Module = 8, Property = 9,
	Event = 10, Operator = 11, Unit = 12, Value = 13, Constant = 14,
	Enum = 15, EnumMember = 16, Keyword = 17, Text = 18, Color = 19,
	File = 20, Reference = 21, Customcolor = 22, Folder = 23,
	TypeParameter = 24, User = 25, Issue = 26, Tool = 27, Snippet = 28
}

export enum CompletionItemTag { Deprecated = 1 }

export enum CompletionItemInsertTextRule { None = 0, KeepWhitespace = 1, InsertAsSnippet = 4 }

export enum CompletionTriggerKind { Invoke = 0, TriggerCharacter = 1, TriggerForIncompleteCompletions = 2 }

export enum InlineCompletionTriggerKind { Automatic = 0, Explicit = 1 }

export enum InlineCompletionEndOfLifeReasonKind { Accepted = 0, Rejected = 1, Ignored = 2 }

export enum InlineCompletionHintStyle { Code = 1, Label = 2 }

export enum PartialAcceptTriggerKind { Word = 0, Line = 1, Suggest = 2 }

export enum CodeActionTriggerType { Invoke = 1, Auto = 2 }

export enum SignatureHelpTriggerKind { Invoke = 1, TriggerCharacter = 2, ContentChange = 3 }

export enum DocumentHighlightKind { Text = 0, Read = 1, Write = 2 }

export enum SymbolKind {
	File = 0, Module = 1, Namespace = 2, Package = 3, Class = 4,
	Method = 5, Property = 6, Field = 7, Constructor = 8, Enum = 9,
	Interface = 10, Function = 11, Variable = 12, Constant = 13,
	String = 14, Number = 15, Boolean = 16, Array = 17, Object = 18,
	Key = 19, Null = 20, EnumMember = 21, Struct = 22, Event = 23,
	Operator = 24, TypeParameter = 25
}

export enum SymbolTag { Deprecated = 1 }

export enum InlayHintKind { Type = 1, Parameter = 2 }

export enum HoverVerbosityAction { Increase = 0, Decrease = 1 }

export enum NewSymbolNameTag { AIGenerated = 1 }

export enum NewSymbolNameTriggerKind { Invoke = 0, Automatic = 1 }
```

---

## 33. Complete API Function Index (Fully Typed Signatures)

> Every function below is copied from `declare namespace languages` in `editor.api.d.ts`.
> All `register*`/`set*` functions return `IDisposable`. All `on*` functions return `IDisposable`.

### 33.1 Language Registration & Query

```typescript
// Register a language ID (extensions, aliases, filenames, mimetypes)
register(language: ILanguageExtensionPoint): void;

// Get all registered languages
getLanguages(): ILanguageExtensionPoint[];

// Get the numeric (encoded) language ID for use in binary token metadata
getEncodedLanguageId(languageId: string): number;
```

### 33.2 Language Events

```typescript
// Fires when a language is associated for the first time with a text model
onLanguage(languageId: string, callback: () => void): IDisposable;

// Fires when a language is associated with a text model OR encountered during tokenization of another language
onLanguageEncountered(languageId: string, callback: () => void): IDisposable;
```

### 33.3 Language Configuration

```typescript
// Set bracket/comment/indent/folding/autoClosing rules for a language
setLanguageConfiguration(languageId: string, configuration: LanguageConfiguration): IDisposable;
```

### 33.4 Tokenization (set* — exclusive with each other, cooperative with semantic tokens)

```typescript
// Set the tokens provider (manual implementation)
setTokensProvider(languageId: string, provider: TokensProvider | EncodedTokensProvider | Thenable<TokensProvider | EncodedTokensProvider>): IDisposable;

// Set the tokens provider (Monarch grammar definition)
setMonarchTokensProvider(languageId: string, languageDef: IMonarchLanguage | Thenable<IMonarchLanguage>): IDisposable;

// Lazy factory for token providers
registerTokensProviderFactory(languageId: string, factory: TokensProviderFactory): IDisposable;

// Change the global token color map. Supported hex formats: #RRGGBB, #RRGGBBAA, #RGB, #RGBA
setColorMap(colorMap: string[] | null): void;
```

### 33.5 All `register*` Provider Functions

```typescript
// § Completion (IntelliSense suggestions)
registerCompletionItemProvider(languageSelector: LanguageSelector, provider: CompletionItemProvider): IDisposable;

// § Hover (editor hover tooltips)
registerHoverProvider(languageSelector: LanguageSelector, provider: HoverProvider): IDisposable;

// § Signature Help (parameter hints)
registerSignatureHelpProvider(languageSelector: LanguageSelector, provider: SignatureHelpProvider): IDisposable;

// § Definition (go to definition / peek definition)
registerDefinitionProvider(languageSelector: LanguageSelector, provider: DefinitionProvider): IDisposable;

// § Declaration (go to declaration)
registerDeclarationProvider(languageSelector: LanguageSelector, provider: DeclarationProvider): IDisposable;

// § Type Definition (go to type definition)
registerTypeDefinitionProvider(languageSelector: LanguageSelector, provider: TypeDefinitionProvider): IDisposable;

// § Implementation (go to implementation)
registerImplementationProvider(languageSelector: LanguageSelector, provider: ImplementationProvider): IDisposable;

// § References (find all references)
registerReferenceProvider(languageSelector: LanguageSelector, provider: ReferenceProvider): IDisposable;

// § Document Symbol (outline / breadcrumbs / go to symbol)
registerDocumentSymbolProvider(languageSelector: LanguageSelector, provider: DocumentSymbolProvider): IDisposable;

// § Document Highlight (highlight occurrences)
registerDocumentHighlightProvider(languageSelector: LanguageSelector, provider: DocumentHighlightProvider): IDisposable;

// § Linked Editing Range (linked tag editing)
registerLinkedEditingRangeProvider(languageSelector: LanguageSelector, provider: LinkedEditingRangeProvider): IDisposable;

// § Document Formatting (format entire document)
registerDocumentFormattingEditProvider(languageSelector: LanguageSelector, provider: DocumentFormattingEditProvider): IDisposable;

// § Document Range Formatting (format selection)
registerDocumentRangeFormattingEditProvider(languageSelector: LanguageSelector, provider: DocumentRangeFormattingEditProvider): IDisposable;

// § On Type Formatting (format as user types)
registerOnTypeFormattingEditProvider(languageSelector: LanguageSelector, provider: OnTypeFormattingEditProvider): IDisposable;

// § Code Action (quick fixes / refactors / source actions)
registerCodeActionProvider(languageSelector: LanguageSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): IDisposable;

// § Code Lens (inline code lenses)
registerCodeLensProvider(languageSelector: LanguageSelector, provider: CodeLensProvider): IDisposable;

// § Link (clickable links in editor)
registerLinkProvider(languageSelector: LanguageSelector, provider: LinkProvider): IDisposable;

// § Color (color picker / color decorator)
registerColorProvider(languageSelector: LanguageSelector, provider: DocumentColorProvider): IDisposable;

// § Folding Range (code folding regions)
registerFoldingRangeProvider(languageSelector: LanguageSelector, provider: FoldingRangeProvider): IDisposable;

// § Rename (rename symbol F2)
registerRenameProvider(languageSelector: LanguageSelector, provider: RenameProvider): IDisposable;

// § New Symbol Names (AI rename suggestions)
registerNewSymbolNameProvider(languageSelector: LanguageSelector, provider: NewSymbolNamesProvider): IDisposable;

// § Selection Range (smart selection expand/shrink)
registerSelectionRangeProvider(languageSelector: LanguageSelector, provider: SelectionRangeProvider): IDisposable;

// § Inline Completions (ghost text / AI completions)
registerInlineCompletionsProvider(languageSelector: LanguageSelector, provider: InlineCompletionsProvider): IDisposable;

// § Inlay Hints (inline type/parameter hints)
registerInlayHintsProvider(languageSelector: LanguageSelector, provider: InlayHintsProvider): IDisposable;

// § Document Semantic Tokens (semantic highlighting — cooperates with top-down tokenizers)
registerDocumentSemanticTokensProvider(languageSelector: LanguageSelector, provider: DocumentSemanticTokensProvider): IDisposable;

// § Document Range Semantic Tokens (range semantic highlighting — cooperates with top-down tokenizers)
registerDocumentRangeSemanticTokensProvider(languageSelector: LanguageSelector, provider: DocumentRangeSemanticTokensProvider): IDisposable;
```

### 33.6 Quick-Reference Table

| Category | Function | Provider / Config Type | Purpose |
|---|---|---|---|
| **Registration** | `register(language)` | `ILanguageExtensionPoint` | Register a language ID |
| **Registration** | `getLanguages()` | — | Get all registered languages |
| **Registration** | `getEncodedLanguageId(languageId)` | — | Get numeric language ID |
| **Events** | `onLanguage(languageId, callback)` | — | Fire when language first used by a model |
| **Events** | `onLanguageEncountered(languageId, callback)` | — | Fire when language used or encountered in tokenization |
| **Configuration** | `setLanguageConfiguration(languageId, configuration)` | `LanguageConfiguration` | Set bracket/comment/indent/folding rules |
| **Tokenization** | `setTokensProvider(languageId, provider)` | `TokensProvider \| EncodedTokensProvider` | Set manual tokenizer |
| **Tokenization** | `setMonarchTokensProvider(languageId, languageDef)` | `IMonarchLanguage` | Set Monarch tokenizer |
| **Tokenization** | `registerTokensProviderFactory(languageId, factory)` | `TokensProviderFactory` | Lazy token provider factory |
| **Tokenization** | `setColorMap(colorMap)` | `string[] \| null` | Set global token color map |
| **IntelliSense** | `registerCompletionItemProvider(sel, provider)` | `CompletionItemProvider` | Suggestions / autocomplete |
| **Hover** | `registerHoverProvider(sel, provider)` | `HoverProvider<THover>` | Hover tooltips |
| **Signatures** | `registerSignatureHelpProvider(sel, provider)` | `SignatureHelpProvider` | Parameter hints |
| **Navigation** | `registerDefinitionProvider(sel, provider)` | `DefinitionProvider` | Go to Definition |
| **Navigation** | `registerDeclarationProvider(sel, provider)` | `DeclarationProvider` | Go to Declaration |
| **Navigation** | `registerTypeDefinitionProvider(sel, provider)` | `TypeDefinitionProvider` | Go to Type Definition |
| **Navigation** | `registerImplementationProvider(sel, provider)` | `ImplementationProvider` | Go to Implementation |
| **Navigation** | `registerReferenceProvider(sel, provider)` | `ReferenceProvider` | Find All References |
| **Symbols** | `registerDocumentSymbolProvider(sel, provider)` | `DocumentSymbolProvider` | Outline / Breadcrumbs |
| **Highlight** | `registerDocumentHighlightProvider(sel, provider)` | `DocumentHighlightProvider` | Highlight occurrences |
| **Editing** | `registerLinkedEditingRangeProvider(sel, provider)` | `LinkedEditingRangeProvider` | Linked tag editing |
| **Formatting** | `registerDocumentFormattingEditProvider(sel, provider)` | `DocumentFormattingEditProvider` | Format Document |
| **Formatting** | `registerDocumentRangeFormattingEditProvider(sel, provider)` | `DocumentRangeFormattingEditProvider` | Format Selection |
| **Formatting** | `registerOnTypeFormattingEditProvider(sel, provider)` | `OnTypeFormattingEditProvider` | Format on type |
| **Actions** | `registerCodeActionProvider(sel, provider, meta?)` | `CodeActionProvider` | Quick fixes / Refactors |
| **Lenses** | `registerCodeLensProvider(sel, provider)` | `CodeLensProvider` | Inline code lenses |
| **Links** | `registerLinkProvider(sel, provider)` | `LinkProvider` | Clickable links |
| **Color** | `registerColorProvider(sel, provider)` | `DocumentColorProvider` | Color picker |
| **Folding** | `registerFoldingRangeProvider(sel, provider)` | `FoldingRangeProvider` | Code folding |
| **Rename** | `registerRenameProvider(sel, provider)` | `RenameProvider` | Rename Symbol (F2) |
| **Rename** | `registerNewSymbolNameProvider(sel, provider)` | `NewSymbolNamesProvider` | AI rename suggestions |
| **Selection** | `registerSelectionRangeProvider(sel, provider)` | `SelectionRangeProvider` | Smart selection expand |
| **AI / Ghost** | `registerInlineCompletionsProvider(sel, provider)` | `InlineCompletionsProvider<T>` | Ghost text / AI completions |
| **Hints** | `registerInlayHintsProvider(sel, provider)` | `InlayHintsProvider` | Inline type hints |
| **Semantic** | `registerDocumentSemanticTokensProvider(sel, provider)` | `DocumentSemanticTokensProvider` | Semantic highlighting |
| **Semantic** | `registerDocumentRangeSemanticTokensProvider(sel, provider)` | `DocumentRangeSemanticTokensProvider` | Range semantic highlighting |

---

## 34. Agent Rules

When implementing or modifying `monaco.languages` providers in this codebase:

1. **Always track `IDisposable`** — every `register*` returns one; push it to a disposables array and dispose on cleanup
2. **Use `PluginContext` wrapper** from `core/plugin-context.ts` when writing plugins — it auto-tracks disposables
3. **Null-check models and positions** — `model.getWordAtPosition()` can return `null`
4. **`IRange` is 1-based** — all `lineNumber` and `column` values start from 1
5. **LSP positions are 0-based** — convert with `fromMonacoPosition` / `toMonacoPosition` from `lib/lsp/converters.ts`
6. **Avoid duplicate registration** — use a `Set<string>` or boolean flag before calling `register*`
7. **Check `CancellationToken`** — use `token.isCancellationRequested` in long-running async providers
8. **Return `{ suggestions: [] }` not `null`** for empty completion results (avoids editor errors)
9. **Snippet insertText** requires `CompletionItemInsertTextRule.InsertAsSnippet` with `$1`, `$2`, `${1:placeholder}` syntax
10. **LanguageSelector** — all `register*` functions accept `string | LanguageFilter | ReadonlyArray<string | LanguageFilter>`; for single-language use, just pass the `string` language ID