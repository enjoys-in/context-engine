# @enjoys/context-engine

Comprehensive CLI command context engine with **133 tools** — subcommands, options, examples, and runtime context detectors for intelligent terminal autocomplete.

## Install

```bash
npm install @enjoys/context-engine
```

## Usage

### CommonJS

```js
const {
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
} = require("@enjoys/context-engine");
```

### ESM

```js
import {
  getCommand,
  getAllCommands,
  searchCommands,
  count,
} from "@enjoys/context-engine";
```

## API

### `getCommand(name)`

Get a single command definition by name.

```js
const git = getCommand("git");
console.log(git.subcommands.map((s) => s.name));
// ['init', 'clone', 'add', 'commit', 'push', ...]
```

### `getAllCommands()`

Return all 133 command objects as an array.

### `listCommandNames()`

Return sorted array of all command names.

```js
listCommandNames();
// ['air', 'ansible', 'apachectl', 'apt', 'apt-get', 'awk', 'aws', ...]
```

### `searchCommands(query)`

Search commands by name, description, or category (case-insensitive).

```js
searchCommands("docker");
// [{ name: 'docker', ... }]

searchCommands("testing");
// [{ name: 'jest', ... }, { name: 'vitest', ... }, ...]
```

### `getCommandsByCategory(category)`

Filter by category (case-insensitive partial match).

```js
getCommandsByCategory("database");
// [psql, mysql, mongosh, sqlite3, redis-cli, ...]
```

### `getCommandsByPlatform(platform)`

Filter by platform: `"linux"` | `"macos"` | `"windows"`.

```js
getCommandsByPlatform("windows");
// [choco, winget, ...]
```

### `getCategories()`

Return all unique category names.

```js
getCategories();
// ['Build Tools', 'Cloud CLIs', 'Database', ...]
```

### `getContextEngine(name)`

Get runtime context detectors for a command.

```js
const ctx = getContextEngine("docker");
// { detectors: [{ name: 'containers', command: 'docker ps ...', parser: 'lines', ... }] }
```

### `getSubcommands(name)`

```js
getSubcommands("git");
// [{ name: 'init', description: '...', options: [...] }, ...]
```

### `getGlobalOptions(name)`

```js
getGlobalOptions("curl");
// [{ name: '-X', description: 'HTTP method', ... }, ...]
```

### `getExamples(name)`

```js
getExamples("docker");
// [{ command: 'docker run -d nginx', description: 'Run nginx in background' }, ...]
```

### `count()`

```js
count(); // 133
```

### `resolveCommandPath(name)`

Get absolute filesystem path to a command's JSON file.

```js
resolveCommandPath("git");
// '/path/to/node_modules/@enjoys/context-engine/data/commands/git.json'
```

### `dataDir`

Absolute path to the commands directory.

### `clearCache()`

Clear the in-memory cache (useful in tests).

## Direct JSON Import

Access raw JSON files directly:

```js
const git = require("@enjoys/context-engine/commands/git.json");
```

## Covered Tools (133)

| Category | Tools |
|----------|-------|
| **Cloud CLIs** | aws, az, gcloud, doctl, linode-cli, vercel, netlify, firebase, supabase, railway, render, flyctl, cloudflare, aws-vault |
| **Container & Orchestration** | docker, kubectl, helm |
| **Version Control** | git, gh, glab, svn, hg |
| **Node.js Ecosystem** | node, npm, npx, yarn, pnpm, bun, deno, turbo, nx, vite, next, nest, tsc, eslint, prettier |
| **Python Ecosystem** | python, pip, pipx, poetry, pipenv, conda, pytest, uvicorn, gunicorn, django-admin, flask |
| **Rust & Go** | cargo, rust, rustup, wasm-pack, go, gofmt, golangci-lint, air |
| **Java/JVM** | java, gradle, mvn |
| **Database** | psql, pg_dump, pg_restore, mysql, mongosh, redis-cli, sqlite3, cockroach, influx, clickhouse-client |
| **DevOps & Infrastructure** | terraform, terragrunt, pulumi, packer, vault, consul, nomad, ansible |
| **Web Servers** | nginx, caddy, httpd, apachectl |
| **Build Tools** | make, cmake, bazel, just |
| **Linux Core** | ls, cp, mv, rm, cat, grep, find, sed, awk, tar, chmod, chown, ps, sudo, ssh, ssh-keygen, rsync, curl, wget, systemctl, cd, zip, unzip, scp, journalctl, ufw, iptables, nft |
| **Testing** | jest, vitest, mocha, playwright, cypress, k6, locust |
| **Network & Security** | nmap, tcpdump, wireshark, openssl, certbot |
| **Package Managers** | apt, apt-get, yum, dnf, pacman, brew, choco, winget |

## Context Engine

Each command includes a `contextEngine` with runtime `detectors` — shell commands that gather live context (running containers, git branches, installed packages, etc.) for intelligent autocomplete:

```json
{
  "contextEngine": {
    "detectors": [
      {
        "name": "branches",
        "description": "Local git branches",
        "command": "git branch --format='%(refname:short)'",
        "parser": "lines",
        "cacheFor": 30,
        "requiresCmd": "git"
      }
    ]
  }
}
```

**Parser types:** `text` | `lines` | `json` | `csv` | `keyvalue` | `regex` | `table`

## License

MIT © Enjoys Inc
