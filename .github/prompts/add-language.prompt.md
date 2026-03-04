---
description: "Generate all Monaco language provider JSON data files for a new programming language in the context-engine"
agent: "agent"
argument-hint: "Language name (e.g., 'Ruby', 'Scala', 'Elixir')"
---

# Add New Language Support

Generate all JSON data files for the language **{{input}}** covering every Monaco `languages.*` provider, plus terminal commands, and register it in the manifest.

> **Type reference**: All interfaces, enums, and `register*` signatures are defined in
> [MONACO_LANGUAGES_API.instructions.md](../../MONACO_LANGUAGES_API.instructions.md).
> Consult it for exact `kind` enum values, `IRange` (1-based), `IPosition`, `IMarkdownString`, etc.

---

## File Structure

Create these files:

| # | File | Monaco Provider | Description |
|---|------|----------------|-------------|
| 1 | `data/completion/{{input}}.json` | `registerCompletionItemProvider` | Autocomplete items (keywords, built-ins, snippets, stdlib) |
| 2 | `data/defination/{{input}}.json` | `registerDefinitionProvider` | Symbol definitions / Go-to-Definition data *(folder intentionally spelled "defination")* |
| 3 | `data/hover/{{input}}.json` | `registerHoverProvider` | Hover tooltips |
| 4 | `data/commands/{{input}}.json` | — | Terminal commands & CLI actions |
| 5 | `data/codeActions/{{input}}.json` | `registerCodeActionProvider` | Quick-fix & refactor actions |
| 6 | `data/documentHighlight/{{input}}.json` | `registerDocumentHighlightProvider` | Highlight occurrences of symbols |
| 7 | `data/documentSymbol/{{input}}.json` | `registerDocumentSymbolProvider` | Outline / breadcrumb symbols |
| 8 | `data/links/{{input}}.json` | `registerLinkProvider` | Clickable links (URLs, imports, includes) |
| 9 | `data/typeDefinition/{{input}}.json` | `registerTypeDefinitionProvider` | Go-to-Type-Definition data |
| 10 | `data/references/{{input}}.json` | `registerReferenceProvider` | Find All References patterns |
| 11 | `data/implementation/{{input}}.json` | `registerImplementationProvider` | Go-to-Implementation data |
| 12 | `data/inlineCompletions/{{input}}.json` | `registerInlineCompletionsProvider` | Ghost-text / inline completion templates |
| 13 | `data/formatting/{{input}}.json` | `registerDocumentFormattingEditProvider` | Document formatting rules |
| 14 | `data/codeLens/{{input}}.json` | `registerCodeLensProvider` | Inline code lens actions |
| 15 | `data/color/{{input}}.json` | `registerColorProvider` | Color picker patterns |
| 16 | `data/declaration/{{input}}.json` | `registerDeclarationProvider` | Go-to-Declaration data |
| 17 | `data/inlayHints/{{input}}.json` | `registerInlayHintsProvider` | Inline type/parameter hints |

Then update:
- `data/manifest.json` — add language entry with all file paths
- `data/commands/manifest.json` — add the commands file entry

Ensure **all files are valid JSON** with no trailing commas and follow the formats below.

---

## 1. Format: Completion (`data/completion/{lang}.json`)

> Maps to `CompletionItemProvider` → `CompletionItem[]`

```json
{
  "language": "{lang_id}",
  "completions": [
    {
      "label": "display label",
      "kind": 15,
      "detail": "Short description",
      "documentation": {
        "value": "Markdown docs with ```{lang}\\ncode example\\n```"
      },
      "insertText": "snippet with ${1:placeholders}",
      "insertTextRules": 4,
      "sortText": "00_category_name",
      "filterText": "optional filter override",
      "tags": [],
      "commitCharacters": []
    }
  ]
}
```

**`kind`** (from `CompletionItemKind` enum): 0=Method, 1=Function, 2=Constructor, 3=Field, 4=Variable, 5=Class, 6=Struct, 7=Interface, 8=Module, 9=Property, 10=Event, 11=Operator, 12=Unit, 13=Value, 14=Constant, 15=Enum, 16=EnumMember, 17=Keyword, 18=Text, 19=Color, 20=File, 21=Reference, 22=Customcolor, 23=Folder, 24=TypeParameter, 25=User, 26=Issue, 27=Tool, 28=Snippet

**`insertTextRules`** (from `CompletionItemInsertTextRule`): 0=None, 1=KeepWhitespace, 4=InsertAsSnippet

**`tags`** (from `CompletionItemTag`): 1=Deprecated

**sortText**: prefix with `00_` for snippets, `01_` for keywords, `02_` for functions, `03_` for modules, `04_` for constants

Include **comprehensive** coverage: all keywords, built-in functions, standard library modules, common snippets (loops, conditionals, class/function definitions, error handling), and idiomatic patterns. Aim for **100+ entries** minimum.

---

## 2. Format: Definition (`data/defination/{lang}.json`)

> Maps to `DefinitionProvider` → `Definition | LocationLink[]`

```json
{
  "language": "{lang_id}",
  "definitions": {
    "symbol_name": {
      "signature": "symbol_name(args) -> return_type",
      "description": "What it does",
      "type": "function",
      "module": "module_or_scope",
      "url": "https://docs.example.com/symbol_name"
    }
  }
}
```

**`type`** values: `"function"`, `"keyword"`, `"variable"`, `"module"`, `"class"`, `"method"`, `"constant"`, `"interface"`, `"struct"`, `"enum"`

Include all built-in functions, important standard library symbols, and keywords.

---

## 3. Format: Hover (`data/hover/{lang}.json`)

> Maps to `HoverProvider` → `Hover` (with `contents: IMarkdownString[]`)

```json
{
  "language": "{lang_id}",
  "hovers": {
    "symbol_name": {
      "contents": [
        {
          "value": "```{lang}\nsignature_line\n```\nDescription of the symbol with `inline code` for types and values."
        }
      ]
    }
  }
}
```

Every key in the definitions file **MUST** have a corresponding hover entry. The hover `value` starts with a fenced code block showing the signature, followed by a description paragraph.

---

## 4. Format: Commands (`data/commands/{lang}.json`)

> Terminal CLI completions — not a Monaco provider, but used for shell integration.

Follow the existing command JSON structure in `data/commands/`. Include language-specific CLI tools, build commands, REPL commands, and package manager commands.

---

## 5. Format: Code Actions (`data/codeActions/{lang}.json`)

> Maps to `CodeActionProvider` → `CodeAction[]`
> See `CodeAction`, `CodeActionContext`, `CodeActionProviderMetadata` in the API reference.

```json
{
  "language": "{lang_id}",
  "codeActions": [
    {
      "title": "Extract to function",
      "kind": "refactor.extract",
      "description": "Extract selected code into a new function",
      "pattern": "regex or keyword pattern that triggers this action",
      "isPreferred": false
    }
  ],
  "providedCodeActionKinds": ["quickfix", "refactor", "refactor.extract", "refactor.inline", "source", "source.fixAll", "source.organizeImports"]
}
```

**`kind`** strings (CodeActionKind convention): `"quickfix"`, `"refactor"`, `"refactor.extract"`, `"refactor.inline"`, `"refactor.rewrite"`, `"source"`, `"source.organizeImports"`, `"source.fixAll"`

Include quick-fixes for common errors, refactoring actions, and source-level actions (organize imports, fix all).

---

## 6. Format: Document Highlight (`data/documentHighlight/{lang}.json`)

> Maps to `DocumentHighlightProvider` → `DocumentHighlight[]`
> See `DocumentHighlight`, `DocumentHighlightKind` in the API reference.

```json
{
  "language": "{lang_id}",
  "highlights": {
    "symbol_name": {
      "kind": 0,
      "description": "Highlights all occurrences of this keyword"
    }
  },
  "bracketPairs": [
    { "open": "{", "close": "}" },
    { "open": "(", "close": ")" },
    { "open": "[", "close": "]" }
  ],
  "keywordGroups": [
    {
      "name": "control_flow",
      "keywords": ["if", "else", "for", "while", "return"],
      "highlightKind": 0
    }
  ]
}
```

**`kind`** (from `DocumentHighlightKind`): 0=Text, 1=Read, 2=Write

Group related keywords together so the highlight provider can match all of them. Include bracket pairs and control flow groups.

---

## 7. Format: Document Symbol (`data/documentSymbol/{lang}.json`)

> Maps to `DocumentSymbolProvider` → `DocumentSymbol[]`
> See `DocumentSymbol`, `SymbolKind`, `SymbolTag` in the API reference.

```json
{
  "language": "{lang_id}",
  "symbolPatterns": [
    {
      "name": "Function Declaration",
      "pattern": "^\\s*(def|function)\\s+(\\w+)",
      "captureGroup": 2,
      "kind": 11,
      "detail": "function"
    },
    {
      "name": "Class Declaration",
      "pattern": "^\\s*class\\s+(\\w+)",
      "captureGroup": 1,
      "kind": 4,
      "detail": "class"
    }
  ]
}
```

**`kind`** (from `SymbolKind`): 0=File, 1=Module, 2=Namespace, 3=Package, 4=Class, 5=Method, 6=Property, 7=Field, 8=Constructor, 9=Enum, 10=Interface, 11=Function, 12=Variable, 13=Constant, 14=String, 15=Number, 16=Boolean, 17=Array, 18=Object, 19=Key, 20=Null, 21=EnumMember, 22=Struct, 23=Event, 24=Operator, 25=TypeParameter

**`tags`** (from `SymbolTag`): 1=Deprecated

Include patterns for all major language constructs: functions, classes, methods, variables, constants, modules, interfaces, enums, structs, etc.

---

## 8. Format: Links (`data/links/{lang}.json`)

> Maps to `LinkProvider` → `ILink[]`
> See `ILink`, `ILinksList` in the API reference.

```json
{
  "language": "{lang_id}",
  "linkPatterns": [
    {
      "pattern": "(?:import|from)\\s+['\"]([^'\"]+)['\"]",
      "captureGroup": 1,
      "tooltip": "Open module",
      "urlTemplate": "https://docs.example.com/modules/{capture}"
    },
    {
      "pattern": "(?:require|include)\\s*\\(?['\"]([^'\"]+)['\"]\\)?",
      "captureGroup": 1,
      "tooltip": "Open dependency"
    }
  ]
}
```

Include patterns for: module imports, file includes/requires, URL strings, documentation references, and any language-specific linking constructs.

---

## 9. Format: Type Definition (`data/typeDefinition/{lang}.json`)

> Maps to `TypeDefinitionProvider` → `Definition | LocationLink[]`
> See `TypeDefinitionProvider` in the API reference.

```json
{
  "language": "{lang_id}",
  "typeDefinitions": {
    "symbol_name": {
      "type": "class",
      "signature": "class SymbolName",
      "description": "Type definition for SymbolName",
      "module": "module_or_scope",
      "url": "https://docs.example.com/types/SymbolName"
    }
  }
}
```

**`type`** values: `"class"`, `"interface"`, `"struct"`, `"enum"`, `"type_alias"`, `"generic"`, `"primitive"`

Include all built-in types, standard library types, and commonly used type constructors.

---

## 10. Format: References (`data/references/{lang}.json`)

> Maps to `ReferenceProvider` → `Location[]`
> See `ReferenceProvider`, `ReferenceContext` in the API reference.

```json
{
  "language": "{lang_id}",
  "referencePatterns": [
    {
      "symbol": "symbol_name",
      "patterns": ["\\bsymbol_name\\b", "\\bsymbol_name\\s*\\("],
      "includeDeclaration": true,
      "description": "Find all usages of symbol_name"
    }
  ],
  "identifierPattern": "[a-zA-Z_][a-zA-Z0-9_]*"
}
```

Include patterns for: function calls, variable references, type usages, module references, and an `identifierPattern` regex that matches valid identifiers in the language.

---

## 11. Format: Implementation (`data/implementation/{lang}.json`)

> Maps to `ImplementationProvider` → `Definition | LocationLink[]`
> See `ImplementationProvider` in the API reference.

```json
{
  "language": "{lang_id}",
  "implementationPatterns": [
    {
      "interface": "InterfaceName",
      "implementationKeyword": "implements",
      "pattern": "class\\s+(\\w+)\\s+implements\\s+InterfaceName",
      "description": "Classes implementing InterfaceName"
    }
  ],
  "keywords": {
    "interface": ["interface", "abstract class", "protocol", "trait"],
    "implementation": ["implements", "extends", "class"]
  }
}
```

Include language-specific interface/implementation keywords, abstract class patterns, trait/protocol patterns, and mixin patterns.

---

## 12. Format: Inline Completions (`data/inlineCompletions/{lang}.json`)

> Maps to `InlineCompletionsProvider` → `InlineCompletions<InlineCompletion>`
> See `InlineCompletion`, `InlineCompletions` in the API reference.

```json
{
  "language": "{lang_id}",
  "inlineCompletions": [
    {
      "triggerPattern": "^\\s*for\\s*$",
      "insertText": "for ${1:i} in ${2:range(10)}:\n\t${3:pass}",
      "description": "For loop template",
      "completeBracketPairs": true
    },
    {
      "triggerPattern": "^\\s*def\\s+\\w+\\($",
      "insertText": "${1:param}):\n\t${2:pass}",
      "description": "Complete function parameters",
      "completeBracketPairs": true
    }
  ]
}
```

`insertText` can be a plain string or `{ "snippet": "..." }` for snippet syntax. Include inline completions for common patterns: loops, function definitions, conditionals, class templates, error handling, and idiomatic expressions.

---

## 13. Format: Formatting (`data/formatting/{lang}.json`)

> Maps to `DocumentFormattingEditProvider` → `TextEdit[]`
> See `DocumentFormattingEditProvider`, `FormattingOptions`, `TextEdit` in the API reference.

```json
{
  "language": "{lang_id}",
  "formatting": {
    "defaultTabSize": 4,
    "defaultInsertSpaces": true,
    "rules": [
      {
        "description": "Remove trailing whitespace",
        "pattern": "\\s+$",
        "replacement": ""
      },
      {
        "description": "Ensure single space after keywords",
        "pattern": "\\b(if|for|while|switch|catch)\\(",
        "replacement": "$1 ("
      },
      {
        "description": "Normalize line endings",
        "pattern": "\\r\\n",
        "replacement": "\n"
      }
    ],
    "indentation": {
      "increasePattern": "\\{\\s*$|\\b(if|else|for|while|do|switch|try|catch|finally)\\b.*:\\s*$",
      "decreasePattern": "^\\s*[}\\]]|^\\s*(end|else|elsif|catch|finally|rescue)\\b"
    }
  }
}
```

Include formatting rules specific to the language's conventions: indentation styles, spacing rules, brace placement, trailing commas, semicolons, etc.

---

## 14. Format: Code Lens (`data/codeLens/{lang}.json`)

> Maps to `CodeLensProvider` → `CodeLensList`
> See `CodeLens`, `CodeLensList` in the API reference.

```json
{
  "language": "{lang_id}",
  "codeLensPatterns": [
    {
      "pattern": "^\\s*(def|function|func)\\s+(\\w+)",
      "captureGroup": 2,
      "commandId": "editor.action.referenceSearch.trigger",
      "title": "Find References",
      "description": "Show all references to this function"
    },
    {
      "pattern": "^\\s*class\\s+(\\w+)",
      "captureGroup": 1,
      "commandId": "editor.action.goToImplementation",
      "title": "Find Implementations",
      "description": "Show all implementations of this class"
    },
    {
      "pattern": "^\\s*(test|it|describe)\\s*\\(",
      "captureGroup": 0,
      "commandId": "testing.runAtCursor",
      "title": "Run Test",
      "description": "Run this test case"
    }
  ]
}
```

Include code lens patterns for: function/method references, class implementations, test runners, main entry points, and any language-specific actionable constructs.

---

## 15. Format: Color (`data/color/{lang}.json`)

> Maps to `DocumentColorProvider` → `IColorInformation[]`, `IColorPresentation[]`
> See `IColor`, `IColorInformation`, `IColorPresentation` in the API reference.

```json
{
  "language": "{lang_id}",
  "colorPatterns": [
    {
      "pattern": "#([0-9a-fA-F]{6})",
      "format": "hex6",
      "description": "6-digit hex color"
    },
    {
      "pattern": "#([0-9a-fA-F]{8})",
      "format": "hex8",
      "description": "8-digit hex color with alpha"
    },
    {
      "pattern": "rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)",
      "format": "rgb",
      "description": "RGB color"
    },
    {
      "pattern": "rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)",
      "format": "rgba",
      "description": "RGBA color"
    }
  ],
  "colorPresentations": ["hex", "rgb", "rgba", "hsl", "hsla"],
  "namedColors": {
    "red": { "red": 1, "green": 0, "blue": 0, "alpha": 1 },
    "green": { "red": 0, "green": 0.502, "blue": 0, "alpha": 1 },
    "blue": { "red": 0, "green": 0, "blue": 1, "alpha": 1 }
  }
}
```

**`IColor`** fields: `red`, `green`, `blue`, `alpha` — all in range `[0, 1]`.

Include all color literal formats the language supports, plus named color constants if applicable.

---

## 16. Format: Declaration (`data/declaration/{lang}.json`)

> Maps to `DeclarationProvider` → `Definition | LocationLink[]`
> See `DeclarationProvider` in the API reference.

```json
{
  "language": "{lang_id}",
  "declarations": {
    "symbol_name": {
      "signature": "declaration syntax for symbol_name",
      "description": "Where symbol_name is declared",
      "type": "function",
      "module": "module_or_scope",
      "url": "https://docs.example.com/symbol_name"
    }
  },
  "declarationPatterns": [
    {
      "name": "Function Declaration",
      "pattern": "^\\s*(func|def|function|fn)\\s+(\\w+)",
      "captureGroup": 2,
      "type": "function"
    },
    {
      "name": "Variable Declaration",
      "pattern": "^\\s*(var|let|const|val)\\s+(\\w+)",
      "captureGroup": 2,
      "type": "variable"
    }
  ]
}
```

**`type`** values: `"function"`, `"variable"`, `"class"`, `"method"`, `"constant"`, `"module"`, `"interface"`, `"enum"`, `"type_alias"`

Include both static symbol declarations (like definitions) AND regex patterns for finding declarations in source code.

---

## 17. Format: Inlay Hints (`data/inlayHints/{lang}.json`)

> Maps to `InlayHintsProvider` → `InlayHintList`
> See `InlayHint`, `InlayHintLabelPart`, `InlayHintKind` in the API reference.

```json
{
  "language": "{lang_id}",
  "inlayHintPatterns": [
    {
      "pattern": "(\\w+)\\s*=\\s*(.+)",
      "kind": 1,
      "label": ": {inferred_type}",
      "position": "after_capture_1",
      "paddingLeft": true,
      "description": "Show inferred type for variable assignments"
    },
    {
      "pattern": "(\\w+)\\s*\\(([^)]+)\\)",
      "kind": 2,
      "label": "{param_name}:",
      "position": "before_each_arg",
      "paddingRight": true,
      "description": "Show parameter names at call sites"
    }
  ],
  "typeInferenceRules": {
    "string_literal": { "pattern": "['\"].*['\"]", "type": "string" },
    "number_literal": { "pattern": "\\d+(\\.\\d+)?", "type": "number" },
    "boolean_literal": { "pattern": "\\b(true|false)\\b", "type": "boolean" },
    "array_literal": { "pattern": "\\[.*\\]", "type": "array" },
    "null_literal": { "pattern": "\\b(null|nil|None)\\b", "type": "null" }
  }
}
```

**`kind`** (from `InlayHintKind`): 1=Type, 2=Parameter

Include patterns for: inferred types on variable declarations, parameter name hints at call sites, return type hints, and any language-specific hint patterns (e.g., enum variant types, closure parameter types).

---

## Manifest Registration

After creating all files, update `data/manifest.json` — add an entry in the `languages` array (**alphabetically sorted** by `id`):

```json
{
  "id": "{lang_id}",
  "name": "{Display Name}",
  "files": {
    "completion": "completion/{lang_id}.json",
    "defination": "defination/{lang_id}.json",
    "hover": "hover/{lang_id}.json",
    "codeActions": "codeActions/{lang_id}.json",
    "documentHighlight": "documentHighlight/{lang_id}.json",
    "documentSymbol": "documentSymbol/{lang_id}.json",
    "links": "links/{lang_id}.json",
    "typeDefinition": "typeDefinition/{lang_id}.json",
    "references": "references/{lang_id}.json",
    "implementation": "implementation/{lang_id}.json",
    "inlineCompletions": "inlineCompletions/{lang_id}.json",
    "formatting": "formatting/{lang_id}.json",
    "codeLens": "codeLens/{lang_id}.json",
    "color": "color/{lang_id}.json",
    "declaration": "declaration/{lang_id}.json",
    "inlayHints": "inlayHints/{lang_id}.json"
  }
}
```

Also update `data/commands/manifest.json` to include `"{lang_id}.json"` in the `files` array.

---

## Quality Checklist

- [ ] All files use the same `language` id (lowercase, e.g., `"ruby"`)
- [ ] Completions cover keywords, built-ins, snippets, and standard library (100+ entries)
- [ ] Every definition has a matching hover entry (100% coverage)
- [ ] Hover values start with a fenced code block of the signature
- [ ] Document symbols cover all major language constructs
- [ ] Code actions include quick-fixes, refactoring, and source-level actions
- [ ] Link patterns cover all import/include/require syntax
- [ ] Inlay hints cover type inference and parameter names
- [ ] Formatting rules match the language's conventions
- [ ] Code lens patterns target functions, classes, and tests
- [ ] Color patterns match all color literal formats (if applicable to the language)
- [ ] Declaration and type definition entries cover all declarable constructs
- [ ] Reference patterns include an `identifierPattern` for the language
- [ ] Implementation patterns cover interface/trait/protocol constructs
- [ ] Inline completions cover common code patterns and idioms
- [ ] Manifest entry added alphabetically with all file paths
- [ ] JSON is valid (no trailing commas)
- [ ] All `kind` values use the correct Monaco enum integers (see MONACO_LANGUAGES_API.instructions.md)

---

## Reference

- **Monaco API types**: [MONACO_LANGUAGES_API.instructions.md](../../MONACO_LANGUAGES_API.instructions.md) — all enums, interfaces, and register functions
- **Existing examples**: [data/completion/lua.json](../../data/completion/lua.json), [data/defination/lua.json](../../data/defination/lua.json), [data/hover/lua.json](../../data/hover/lua.json)
