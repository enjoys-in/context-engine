export function buildCapabilities(providers: Record<string, any>): Record<string, any> {
  const caps: Record<string, any> = {};

  if (providers.completion) {
    const trigger = providers.completion.triggerCharacters || ["."];
    caps.completionProvider = { triggerCharacters: trigger, resolveProvider: false };
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
    const trigger = providers.onTypeFormatting.triggerCharacters || [";", "}"];
    caps.documentOnTypeFormattingProvider = {
      firstTriggerCharacter: trigger[0],
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
      legend: providers.semanticTokens.legend || { tokenTypes: [], tokenModifiers: [] },
      full: true,
      range: !!providers.rangeSemanticTokens,
    };
  }

  return caps;
}
