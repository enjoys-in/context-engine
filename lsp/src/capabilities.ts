import type { ServerCapabilities } from "./types.ts";
import type { LanguageHandle } from "./dataLoader.ts";

/**
 * Build capabilities from the language's available provider files.
 *
 * Presence is answered from the path index with no I/O. Only the four
 * capabilities that must advertise concrete values (completion and
 * on-type trigger characters, signature help triggers, token legend)
 * actually read a file, so `initialize` touches at most 4 of the 30
 * provider files instead of loading all of them.
 */
export function buildCapabilities(handle: LanguageHandle): ServerCapabilities {
  const caps: ServerCapabilities = {};
  const has = (p: Parameters<LanguageHandle["has"]>[0]) => handle.has(p);

  // Document sync — full content on open/change
  caps.textDocumentSync = {
    openClose: true,
    change: 1, // Full content sync
  };

  if (has("completion")) {
    // Every completion file declares its own triggerCharacters; "." is the
    // fallback for a file that predates that field.
    const chars = handle.get("completion")?.triggerCharacters;
    caps.completionProvider = {
      triggerCharacters: chars && chars.length > 0 ? chars : ["."],
      resolveProvider: false,
    };
  }

  if (has("hover")) caps.hoverProvider = true;
  if (has("definition")) caps.definitionProvider = true;
  if (has("declaration")) caps.declarationProvider = true;
  if (has("typeDefinition")) caps.typeDefinitionProvider = true;
  if (has("implementation")) caps.implementationProvider = true;
  if (has("references")) caps.referencesProvider = true;
  if (has("documentHighlight")) caps.documentHighlightProvider = true;
  if (has("documentSymbol")) caps.documentSymbolProvider = true;
  if (has("codeActions")) caps.codeActionProvider = true;
  if (has("codeLens")) caps.codeLensProvider = { resolveProvider: false };
  if (has("links")) caps.documentLinkProvider = { resolveProvider: false };
  if (has("color")) caps.colorProvider = true;
  if (has("formatting")) caps.documentFormattingProvider = true;
  if (has("documentRangeFormatting")) caps.documentRangeFormattingProvider = true;

  if (has("onTypeFormatting")) {
    const chars = handle.get("onTypeFormatting")?.autoFormatTriggerCharacters ?? [];
    const trigger = chars.length > 0 ? chars : [";", "}"];
    caps.documentOnTypeFormattingProvider = {
      firstTriggerCharacter: trigger[0] ?? ";",
      moreTriggerCharacter: trigger.slice(1),
    };
  }

  if (has("rename")) caps.renameProvider = true;
  if (has("foldingRange")) caps.foldingRangeProvider = true;
  if (has("selectionRange")) caps.selectionRangeProvider = true;
  if (has("linkedEditingRange")) caps.linkedEditingRangeProvider = true;

  if (has("signatureHelp")) {
    const sig = handle.get("signatureHelp");
    caps.signatureHelpProvider = {
      triggerCharacters: sig?.triggerCharacters ?? ["(", ","],
      retriggerCharacters: sig?.retriggerCharacters ?? [","],
    };
  }

  if (has("inlayHints")) caps.inlayHintProvider = true;
  if (has("inlineCompletions")) caps.inlineCompletionProvider = true;

  if (has("semanticTokens")) {
    caps.semanticTokensProvider = {
      legend: handle.get("semanticTokens")?.tokenLegend ?? { tokenTypes: [], tokenModifiers: [] },
      full: true,
      range: has("rangeSemanticTokens"),
    };
  }

  // Monarch tokenizer data (custom capability — Monaco-specific)
  if (has("monarchTokens")) caps.monarchTokensProvider = true;

  // New symbol names / rename suggestions (custom capability)
  if (has("newSymbolNames")) caps.newSymbolNamesProvider = true;

  // Multi-document highlight (custom capability)
  if (has("multiDocumentHighlight")) caps.multiDocumentHighlightProvider = true;

  // Language configuration — brackets/comments/indent (custom capability)
  if (has("languageConfiguration")) caps.languageConfigurationProvider = true;

  return caps;
}
