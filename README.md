# @enjoys/context-engine

Comprehensive Monaco Editor language intelligence engine with **94 languages**, **26 providers**, and **270 CLI commands** — completions, hover docs, definitions, code actions, code lens, document symbols, formatting, signature help, semantic tokens, inline completions, and more, all as pre-built JSON data with zero backend required.

## Why Context Engine?

Traditional LSP (Language Server Protocol) setups require a backend server running a separate language server process for every language you want to support. Each language server needs its own binary installed — Go, Rust, Python, TypeScript, and so on. At scale, this makes the backend **heavy**, memory-hungry, and CPU-intensive. Supporting all languages can easily consume **1 GB+** of disk space and significant runtime resources just to keep those servers alive.

Context Engine takes a fundamentally different approach. Instead of running language servers on the backend, it ships **pre-built, Monaco-compatible JSON data** for **94 languages across 26 provider types** — completions, hover docs, definitions, code actions, formatting rules, semantic tokens, and 270 CLI tool definitions — all in a single package. No language binaries to install. No background processes to manage. No backend required for intelligence.

> **Note:** Context Engine does not provide path-based intelligence (file resolution, go-to-definition across files, etc.) the way a full LSP does. It focuses on **language-aware completions, hover documentation, code actions, formatting, symbols, and terminal command autocomplete** — the features that matter most in web-based terminal and editor experiences, without the infrastructure overhead.

## Install

```bash
npm install @enjoys/context-engine
```

## What's Inside

```
data/                        # 2,444 JSON files — 94 languages × 26 providers + 256 commands
├── codeActions/             # Quick-fix and refactoring actions
├── codeLens/                # Inline actionable annotations (references, tests)
├── color/                   # Color picker and decorator support
├── commands/                # 270 CLI tool definitions (git, docker, kubectl, ...)
├── completion/              # Monaco CompletionItem[] with snippets
├── declaration/             # Go-to-declaration data
├── definition/              # Definitions (signatures, descriptions, types)
├── documentHighlight/       # Symbol highlight on selection
├── documentRangeFormatting/ # Format-selection rules
├── documentSymbol/          # Outline / symbol tree patterns
├── foldingRange/            # Code folding regions
├── formatting/              # Full-document formatting rules
├── hover/                   # Hover documentation (IMarkdownString[])
├── implementation/          # Go-to-implementation data
├── inlayHints/              # Inline parameter/type hints
├── inlineCompletions/       # Ghost-text inline completions
├── linkedEditingRange/      # Linked editing (e.g. HTML tag pairs)
├── links/                   # Clickable document link patterns
├── onTypeFormatting/        # Format-as-you-type rules
├── rangeSemanticTokens/     # Range-scoped semantic tokens
├── references/              # Find-all-references patterns
├── rename/                  # Symbol rename validation and patterns
├── selectionRange/          # Smart selection expansion
├── semanticTokens/          # Full semantic tokenization
├── signatureHelp/           # Function signature tooltips
├── typeDefinition/          # Go-to-type-definition data
└── manifest.json            # Language registry with file mappings
```

---

## Quick Start — Full Monaco Integration

This single example registers **completions**, **hover**, **definitions**, and **command-line autocomplete** for any language:

```js
import * as monaco from 'monaco-editor';

// ── 1. Import language data (e.g., nginx) ──
import nginxCompletions from '@enjoys/context-engine/completion/nginx.json';
import nginxDefinitions from '@enjoys/context-engine/definition/nginx.json';
import nginxHovers from '@enjoys/context-engine/hover/nginx.json';

// ── 2. Import command data ──
import { getCommand, searchCommands, getSubcommands } from '@enjoys/context-engine';

// =============================================
// REGISTER COMPLETION PROVIDER
// =============================================
monaco.languages.registerCompletionItemProvider('nginx', {
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    // Map data to Monaco CompletionItems
    const suggestions = nginxCompletions.completions.map((item) => ({
      label: item.label,
      kind: item.kind,                              // e.g. 15 = Snippet
      detail: item.detail,
      documentation: item.documentation?.value
        ? { value: item.documentation.value, isTrusted: true }
        : undefined,
      insertText: item.insertText,
      insertTextRules: item.insertTextRules,         // 4 = InsertAsSnippet
      sortText: item.sortText,
      range,
    }));

    return { suggestions };
  },
});

// =============================================
// REGISTER HOVER PROVIDER
// =============================================
monaco.languages.registerHoverProvider('nginx', {
  provideHover(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;

    const key = word.word.toLowerCase();
    const hover = nginxHovers.hovers[key];
    if (!hover) return null;

    return {
      range: new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      ),
      contents: hover.contents.map((c) => ({
        value: c.value,
        isTrusted: true,
        supportThemeIcons: true,
      })),
    };
  },
});

// =============================================
// REGISTER DEFINITION PROVIDER (Peek Definition)
// =============================================
monaco.languages.registerDefinitionProvider('nginx', {
  provideDefinition(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;

    const key = word.word.toLowerCase();
    const def = nginxDefinitions.definitions[key];
    if (!def) return null;

    // Search the document for the first occurrence of this keyword
    const text = model.getValue();
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const col = lines[i].indexOf(word.word);
      if (col !== -1) {
        return {
          uri: model.uri,
          range: new monaco.Range(i + 1, col + 1, i + 1, col + 1 + word.word.length),
        };
      }
    }
    return null;
  },
});

// =============================================
// SHOW DEFINITION INFO IN A CUSTOM WIDGET
// =============================================
// You can use definitions data to build a sidebar, tooltip, or panel:
function getDefinitionInfo(keyword) {
  const def = nginxDefinitions.definitions[keyword];
  if (!def) return null;
  return {
    signature: def.signature,     // e.g. "proxy_pass URL"
    description: def.description, // e.g. "Forwards requests to backend..."
    type: def.type,               // e.g. "directive"
    module: def.module,           // e.g. "ngx_http_proxy_module"
  };
}

// Example:
// getDefinitionInfo('proxy_pass')
// → { signature: "proxy_pass URL", description: "Sets the protocol and address...", type: "directive", module: "ngx_http_proxy_module" }
```

### Register Multiple Languages at Once

```js
import manifest from '@enjoys/context-engine/data/manifest.json';

// Dynamically register all 94 languages
for (const lang of manifest.languages) {
  const completionData = await import(`@enjoys/context-engine/${lang.files.completion}`);
  const hoverData = await import(`@enjoys/context-engine/${lang.files.hover}`);
  const defData = await import(`@enjoys/context-engine/${lang.files.definition}`);

  monaco.languages.registerCompletionItemProvider(lang.id, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: completionData.completions.map((item) => ({
          label: item.label,
          kind: item.kind,
          detail: item.detail,
          documentation: item.documentation?.value
            ? { value: item.documentation.value, isTrusted: true }
            : undefined,
          insertText: item.insertText,
          insertTextRules: item.insertTextRules,
          sortText: item.sortText,
          range,
        })),
      };
    },
  });

  monaco.languages.registerHoverProvider(lang.id, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const hover = hoverData.hovers[word.word.toLowerCase()];
      if (!hover) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: hover.contents.map((c) => ({ value: c.value, isTrusted: true })),
      };
    },
  });
}
```

### Register Additional Providers

```js
import codeActionsData from '@enjoys/context-engine/data/codeActions/typescript.json';
import codeLensData from '@enjoys/context-engine/data/codeLens/typescript.json';
import symbolData from '@enjoys/context-engine/data/documentSymbol/typescript.json';
import highlightData from '@enjoys/context-engine/data/documentHighlight/typescript.json';
import signatureData from '@enjoys/context-engine/data/signatureHelp/typescript.json';

// ── Code Actions (Quick Fix, Refactor) ──
monaco.languages.registerCodeActionProvider('typescript', {
  provideCodeActions(model, range, context) {
    return {
      actions: codeActionsData.codeActions.map((a) => ({
        title: a.title,
        kind: a.kind,
        diagnostics: [],
        isPreferred: a.isPreferred || false,
      })),
      dispose() {},
    };
  },
});

// ── Code Lens (References, Run Test) ──
monaco.languages.registerCodeLensProvider('typescript', {
  provideCodeLenses(model) {
    const lenses = [];
    const text = model.getValue();
    for (const pattern of codeLensData.codeLensPatterns) {
      const regex = new RegExp(pattern.pattern, 'gm');
      let match;
      while ((match = regex.exec(text))) {
        const line = model.getPositionAt(match.index).lineNumber;
        lenses.push({
          range: new monaco.Range(line, 1, line, 1),
          command: { id: pattern.commandId, title: pattern.title },
        });
      }
    }
    return { lenses, dispose() {} };
  },
});

// ── Document Symbols (Outline) ──
monaco.languages.registerDocumentSymbolProvider('typescript', {
  provideDocumentSymbols(model) {
    const symbols = [];
    const text = model.getValue();
    for (const sp of symbolData.symbolPatterns) {
      const regex = new RegExp(sp.pattern, 'gm');
      let match;
      while ((match = regex.exec(text))) {
        const pos = model.getPositionAt(match.index);
        const name = match[sp.captureGroup || 1] || match[0];
        symbols.push({
          name,
          kind: sp.kind,
          range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, model.getLineMaxColumn(pos.lineNumber)),
          selectionRange: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + name.length),
        });
      }
    }
    return symbols;
  },
});

// ── Signature Help ──
monaco.languages.registerSignatureHelpProvider('typescript', {
  signatureHelpTriggerCharacters: signatureData.triggerCharacters || ['(', ','],
  provideSignatureHelp(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word || !signatureData.signatures) return null;
    const sig = signatureData.signatures[word.word];
    if (!sig) return null;
    return {
      value: {
        signatures: [{
          label: sig.label,
          parameters: (sig.params || []).map((p) => ({ label: p.label, documentation: p.documentation })),
          documentation: sig.documentation,
        }],
        activeSignature: 0,
        activeParameter: 0,
      },
      dispose() {},
    };
  },
});
```

---

## Terminal Autocomplete — Command Engine API

Use the command engine to build intelligent terminal autocomplete (like Fig or Warp):

```js
import {
  getCommand,
  getAllCommands,
  listCommandNames,
  searchCommands,
  getCommandsByCategory,
  getCommandsByPlatform,
  getCategories,
  getContextEngine,
  getSubcommands,
  getGlobalOptions,
  getExamples,
  count,
} from '@enjoys/context-engine';
```

### `getCommand(name)`

Get a single command definition by name.

```js
const git = getCommand('git');
console.log(git.subcommands.map((s) => s.name));
// ['init', 'clone', 'add', 'commit', 'push', ...]
```

### `searchCommands(query)`

Search commands by name, description, or category (case-insensitive).

```js
searchCommands('docker');
// [{ name: 'docker', ... }, { name: 'docker-compose', ... }]

searchCommands('database');
// [{ name: 'psql', ... }, { name: 'mysql', ... }, { name: 'mongosh', ... }]
```

### `getSubcommands(name)`

```js
getSubcommands('systemctl');
// [{ name: 'start', description: 'Start (activate) one or more units', args: [...], examples: [...] },
//  { name: 'stop', ... }, { name: 'restart', ... }, { name: 'status', ... },
//  { name: 'enable', options: [{ name: '--now' }], ... }, ... ]  (35 subcommands)
```

### `getGlobalOptions(name)`

```js
getGlobalOptions('journalctl');
// [{ name: '-u', description: 'Show logs for a specific unit' },
//  { name: '-f', description: 'Follow — show new log entries' },
//  { name: '-n', description: 'Number of lines to show' }, ...]  (32 options)
```

### `getExamples(name)`

```js
getExamples('nginx');
// ['nginx -t', 'nginx -s reload', 'sudo nginx -t && sudo nginx -s reload', ...]
```

### `getContextEngine(name)`

Get runtime context detectors for a command — shell commands that gather live context.

```js
const ctx = getContextEngine('docker');
// {
//   detectors: [
//     { name: 'containers', command: 'docker ps ...', parser: 'lines', cacheFor: 10 },
//     { name: 'images', command: 'docker images ...', parser: 'lines', cacheFor: 30 },
//     ...
//   ]
// }
```

### `getCommandsByCategory(category)` / `getCommandsByPlatform(platform)`

```js
getCommandsByCategory('database');
// [psql, mysql, mongosh, sqlite3, redis-cli, cockroach, influx, clickhouse-client, ...]

getCommandsByPlatform('windows');
// [choco, winget, ...]
```

### `getCategories()`

```js
getCategories();
// ['Build Tools', 'Cloud CLIs', 'Container', 'Database', 'DevOps', ...]
```

### `count()`

```js
count(); // 256
```

### `resolveCommandPath(name)` / `dataDir`

```js
resolveCommandPath('git');
// '/path/to/node_modules/@enjoys/context-engine/data/commands/git.json'
```

### `clearCache()`

Clear the in-memory cache (useful in tests).

---

## Full Terminal Autocomplete Example

Build a terminal autocomplete that suggests subcommands, options, and uses context detectors:

```js
import { getCommand, getContextEngine, searchCommands } from '@enjoys/context-engine';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Run a context detector and cache results ──
const cache = new Map();

async function runDetector(detector) {
  const cached = cache.get(detector.name);
  if (cached && Date.now() - cached.time < (detector.cacheFor || 30) * 1000) {
    return cached.data;
  }

  try {
    const { stdout } = await execAsync(detector.command, { timeout: 5000 });
    let data;
    switch (detector.parser) {
      case 'lines': data = stdout.trim().split('\n').filter(Boolean); break;
      case 'json':  data = JSON.parse(stdout); break;
      default:      data = stdout.trim(); break;
    }
    cache.set(detector.name, { data, time: Date.now() });
    return data;
  } catch {
    return null;
  }
}

// ── Autocomplete function ──
async function getCompletions(inputLine) {
  const parts = inputLine.trim().split(/\s+/);
  const cmdName = parts[0];
  const cmd = getCommand(cmdName);
  if (!cmd) {
    // Suggest matching command names
    return searchCommands(cmdName).map((c) => ({
      label: c.name,
      detail: c.description,
    }));
  }

  // User typed "systemctl " — suggest subcommands
  if (parts.length === 1 || (parts.length === 2 && !parts[1].startsWith('-'))) {
    const items = cmd.subcommands.map((s) => ({
      label: s.name,
      detail: s.description,
    }));

    // Also add context detectors (e.g., running services, failed units)
    const ctx = getContextEngine(cmdName);
    if (ctx) {
      for (const detector of ctx.detectors) {
        const data = await runDetector(detector);
        if (Array.isArray(data)) {
          items.push(...data.map((d) => ({
            label: d,
            detail: `[${detector.name}]`,
          })));
        }
      }
    }
    return items;
  }

  // User typed "systemctl start " — suggest from detectors
  const subName = parts[1];
  const sub = cmd.subcommands.find((s) => s.name === subName);
  if (sub?.options) {
    return sub.options.map((o) => ({
      label: o.name,
      detail: o.description,
    }));
  }

  return cmd.globalOptions.map((o) => ({
    label: o.name,
    detail: o.description,
  }));
}

// Usage:
// await getCompletions('systemctl ')      → 35 subcommands + live context
// await getCompletions('systemctl start') → running/enabled services
// await getCompletions('docker ')         → subcommands + running containers
// await getCompletions('git ')            → subcommands + branches
```

---

## Direct JSON Import

Access raw JSON files directly:

```js
// Command data
const git = require('@enjoys/context-engine/commands/git.json');

// Language data
const nginxCompletion = require('@enjoys/context-engine/completion/nginx.json');
const nginxDefinition = require('@enjoys/context-engine/definition/nginx.json');
const nginxHover = require('@enjoys/context-engine/hover/nginx.json');

// Manifest (all languages)
const manifest = require('@enjoys/context-engine/data/manifest.json');
```

---

## Data Formats

### Completion Item (`data/completion/*.json`)

```json
{
  "language": "nginx",
  "completions": [
    {
      "label": "server block",
      "kind": 15,
      "detail": "Server block",
      "documentation": { "value": "Defines a virtual server." },
      "insertText": "server {\n    listen ${1:80};\n    server_name ${2:example.com};\n    ...\n}",
      "insertTextRules": 4,
      "sortText": "00_server"
    }
  ]
}
```

`kind` values (CompletionItemKind): `0` = Method, `1` = Function, `2` = Constructor, `3` = Field, `4` = Variable, `5` = Class, `6` = Struct, `7` = Interface, `8` = Module, `9` = Property, `10` = Event, `11` = Operator, `12` = Unit, `13` = Value, `14` = Constant, `15` = Enum, `16` = EnumMember, `17` = Keyword, `18` = Text, `19` = Color, `20` = File, `21` = Reference, `22` = Customcolor, `23` = Folder, `24` = TypeParameter, `25` = User, `26` = Issue, `27` = Tool, `28` = Snippet  
`insertTextRules`: `0` = None, `1` = KeepWhitespace, `4` = InsertAsSnippet (supports `${1:placeholder}` tab stops)

### Definition Item (`data/definition/*.json`)

```json
{
  "language": "nginx",
  "definitions": {
    "proxy_pass": {
      "signature": "proxy_pass URL",
      "description": "Sets the protocol and address of a proxied server.",
      "type": "directive",
      "module": "ngx_http_proxy_module"
    }
  }
}
```

### Hover Item (`data/hover/*.json`)

```json
{
  "language": "nginx",
  "hovers": {
    "server": {
      "contents": [
        {
          "value": "```nginx\nserver {\n    listen 80;\n    server_name example.com;\n    ...\n}\n```\n**server** block defines a virtual host."
        }
      ]
    }
  }
}
```

### Command Definition (`data/commands/*.json`)

```json
{
  "name": "systemctl",
  "description": "Control the systemd system and service manager",
  "category": "system",
  "platforms": ["linux"],
  "shells": ["bash", "zsh", "fish"],
  "subcommands": [
    {
      "name": "start",
      "description": "Start one or more units",
      "args": [{ "name": "<unit>", "type": "string", "required": true }],
      "examples": ["systemctl start nginx"]
    }
  ],
  "globalOptions": [
    { "name": "--no-pager", "description": "Do not pipe output into pager" }
  ],
  "examples": ["systemctl start nginx", "systemctl status nginx -l"],
  "relatedCommands": ["journalctl", "systemd-analyze"],
  "contextEngine": {
    "detectors": [
      {
        "name": "failed_units",
        "command": "systemctl --failed --no-legend --plain 2>/dev/null | head -20",
        "parser": "lines",
        "cacheFor": 10,
        "requiresCmd": "systemctl"
      }
    ]
  }
}
```

---

## Supported Languages (94)

Each language has up to 26 provider files — completions, hover, definitions, code actions, formatting, symbols, and more.

| Category | Languages |
|----------|-----------|
| **Web** | JavaScript, TypeScript, HTML, CSS, Less, SCSS, React, Angular, Next.js, Nest.js, Tailwind CSS |
| **UI / Templating** | Liquid, Twig, FreeMarker2, Razor, shadcn, MDX |
| **Systems** | C, C++, Rust, Go, Swift, Objective-C |
| **JVM** | Java, Kotlin, Scala, Clojure |
| **.NET** | C#, VB, Q# |
| **Scripting** | Python, Ruby, Perl, Lua, PHP, Elixir, CoffeeScript, R |
| **Shell** | Shell/Bash, PowerShell, AWK, Azure CLI |
| **Functional** | Scheme, Julia, CameLIGO, PascaLIGO, Dart |
| **Database / Query** | SQL, MySQL, PostgreSQL, Redshift, Redis, redis-cli, Cypher, SPARQL |
| **Config / Infrastructure** | Dockerfile, Docker Compose, YAML, TOML, JSON, XML, INI, Dotenv, SSH Config, HCL, Makefile, Nginx, systemd, Caddy |
| **Docs / Markup** | Markdown, MDX, reStructuredText |
| **Data / BI** | MSDAX, Power Query, GraphQL |
| **Blockchain** | Solidity, Lexon, Bicep |
| **Hardware / Low-Level** | MIPS, SystemVerilog, WGSL, Structured Text |
| **Enterprise / Niche** | ABAP, Apex, ECL, Flow9, M3, Pascal, PLA, Postiats, SB |
| **Other** | Crontab, Protobuf, Doctest |

## Covered Commands (270)

| Category | Tools |
|----------|-------|
| **Cloud CLIs & APIs** | aws, az, gcloud, doctl, linode-cli, vercel, netlify, firebase, supabase, railway, render, flyctl, cloudflare, aws-vault, auth0, stripe, twilio, apex (Salesforce) |
| **Containers & Orchestration** | docker, docker-compose, dockerfile, kubectl, helm, minikube, k9s |
| **Version Control** | git, gh, glab, svn, hg |
| **Node.js Ecosystem** | node, npm, npx, yarn, pnpm, bun, deno, eslint, prettier, tsc, turbo, nx, vite, next, nest |
| **Frameworks** | angular, react, nextjs, nestjs, nuxt, vue, shadcn, tailwindcss, rails, artisan |
| **Python Ecosystem** | python, pip, pipx, poetry, pipenv, conda, pytest, uvicorn, gunicorn, django-admin, flask, locust |
| **Rust & Go** | rust, cargo, rustup, wasm-pack, go, gofmt, golangci-lint, air |
| **Java/JVM** | java, gradle, mvn, kotlin, scala, clojure |
| **PHP** | php, composer, artisan, symfony, wp |
| **Ruby** | ruby, gem, bundle, rails, rake, rspec, pod, fastlane |
| **Mobile** | adb, dart, flutter, expo, react-native, xcodebuild, fastlane |
| **Database** | sql, psql, pgsql, pg_dump, pg_restore, mysql, mongosh, redis, redis-cli, sqlite3, cockroach, influx, clickhouse-client, cypher, redshift |
| **Database ORMs/Migrations** | prisma, drizzle-kit, typeorm, sequelize, alembic, dbmate, flyway, liquibase, atlas |
| **DevOps & Infrastructure** | terraform, terragrunt, pulumi, packer, vault, consul, nomad, ansible |
| **Web Servers** | nginx, caddy, httpd, apachectl |
| **System & Monitoring** | systemctl, journalctl, systemd-analyze, systemd, pm2, tmux, screen, htop, btop, top, ps, linux, crontab, powershell |
| **Build Tools** | make, makefile, cmake, bazel, just, gradle |
| **Linux Core** | ls, cp, mv, rm, cat, find, tar, chmod, chown, cd, sudo, scp, unzip, zip, ufw, iptables, nft |
| **Network & Security** | ssh, ssh-keygen, curl, wget, rsync, nmap, tcpdump, wireshark, openssl, certbot, snyk, trivy, sonar-scanner, ssh_config |
| **Package Managers** | apt, apt-get, yum, dnf, pacman, brew, choco, winget, pipx, composer, bundle |
| **Testing** | jest, vitest, mocha, playwright, cypress, k6, locust |
| **Text Processing & Utilities** | grep, sed, awk, jq, yq, bat, cat, fd, fzf, rg |
| **Text Editors** | nvim, vim |
| **Languages & Compilers** | c (gcc), cpp (g++), javascript, typescript, csharp, objective-c, swift, perl, lua, r, scheme, julia, pascal, tcl, vb, qsharp, elixir, coffee, kotlin, scala, clojure |
| **Config & Data Tools** | json, xml, yaml, toml, ini, hcl, dotenv, markdown, mdx, restructuredtext, protobuf, graphql, scss, less, css, html, liquid, twig, razor, freemarker2 |
| **Niche & Specialized** | abap, bicep, azcli, cameligo, pascaligo, ecl, flow9, lexon, m3, mips, msdax, pla, postiats, powerquery, sb, sol, sparql, st, systemverilog, wgsl, doctest |

## Context Engine

Each command can include a `contextEngine` with runtime `detectors` — shell commands that gather live context (running containers, git branches, installed packages, etc.) for intelligent autocomplete:

```js
const { getContextEngine } = require('@enjoys/context-engine');

const ctx = getContextEngine('systemctl');
// {
//   detectors: [
//     { name: 'failed_units', command: 'systemctl --failed ...', parser: 'lines', cacheFor: 10 },
//     { name: 'running_services', command: 'systemctl list-units ...', parser: 'text', cacheFor: 15 },
//     { name: 'active_timers', command: 'systemctl list-timers ...', parser: 'lines', cacheFor: 30 },
//     ...
//   ]
// }
```

**Parser types:** `text` | `lines` | `json` | `csv` | `keyvalue` | `regex` | `table`

## All 26 Monaco Provider Types — Shipped

Every provider below is fully implemented for all 94 languages with spec-compliant JSON data:

| Provider | Registration Method | Data Key |
|----------|-------------------|----------|
| Completion | `registerCompletionItemProvider` | `completions[]` |
| Hover | `registerHoverProvider` | `hovers{}` |
| Definition | `registerDefinitionProvider` | `definitions{}` |
| Code Actions | `registerCodeActionProvider` | `codeActions[]` |
| Code Lens | `registerCodeLensProvider` | `codeLensPatterns[]` |
| Color | `registerColorProvider` | `colorPatterns[]` |
| Declaration | `registerDeclarationProvider` | `declarations{}` |
| Document Highlight | `registerDocumentHighlightProvider` | `highlights{}` |
| Document Symbol | `registerDocumentSymbolProvider` | `symbolPatterns[]` |
| Document Range Formatting | `registerDocumentRangeFormattingEditProvider` | `formatting{}` |
| Folding Range | `registerFoldingRangeProvider` | `foldingRules[]` |
| Formatting | `registerDocumentFormattingEditProvider` | `formatting{}` |
| Implementation | `registerImplementationProvider` | `implementations{}` |
| Inlay Hints | `registerInlayHintsProvider` | `inlayHints[]` |
| Inline Completions | `registerInlineCompletionsProvider` | `inlineCompletions[]` |
| Linked Editing Range | `registerLinkedEditingRangeProvider` | `linkedEditingPatterns[]` |
| Links | `registerLinkProvider` | `linkPatterns[]` |
| On-Type Formatting | `registerOnTypeFormattingEditProvider` | `formatting{}` |
| Range Semantic Tokens | `registerDocumentRangeSemanticTokensProvider` | `tokenTypes[]` |
| References | `registerReferenceProvider` | `referencePatterns[]` |
| Rename | `registerRenameProvider` | `renameValidation{}` |
| Selection Range | `registerSelectionRangeProvider` | `selectionRanges{}` |
| Semantic Tokens | `registerDocumentSemanticTokensProvider` | `tokenTypes[]` |
| Signature Help | `registerSignatureHelpProvider` | `signatures{}` |
| Type Definition | `registerTypeDefinitionProvider` | `typeDefinitions{}` |
| Commands (CLI) | Custom API | `subcommands[]`, `globalOptions[]` |

## License

MIT © Enjoys Inc
