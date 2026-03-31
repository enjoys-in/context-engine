import type { JsonRpcReader, JsonRpcWriter } from "./jsonrpc.ts";
import type { CompletionData } from "./interfaces/completion.ts";
import type { DefinitionData } from "./interfaces/definition.ts";
import type { HoverData } from "./interfaces/hover.ts";
import type { CodeActionsData } from "./interfaces/codeActions.ts";
import type { CodeLensData } from "./interfaces/codeLens.ts";
import type { ColorData } from "./interfaces/color.ts";
import type { CommandsData } from "./interfaces/commands.ts";
import type { DeclarationData } from "./interfaces/declaration.ts";
import type { DocumentHighlightData } from "./interfaces/documentHighlight.ts";
import type { RangeFormattingData } from "./interfaces/documentRangeFormatting.ts";
import type { DocumentSymbolData } from "./interfaces/documentSymbol.ts";
import type { FoldingRangeData } from "./interfaces/foldingRange.ts";
import type { FormattingData } from "./interfaces/formatting.ts";
import type { ImplementationData } from "./interfaces/implementation.ts";
import type { InlayHintsData } from "./interfaces/inlayHints.ts";
import type { InlineCompletionsData } from "./interfaces/inlineCompletions.ts";
import type { LinkedEditingRangeData } from "./interfaces/linkedEditingRange.ts";
import type { LinksData } from "./interfaces/links.ts";
import type { OnTypeFormattingData } from "./interfaces/onTypeFormatting.ts";
import type { RangeSemanticTokensData } from "./interfaces/rangeSemanticTokens.ts";
import type { ReferencesData } from "./interfaces/references.ts";
import type { RenameData } from "./interfaces/rename.ts";
import type { SelectionRangeData } from "./interfaces/selectionRange.ts";
import type { SemanticTokensData } from "./interfaces/semanticTokens.ts";
import type { SignatureHelpData } from "./interfaces/signatureHelp.ts";
import type { TypeDefinitionData } from "./interfaces/typeDefinition.ts";
import type { MonarchTokensData } from "./interfaces/monarchTokens.ts";
import type { NewSymbolNamesData } from "./interfaces/newSymbolNames.ts";
import type { MultiDocumentHighlightData } from "./interfaces/multiDocumentHighlight.ts";

export * from "./interfaces";

// ── Provider map: all possible providers keyed by their data folder name ──
export interface LanguageProviders {
  completion?: CompletionData;
  definition?: DefinitionData;
  hover?: HoverData;
  codeActions?: CodeActionsData;
  codeLens?: CodeLensData;
  color?: ColorData;
  commands?: CommandsData;
  declaration?: DeclarationData;
  documentHighlight?: DocumentHighlightData;
  documentRangeFormatting?: RangeFormattingData;
  documentSymbol?: DocumentSymbolData;
  foldingRange?: FoldingRangeData;
  formatting?: FormattingData;
  implementation?: ImplementationData;
  inlayHints?: InlayHintsData;
  inlineCompletions?: InlineCompletionsData;
  linkedEditingRange?: LinkedEditingRangeData;
  links?: LinksData;
  onTypeFormatting?: OnTypeFormattingData;
  rangeSemanticTokens?: RangeSemanticTokensData;
  references?: ReferencesData;
  rename?: RenameData;
  selectionRange?: SelectionRangeData;
  semanticTokens?: SemanticTokensData;
  signatureHelp?: SignatureHelpData;
  typeDefinition?: TypeDefinitionData;
  monarchTokens?: MonarchTokensData;
  newSymbolNames?: NewSymbolNamesData;
  multiDocumentHighlight?: MultiDocumentHighlightData;
}

// ── LSP ServerCapabilities — subset we actually advertise ──
export interface CompletionOptions {
  triggerCharacters: string[];
  resolveProvider: boolean;
}

export interface SignatureHelpOptions {
  triggerCharacters: string[];
  retriggerCharacters: string[];
}

export interface DocumentOnTypeFormattingOptions {
  firstTriggerCharacter: string;
  moreTriggerCharacter: string[];
}

export interface SemanticTokensOptions {
  legend: { tokenTypes: string[]; tokenModifiers: string[] };
  full: boolean;
  range: boolean;
}

export interface ServerCapabilities {
  textDocumentSync?: {
    openClose: boolean;
    change: number;
  };
  completionProvider?: CompletionOptions;
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  declarationProvider?: boolean;
  typeDefinitionProvider?: boolean;
  implementationProvider?: boolean;
  referencesProvider?: boolean;
  documentHighlightProvider?: boolean;
  documentSymbolProvider?: boolean;
  codeActionProvider?: boolean;
  codeLensProvider?: { resolveProvider: boolean };
  documentLinkProvider?: { resolveProvider: boolean };
  colorProvider?: boolean;
  documentFormattingProvider?: boolean;
  documentRangeFormattingProvider?: boolean;
  documentOnTypeFormattingProvider?: DocumentOnTypeFormattingOptions;
  renameProvider?: boolean;
  foldingRangeProvider?: boolean;
  selectionRangeProvider?: boolean;
  linkedEditingRangeProvider?: boolean;
  signatureHelpProvider?: SignatureHelpOptions;
  inlayHintProvider?: boolean;
  inlineCompletionProvider?: boolean;
  semanticTokensProvider?: SemanticTokensOptions;
  monarchTokensProvider?: boolean;
  newSymbolNamesProvider?: boolean;
  multiDocumentHighlightProvider?: boolean;
}

export interface ManifestLanguage {
  id: string;
  name: string;
  files: Record<string, string>;
}

export interface Manifest {
  version: string;
  description: string;
  generatedAt: string;
  languages: ManifestLanguage[];
}

export interface LanguageData {
  language: string;
  providers: LanguageProviders;
}

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

export interface JsonRpcNotification {
  jsonrpc: string;
  method: string;
  params?: any;
}

export interface ConnectionContext {
  languageId: string;
  providers: LanguageProviders;
  capabilities: ServerCapabilities;
  reader: JsonRpcReader;
  writer: JsonRpcWriter;
}
