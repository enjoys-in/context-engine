# Terminal autocomplete with xterm.js

How to build inshellsense-style staged completion — `git checkout ⇥` lists your real
branches, you pick one, it advances to the next argument — on top of the data in
`data/commands/`.

This is a guide, not a dependency. The package ships **data and lookups only**; it never
executes anything and has no opinion about your UI.

---

## What xterm.js does and does not give you

xterm.js is a character grid plus a keystroke pipe. It has no notion of a command, a
completion, or a menu. It will never get in your way, and it will never help you either.

Everything below is yours to build. The one thing xterm.js does provide that matters is
**`attachCustomKeyEventHandler`** — return `false` from it and the keystroke is swallowed
before the terminal or the shell sees it. That is the hook the whole feature hangs on.

---

## Pick your architecture first

This single decision determines how much work the rest is.

### A. You own the prompt

You render a prompt, hold the line buffer in JavaScript, and only send finished commands
somewhere to run.

**Recommended.** Everything here is straightforward: you already know the cursor position
and the text, so Tab is just a function call, and a completion menu is just state.

### B. xterm.js is attached to a real shell over a PTY

The shell owns the line editor. Keystrokes go through the PTY to `readline`/`zle` and never
reach your code, so Tab is bash's, not yours. Three ways out, in increasing invasiveness:

| Approach | Cost |
|---|---|
| **Generate shell completion scripts** from this data (bash-completion, zsh `compsys`) | Reliable and native, but the UI is the shell's. `zsh` menu-select is decent; bash is weak. No staged picker. |
| **Bind one key to a widget** (fzf-style) that calls your engine and inserts the result | Small, robust, keeps the shell's line editor intact. Best value for effort in case B. |
| **Intercept before the PTY** — buffer the line yourself, swallow Tab, write resolved text down | Full control, but you are re-implementing line editing. It fights history, multiline, vi mode, and any full-screen program (`vim`, `less`) that wants raw input. |

If you are in case B and want the staged UX, use the widget approach. Do not try to shadow
the shell's line editor unless you are prepared to own that complexity permanently.

---

## The staged flow

Progressive completion needs **no new structure**. `args` is an ordered array, so the flow
is a walk over it.

```
git checkout ⇥
  │
  ├─ parse the line        → command "git", subcommand "checkout", cursor at positional 0
  ├─ look up the slot      → args[0] = { name:"<branch>", type:"branch",
  │                                      completion:{ detector:"local_branches" } }
  ├─ resolve values        → run that detector, parse stdout per `parser`
  ├─ user picks            → insert the chosen value
  └─ advance to args[1]    → repeat, or run the command if no args remain
```

Four states are enough: `IDLE → COLLECTING → MENU_OPEN → DONE`. While `MENU_OPEN`, swallow
Tab, arrows, Enter and Escape in your key handler so neither xterm.js nor the shell reacts.

### Parsing the line

You need three things from the typed text: the command, how deep into the subcommands you
are, and which positional the cursor sits on.

Two shapes in the data affect this:

- **771 subcommand names are space-encoded** — `"docker network ls"`, `"create deployment"`,
  relative to the binary with no prefix. So the subcommand step is **not** always a tree.
  Match greedily: try the longest space-joined prefix of the typed words against the
  subcommand names before falling back to shorter ones.
- **194 nodes have real nested `subcommands[]`**, and 4,334 names are flat.

All three forms coexist by design. Resolve names by longest match and you handle all of them
with one code path.

Count positionals *after* stripping recognised flags — use `takesValue` on each option to
know whether the next word is that flag's value rather than a positional.

---

## Resolving values

```js
const { getCommand, getContextEngine } = require('@enjoys/context-engine');
```

An arg slot that can be completed from live state carries a `completion` object naming a
detector **in the same file**:

```jsonc
{
  "name": "<branch>",
  "type": "branch",
  "required": false,
  "description": "Branch or commit to switch to",
  "completion": { "detector": "local_branches" }
}
```

Look the name up in that command's `contextEngine.detectors`, run its `command`, and parse
stdout according to `parser`.

The detector is chosen per **slot**, not per type, because the useful values depend on the
verb: `docker stop` wants `running_containers`, `docker start` wants `all_containers`. Do
not build a global `type → detector` table; it cannot express that.

### Not every slot is completable, and that is correct

Of 1,963 arg slots:

| | count | how to complete |
|---|---:|---|
| `file` / `path` / `directory` | 431 | your own filesystem picker — no detector needed |
| enumerable runtime value | ~481 | run the linked detector |
| free-form (commit messages, SQL, expressions) | ~1,051 | no completion; show `description` as a hint |

For the free-form majority, showing the arg's `description` and `required` flag as inline
hint text is the whole feature. Do not chase completion for them.

---

## Running detectors

**This is the part to get right.** Detector `command` values are shell commands, and this
package does not run them — there is no `child_process` anywhere in it. Execution is
entirely yours.

### Where they run

A detector must execute wherever the filesystem and processes it inspects actually live:

- **Local Node/Electron host** — run it directly.
- **Browser xterm.js talking to a remote host** — the command must run *on that host*, over
  your PTY or a side channel. `git branch` in the page is meaningless.
- **Container or SSH session** — run it in the same context the user's commands run in, or
  the values will describe the wrong machine.

### Latency and caching

Every detector declares `cacheFor` in seconds. Honour it — it is the difference between a
usable prompt and one that shells out on every keystroke. The values are set by volatility:

| kind | typical `cacheFor` |
|---|---|
| `--version` probes | 3600 |
| config / profile reads | 300 |
| branches, namespaces, images | 10–60 |
| running containers, git status | 3–15 |

Key the cache on `(command, detector, cwd)` — `git branch` means something different in
another repository. Invalidate on directory change.

`requiresCmd` (present on 462 of 2,446 detectors) names a binary that must exist. Check it
first and skip the probe entirely when absent; that is cheaper than running and failing.

Run detectors **off the keystroke path**. Fire on Tab, or debounce, never per character.

### Safety — read this before you wire execution

Every one of the 2,446 shipped detectors is a read-only probe, and `npm run validate`
enforces it: the build fails on any detector that mutates state or redirects to a file. That
check earned its place immediately — it caught `winget upgrade` in already-committed data,
which installs packages rather than listing them.

That guarantee covers **the data as shipped**. It is not a sandbox. If you execute these
strings, then:

- Run them with the user's own privileges, never elevated.
- Do not interpolate anything the user typed into a detector command. Detectors take no
  parameters by design; keep it that way.
- Re-run `npm run validate` after any upgrade of this package if you execute detectors
  without review.
- Prefer a fixed timeout per probe. A hung `kubectl` against an unreachable cluster should
  degrade to "no suggestions", not a frozen prompt.

---

## Rendering the menu

**Overlay a DOM element. Do not draw into the terminal grid.**

xterm.js exposes the cursor's row and column and the character cell dimensions, which is
enough to absolutely-position a floating list at the cursor. This is far simpler than
emitting escape sequences, and much simpler than switching to the alternate buffer and
restoring it — that route means you own redraw, resize and scroll behaviour forever.

Practical notes:

- Reposition on `onResize` and on scroll, or the menu detaches from the cursor.
- Cap the list and make it scrollable. Some detectors return hundreds of lines.
- Show the arg's `description` as a header — it tells the user what the slot *is*, which
  matters when the values are opaque ids.
- Show `required: false` differently: the user can legitimately press Enter and skip it.

---

## Suggested build order

1. **Static completion only** — command names, then subcommands (longest-match), then flags
   from `options`/`globalOptions`. No execution, no detectors. This alone is most of the
   perceived value and has no safety surface.
2. **Inline arg hints** — show `description` and `required` for the current positional.
   Still no execution.
3. **Detector-backed values** — add the cache, `requiresCmd` checks and timeouts, then wire
   `completion.detector`. Start with one command you use constantly (`git`, `docker`,
   `kubectl`) and expand once the caching behaves.
4. **Staged multi-arg walking** — advance through `args` after each pick.

Steps 1 and 2 need no execution at all, so ship them first and take your time over step 3.

---

## API surface you need

| function | returns |
|---|---|
| `getCommand(name)` | the whole command object, alias-resolved |
| `resolveCommandName(name)` | canonical name for an alias — `hx` → `helix`, `pip3` → `pip`, `cc` → `gcc` |
| `getSubcommands(name)` | that command's `subcommands[]` |
| `getGlobalOptions(name)` | flags valid at any position |
| `getContextEngine(name)` | `{ detectors: [...] }` or `null` |
| `listCommandNames()` | all 612 canonical names — the first completion stage |
| `searchCommands(q)` | fuzzy match over name, description and category |
| `getCommandsByCategory(c)` / `getCategories()` | for grouping in the UI |
| `getExamples(name)` | example invocations as `{command, description}`, for a hint row |
| `getAllExamples(name)` | that command's examples **and its subcommands'**, each tagged with `subcommand` |

Only 23 commands declare aliases, so `resolveCommandName` is a cheap no-op for the rest —
call it unconditionally rather than branching.

See `README.md` § *Terminal Autocomplete — Command Engine API* for signatures.
