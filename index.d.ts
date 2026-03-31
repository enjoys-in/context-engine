declare const PROVIDERS: readonly ["codeActions", "codeLens", "color", "commands", "completion", "declaration", "definition", "documentHighlight", "documentRangeFormatting", "documentSymbol", "foldingRange", "formatting", "hover", "implementation", "inlayHints", "inlineCompletions", "linkedEditingRange", "links", "monarchTokens", "multiDocumentHighlight", "newSymbolNames", "onTypeFormatting", "rangeSemanticTokens", "references", "rename", "selectionRange", "semanticTokens", "signatureHelp", "typeDefinition"];
export type ProviderName = (typeof PROVIDERS)[number];
export declare function getCommand(name: string): any;
export declare function getAllCommands(): any[];
export declare function listCommandNames(): string[];
export declare function getCommandsByCategory(category: string): any[];
export declare function getCommandsByPlatform(platform: string): any[];
export declare function searchCommands(query: string): any[];
export declare function getCategories(): string[];
export declare function getContextEngine(name: string): any;
export declare function getSubcommands(name: string): any;
export declare function getGlobalOptions(name: string): any;
export declare function getExamples(name: string): any;
export declare function count(): number;
export declare function clearCache(): void;
export declare function resolveCommandPath(name: string): string;
export declare const dataDir: string;
/**
 * Load a single provider's JSON for a language.
 * e.g. `getProviderData("completion", "javascript")`
 */
export declare function getProviderData(provider: ProviderName, languageId: string): any | null;
/**
 * Load all providers for a language. Returns a map of provider → data.
 */
export declare function getLanguageData(languageId: string): Record<string, any>;
/**
 * List all available language IDs for a specific provider.
 */
export declare function listLanguagesForProvider(provider: ProviderName): string[];
/**
 * List all available language IDs (union across all providers).
 */
export declare function listLanguages(): string[];
/**
 * List all provider names.
 */
export declare function listProviders(): readonly string[];
/**
 * Resolve the absolute path to a provider JSON file.
 */
export declare function resolveProviderPath(provider: ProviderName, languageId: string): string;
export declare function getManifest(): any;
/**
 * Load a theme by name.
 */
export declare function getTheme(name: string): any | null;
/**
 * List all available theme names.
 */
export declare function listThemes(): string[];
/**
 * Resolve the absolute path to a theme JSON file.
 */
export declare function resolveThemePath(name: string): string;
declare const _default: {
    getCommand: typeof getCommand;
    getAllCommands: typeof getAllCommands;
    listCommandNames: typeof listCommandNames;
    getCommandsByCategory: typeof getCommandsByCategory;
    getCommandsByPlatform: typeof getCommandsByPlatform;
    searchCommands: typeof searchCommands;
    getCategories: typeof getCategories;
    getContextEngine: typeof getContextEngine;
    getSubcommands: typeof getSubcommands;
    getGlobalOptions: typeof getGlobalOptions;
    getExamples: typeof getExamples;
    count: typeof count;
    clearCache: typeof clearCache;
    resolveCommandPath: typeof resolveCommandPath;
    dataDir: string;
    getProviderData: typeof getProviderData;
    getLanguageData: typeof getLanguageData;
    listLanguagesForProvider: typeof listLanguagesForProvider;
    listLanguages: typeof listLanguages;
    listProviders: typeof listProviders;
    resolveProviderPath: typeof resolveProviderPath;
    getManifest: typeof getManifest;
    getTheme: typeof getTheme;
    listThemes: typeof listThemes;
    resolveThemePath: typeof resolveThemePath;
};
export default _default;
