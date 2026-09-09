declare const PROVIDERS: readonly ["codeActions", "codeLens", "color", "commands", "completion", "declaration", "definition", "documentHighlight", "documentRangeFormatting", "documentSymbol", "foldingRange", "formatting", "hover", "implementation", "inlayHints", "inlineCompletions", "languageConfiguration", "linkedEditingRange", "links", "monarchTokens", "multiDocumentHighlight", "newSymbolNames", "onTypeFormatting", "rangeSemanticTokens", "references", "rename", "selectionRange", "semanticTokens", "signatureHelp", "typeDefinition"];
export type ProviderName = (typeof PROVIDERS)[number];
/** How a detector's stdout should be turned into values. */
export type DetectorParser = "text" | "lines" | "json" | "csv" | "keyvalue" | "regex" | "table";

/**
 * A read-only shell probe that gathers live context for completion.
 *
 * This package never executes detectors — it has no `child_process` dependency. Running
 * them is the consumer's responsibility; see XTERM_INTEGRATION.md before wiring execution.
 */
export interface Detector {
  /** Unique within its command. Referenced by `CommandArg.completion.detector`. */
  name: string;
  description: string;
  /** Read-only shell command. `npm run validate` fails the build if it mutates state. */
  command: string;
  parser: DetectorParser;
  /** Seconds the result may be reused. Honour it, or you shell out per keystroke. */
  cacheFor: number;
  /** Binary that must exist; skip the probe entirely when it does not. */
  requiresCmd?: string;
  [key: string]: any;
}

/** Semantic kinds that name an enumerable runtime value, so a detector can list them. */
export type ArgType =
  | "string" | "path" | "file" | "directory" | "number" | "integer" | "url" | "boolean"
  | "branch" | "container" | "image" | "namespace" | "pod" | "service" | "cluster"
  | "bucket" | "volume" | "network" | "app" | "project" | "profile" | "environment"
  | "package" | "unit" | "table" | "database" | "remote" | "tag" | "stash" | "instance"
  | "node" | "job" | "function" | "secret" | "alias" | "version" | "device" | "session"
  | "worktree" | "stack" | "zone";

/** A positional argument. `args` is ordered, so index N is the Nth positional. */
export interface CommandArg {
  name: string;
  description: string;
  required: boolean;
  type?: ArgType;
  /**
   * Where this slot's candidate values come from. `detector` names a `Detector` in the
   * SAME command. Chosen per-arg rather than per-type because the useful values depend on
   * the verb: `docker stop` wants running containers, `docker start` wants all of them.
   * Absent when nothing local can enumerate the values (`brew install` reads a registry).
   */
  completion?: { detector: string; [key: string]: any };
  [key: string]: any;
}

export interface CommandOption {
  name: string;
  description: string;
  /** Short form, e.g. `-f`. `shorthand` mirrors it. */
  short?: string;
  shorthand?: string;
  type?: string;
  /** True for every `type` except `boolean`. */
  takesValue?: boolean;
  [key: string]: any;
}

export interface Subcommand {
  /**
   * Three forms coexist by design: flat (`"commit"`), space-encoded relative to the binary
   * (`"network ls"`, 771 of them), and parents with real nested `subcommands`. Resolve by
   * longest match and one code path handles all three.
   */
  name: string;
  description: string;
  options?: CommandOption[];
  args?: CommandArg[];
  examples?: string[];
  subcommands?: Subcommand[];
  [key: string]: any;
}

export interface Command {
  name: string;
  description: string;
  category: string;
  aliases?: string[];
  platforms?: string[];
  shells?: string[];
  subcommands?: Subcommand[];
  globalOptions?: CommandOption[];
  args?: CommandArg[];
  examples?: any[];
  relatedCommands?: string[];
  contextEngine?: { detectors: Detector[] };
  [key: string]: any;
}

/** Resolve a typed name (or binary alias, e.g. `hx`, `ncu`, `r2`) to its canonical command name. */
export declare function resolveCommandName(name: string): string;
/** Look up a command by name or by any of its declared `aliases`. */
export declare function getCommand(name: string): Command | undefined;
export declare function getAllCommands(): Command[];
export declare function listCommandNames(): string[];
export declare function getCommandsByCategory(category: string): Command[];
export declare function getCommandsByPlatform(platform: string): Command[];
export declare function searchCommands(query: string): Command[];
export declare function getCategories(): string[];
export declare function getContextEngine(name: string): { detectors: Detector[] } | null;
export declare function getSubcommands(name: string): Subcommand[];
export declare function getGlobalOptions(name: string): CommandOption[];
/** Examples normalised to `{command, description}`. */
export declare function getExamples(name: string): { command: string; description?: string }[];
/** Examples exactly as stored — either a plain string or `{command, description}`. */
export declare function getRawExamples(name: string): (string | { command: string; description?: string })[];
/** Every example for a command including its subcommands', each tagged with its origin. */
export declare function getAllExamples(name: string): { command: string; description?: string; subcommand: string | null }[];
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
/** A Monaco `CharacterPair` — `[open, close]`. */
export type CharacterPair = [string, string];
export interface AutoClosingPair { open: string; close: string; notIn?: string[]; }
/**
 * Raw `data/languageConfiguration/<lang>.json`. Regex-valued fields are stored as
 * strings (JSON cannot hold a RegExp); `toMonacoLanguageConfiguration` revives them.
 */
export interface LanguageConfigurationData {
    language: string;
    comments: { lineComment?: string; blockComment?: CharacterPair };
    brackets: CharacterPair[];
    autoClosingPairs: AutoClosingPair[];
    surroundingPairs: AutoClosingPair[];
    colorizedBracketPairs: CharacterPair[];
    autoCloseBefore: string;
    /** Regex source. */
    wordPattern: string;
    indentationRules: { increaseIndentPattern: string; decreaseIndentPattern: string };
    onEnterRules: Array<{
        beforeText: string;
        afterText?: string;
        previousLineText?: string;
        /** `indentAction` is the numeric `IndentAction` enum: None=0, Indent=1, IndentOutdent=2, Outdent=3. */
        action: { indentAction: 0 | 1 | 2 | 3; appendText?: string; removeText?: number };
        description?: string;
    }>;
    folding: { offSide: boolean; markers?: { start: string; end: string } };
}
/** Mirrors `monaco.languages.ILanguageExtensionPoint`. */
export interface LanguageExtensionPoint {
    id: string;
    extensions?: string[];
    filenames?: string[];
    filenamePatterns?: string[];
    firstLine?: string;
    aliases?: string[];
    mimetypes?: string[];
}
/** Load the raw language configuration for a language (regexes as strings). */
export declare function getLanguageConfiguration(languageId: string): LanguageConfigurationData | null;
/**
 * Language configuration with every regex field revived into a real `RegExp` and
 * authoring-only `description` keys stripped — pass straight to
 * `monaco.languages.setLanguageConfiguration(languageId, config)`.
 */
export declare function toMonacoLanguageConfiguration(languageId: string): any | null;
/** All 96 language registration entries, for `monaco.languages.register(...)`. */
export declare function getLanguageExtensionPoints(): LanguageExtensionPoint[];
/** A single language registration entry. */
export declare function getLanguageExtensionPoint(languageId: string): LanguageExtensionPoint | null;
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
    resolveCommandName: typeof resolveCommandName;
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
    getRawExamples: typeof getRawExamples;
    getAllExamples: typeof getAllExamples;
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
    getLanguageConfiguration: typeof getLanguageConfiguration;
    toMonacoLanguageConfiguration: typeof toMonacoLanguageConfiguration;
    getLanguageExtensionPoints: typeof getLanguageExtensionPoints;
    getLanguageExtensionPoint: typeof getLanguageExtensionPoint;
    getManifest: typeof getManifest;
    getTheme: typeof getTheme;
    listThemes: typeof listThemes;
    resolveThemePath: typeof resolveThemePath;
};
export default _default;
