import type { LanguageProviders, ServerCapabilities } from "./types.ts";

export function buildCapabilities(providers: LanguageProviders): ServerCapabilities {
  const caps: ServerCapabilities = {};

  // Document sync — full content on open/change
  caps.textDocumentSync = {
    openClose: true,
    change: 1, // Full content sync
  };

  if (providers.completion) {
    caps.completionProvider = { triggerCharacters: ["."], resolveProvider: false };
  }

  if (providers.hover) caps.hoverProvider = true;
  if (providers.definition) caps.definitionProvider = true;
  if (providers.declaration) caps.declarationProvider = true;
  if (providers.typeDefinition) caps.typeDefinitionProvider = true;
  if (providers.implementation) caps.implementationProvider = true;
  if (providers.references) caps.referencesProvider = true;
  if (providers.documentHighlight) caps.documentHighlightProvider = true;
  if (providers.documentSymbol) caps.documentSymbolProvider = true;
  if (providers.codeActions) caps.codeActionProvider = true;
  if (providers.codeLens) caps.codeLensProvider = { resolveProvider: false };
  if (providers.links) caps.documentLinkProvider = { resolveProvider: false };
  if (providers.color) caps.colorProvider = true;
  if (providers.formatting) caps.documentFormattingProvider = true;
  if (providers.documentRangeFormatting) caps.documentRangeFormattingProvider = true;

  if (providers.onTypeFormatting) {
    const chars = providers.onTypeFormatting.autoFormatTriggerCharacters;
    const trigger = chars.length > 0 ? chars : [";", "}"];
    caps.documentOnTypeFormattingProvider = {
      firstTriggerCharacter: trigger[0]!,
      moreTriggerCharacter: trigger.slice(1),
    };
  }

  if (providers.rename) caps.renameProvider = true;
  if (providers.foldingRange) caps.foldingRangeProvider = true;
  if (providers.selectionRange) caps.selectionRangeProvider = true;
  if (providers.linkedEditingRange) caps.linkedEditingRangeProvider = true;

  if (providers.signatureHelp) {
    const sig = providers.signatureHelp;
    caps.signatureHelpProvider = {
      triggerCharacters: sig.triggerCharacters || ["(", ","],
      retriggerCharacters: sig.retriggerCharacters || [","],
    };
  }

  if (providers.inlayHints) caps.inlayHintProvider = true;
  if (providers.inlineCompletions) caps.inlineCompletionProvider = true;

  if (providers.semanticTokens) {
    caps.semanticTokensProvider = {
      legend: providers.semanticTokens.tokenLegend ?? { tokenTypes: [], tokenModifiers: [] },
      full: true,
      range: !!providers.rangeSemanticTokens,
    };
  }

  // Monarch tokenizer data (custom capability — Monaco-specific)
  if (providers.monarchTokens) caps.monarchTokensProvider = true;

  // New symbol names / rename suggestions (custom capability)
  if (providers.newSymbolNames) caps.newSymbolNamesProvider = true;

  // Multi-document highlight (custom capability)
  if (providers.multiDocumentHighlight) caps.multiDocumentHighlightProvider = true;

  return caps;
}
