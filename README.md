# @enjoys/context-engine

Comprehensive CLI command context engine with **190 tools** and **35 languages** — completions, definitions, hovers, subcommands, options, examples, and runtime context detectors for intelligent terminal autocomplete in Monaco Editor.

## Why Context Engine?

Traditional LSP (Language Server Protocol) setups require a backend server running a separate language server process for every language you want to support. Each language server needs its own binary installed — Go, Rust, Python, TypeScript, and so on. At scale, this makes the backend **heavy**, memory-hungry, and CPU-intensive. Supporting all languages can easily consume **1 GB+** of disk space and significant runtime resources just to keep those servers alive.

Context Engine takes a fundamentally different approach. Instead of running language servers on the backend, it ships **pre-built, Monaco-compatible JSON data** loaded directly via API — completions, hover docs, definitions, and 190 CLI command definitions — all in a single package under **~100 MB**. No language binaries to install. No background processes to manage. No backend required for intelligence.

> **Note:** Context Engine does not provide path-based intelligence (file resolution, go-to-definition across files, etc.) the way a full LSP does. It focuses on **language-aware completions, hover documentation, inline definitions, and terminal command autocomplete** — the features that matter most in web-based terminal and editor experiences, without the infrastructure overhead.

## Install

```bash
npm install @enjoys/context-engine
```

## What's Inside

```
data/
├── commands/        # 190 CLI tool definitions (git, docker, kubectl, nginx, systemctl, ...)
│   └── *.json       # subcommands, options, examples, context detectors
├── completion/      # 35 languages — Monaco completions (snippets, insertText)
│   └── *.json       # ready-to-use CompletionItem[] for Monaco
├── defination/      # 35 languages — definitions (signatures, descriptions)
│   └── *.json       # keyword → { signature, description, type }
├── hover/           # 35 languages — hover documentation
│   └── *.json       # keyword → { contents: [{ value }] }
└── manifest.json    # Language registry with file mappings
```

---

## Quick Start — Full Monaco Integration

This single example registers **completions**, **hover**, **definitions**, and **command-line autocomplete** for any language:

```js
import * as monaco from 'monaco-editor';

// ── 1. Import language data (e.g., nginx) ──
import nginxCompletions from '@enjoys/context-engine/completion/nginx.json';
import nginxDefinitions from '@enjoys/context-engine/defination/nginx.json';
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

// Dynamically register all 35 languages
for (const lang of manifest.languages) {
  const completionData = await import(`@enjoys/context-engine/${lang.files.completion}`);
  const hoverData = await import(`@enjoys/context-engine/${lang.files.hover}`);
  const defData = await import(`@enjoys/context-engine/${lang.files.defination}`);

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
count(); // 190
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
const nginxDefinition = require('@enjoys/context-engine/defination/nginx.json');
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

`kind` values: `15` = Snippet, `5` = Field, `14` = Keyword, `9` = Function, `12` = Value, `6` = Variable  
`insertTextRules`: `4` = InsertAsSnippet (supports `${1:placeholder}` tab stops)

### Definition Item (`data/defination/*.json`)

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

## Supported Languages (35)

| Category | Languages |
|----------|-----------|
| **Systems** | C, C++, Rust, Go |
| **Web** | JavaScript, TypeScript, HTML, PHP, Ruby, Python, Java, C#, Lua, Perl |
| **Config** | Nginx, Systemd, Dockerfile, YAML, TOML, JSON, XML, INI, Dotenv, SSH Config, Crontab, HCL, Makefile |
| **Shell** | Bash, Zsh, PowerShell, Awk |
| **Data** | SQL, GraphQL, Protobuf |
| **Docs** | Markdown |

## Covered Commands (190)

| Category | Tools |
|----------|-------|
| **Cloud CLIs** | aws, az, gcloud, doctl, linode-cli, vercel, netlify, firebase, supabase, railway, render, flyctl, cloudflare, aws-vault, auth0, atlas |
| **Container & Orchestration** | docker, docker-compose, kubectl, helm, minikube, k9s |
| **Version Control** | git, gh, glab, svn, hg |
| **Node.js Ecosystem** | node, npm, npx, yarn, pnpm, bun, deno, turbo, nx, vite, next, nest, nuxt, vue, expo, tsc, eslint, prettier |
| **Python Ecosystem** | python, pip, pipx, poetry, pipenv, conda, pytest, uvicorn, gunicorn, django-admin, flask, alembic, locust |
| **Rust & Go** | cargo, rustup, wasm-pack, go, gofmt, golangci-lint, air |
| **Java/JVM** | java, gradle, mvn |
| **PHP** | php, composer, artisan |
| **Ruby** | gem, bundle, rails, pod, fastlane |
| **Database** | psql, pg_dump, pg_restore, mysql, mongosh, redis-cli, sqlite3, cockroach, influx, clickhouse-client, dbmate, liquibase, flyway, drizzle-kit, prisma |
| **DevOps & Infrastructure** | terraform, terragrunt, pulumi, packer, vault, consul, nomad, ansible |
| **Web Servers** | nginx, caddy, httpd, apachectl |
| **System** | systemctl, journalctl, systemd-analyze, zsh, pm2, tmux, htop, btop, nvim |
| **Build Tools** | make, cmake, bazel, just, bat |
| **Linux Core** | ls, cp, mv, rm, cat, grep, find, sed, awk, tar, chmod, chown, ps, sudo, ssh, ssh-keygen, rsync, curl, wget, cd, scp, linux |
| **Network & Security** | nmap, tcpdump, wireshark, openssl, certbot, ufw, iptables, nft |
| **Package Managers** | apt, apt-get, yum, dnf, pacman, brew, choco, winget, pipx |
| **Testing** | jest, vitest, mocha, playwright, cypress, k6, locust |
| **CI/CD** | stripe, adb |

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

## Upcoming Monaco Provider Support

The following Monaco providers are planned for future releases, bringing Context Engine closer to full LSP-level intelligence — all without a backend:

| Provider | Status |
|----------|--------|
| `registerCodeActionProvider` | 🔜 Planned |
| `registerDocumentHighlightProvider` | 🔜 Planned |
| `registerDocumentSymbolProvider` | 🔜 Planned |
| `registerLinkProvider` | 🔜 Planned |
| `registerTypeDefinitionProvider` | 🔜 Planned |
| `registerReferenceProvider` | 🔜 Planned |
| `registerImplementationProvider` | 🔜 Planned |
| `registerInlineCompletionsProvider` | 🔜 Planned |
| `registerDocumentFormattingEditProvider` | 🔜 Planned |
| `registerCodeLensProvider` | 🔜 Planned |
| `registerColorProvider` | 🔜 Planned |
| `registerDeclarationProvider` | 🔜 Planned |
| `registerInlayHintsProvider` | 🔜 Planned |

## License

MIT © Enjoys Inc
