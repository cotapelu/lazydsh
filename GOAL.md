# GOAL.md — Project Context & Goals

## Overview

**lazydsh** is a standalone TUI for **DeepSeek Harness (DSH)**: a lazier terminal
UI that boots the DSH profile in-process and gives it a pi-coding-agent-grade
interactive shell. It is not a DSH plugin — no version coupling with a host
installation, no Office dependencies.

Goals, in order:

1. **Fast to first frame** — two-phase boot, ~122 ms cold start.
2. **Complete interactive experience** — every advertised key, panel, and state
   actually works (claims are audited against code; see TODO.md §8.14/§8.19).
3. **Standalone & provider-independent** — any pi-ai provider, credentials
   resolved by DSH services.
4. **Replay-safe** — session log drives identical rows on live and resume paths.

## Stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Runtime  | `@deepseek-ai/dsh-base` profile (101 rows) + 11 extra services   |
| UI       | `@earendil-works/pi-tui`, token-based theming with DA1 sync      |
| Language | TypeScript ESM (Node ≥ 24.9), single-file bundle via `vite-plus` |
| Tests    | vitest — 150/150                                                 |

## Design Principles

1. **No reimplementation of DSH internals** — tools, auth, sessions, sandbox,
   compaction belong to the profile.
2. **Deferred plugins** — the shell paints before the 100-odd rows load; only the
   14 services the TUI needs are eager.
3. **Provider-neutral tool UI** — tools declare render intent; the UI maps to
   components (`detail.ts`, replay-safe).
4. **Token theming** — no hardcoded ANSI; user themes validated on load; the
   selection (name or auto light/dark pair) persists.
5. **Every claim verified** — documentation is corrected against the code in the
   same commit that changes behavior (§8.9–§8.19 pattern).
6. **3 layers + contracts** — FE never reaches into BE types; BE never imports UI.

## Current State

**Core complete, UX gaps remain** (see TODO.md phase history + AUDIT.md). 150/150 tests, `check` and `build` clean.

- **Core interactive parity** with pi-coding-agent's documented feature set.
- 25 app keybindings wired; Ctrl+C 4-state machine; suspend/resume; model cycling.
- Live status rows for retry/compaction; footer with git, providers, extension statuses.
- Persistence: keybindings, theme (name/auto pair), UI settings, model choice.
- Bash mode (`!` / `!!`) wired via DSH shell executor.

**Known UX gaps (see AUDIT.md §4):**

Implemented (code exists):

- P0: Boot progress indicator; history virtualization; fake OAuth options fixed; tool streaming wired.
- P1: Footer git watcher (FSWatcher); Theme DA1 async; Ctrl+C simplified; auth silent retry fixed.
- P2: Nested panels global ESC; Mermaid streaming enabled.

Remaining (not implemented in code):

- P2: BashExecutionComponent for tool calls; model selector test connection.
- P3: History search/filter; footer cost breakdown; session selector multi-delete; theme creator UI.

## Layer Layout

Applied (CAUTRUC.md): `interactive-mode/` (TUI, `components/`, `theme/`),
`runtime/` (DSH bridge + boot), `utils/` (pure), root contracts
(`interfaces.ts`, `runtime-events.ts`) and wiring (`cli.ts`, `plugin.ts`,
`types.ts`).

## Comparison with pi-coding-agent interactive mode

lazydsh's interactive-mode is a **port** of pi-coding-agent's `modes/interactive/`.
Full comparison (all reference files + 84 lazydsh files read):

### ✅ Parity (lazydsh = reference)

- Core orchestration (ui.ts / InteractiveMode class)
- Keyboard shortcuts (27 actions: Ctrl+C/D/Z/X/G/T, Alt+Enter/Up, `!`/`!!`)
- Theme system (tokens, DA1 terminal query, auto light/dark, user themes, watcher)
- Settings (settings-selector, settings-store) — simplified but functional
- Login/OAuth (login-dialog, oauth-selector, cli-auth — one path for TUI and CLI)
- Model selector (fuzzy, scoped/all, current marker, default badge, Ctrl+S)
- Session selector (DSH-native: tree, search with `re:`/`"exact"`, scope/sort/name/path)
- Approval panel (operation preview, expandable details)
- Question panel (multi-question, multi-select, height budget)
- History rows (reasoning, tool rows, metrics)
- Detail engine (arguments, diff, output)
- Tool cards (tools.ts + detail.ts)
- Bash execution (streaming, truncation, expand)
- Assistant/user messages (markdown, thinking, OSC 133 zones)
- Footer (pwd, git, tokens, cache, cost, context, model, thinking, routed, extension statuses)
- Header (logo, version, key hints, changelog)
- Program status (OSC 7501)
- Session share (Radius + gist)
- Bug report
- Clipboard, syntax highlight, streaming markdown
- Autocomplete, presentation (editor/status/transcript)
- Status container, TUI renderer, external editor, console capture

### ❌ Missing (gaps vs reference)

| #   | Feature                 | Priority      | Notes                                                                                          |
| --- | ----------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Mermaid streaming       | P2            | Disabled during streaming (raw markdown shown); `mermaid.ts` exists but inactive during stream |
| 2   | Session tree view       | P2            | Navigation, folding, filtering, labeling, copying                                              |
| 3   | Scoped models           | P2            | Toggle models for Ctrl+P cycling, reorder, persist                                             |
| 4   | Skill invocation UI     | P2            | Render skill blocks with expand/collapse                                                       |
| 5   | Config selector         | P2            | Resource management (extensions/skills/prompts/themes)                                         |
| 6   | Radius MCP              | P3 (niche)    | Radius MCP integration with animated shimmer                                                   |
| 7   | Easter eggs / mascot    | P3 (cosmetic) | armin, easter-egg-3d, earendil-announcement                                                    |
| 8   | Pi logo                 | P3 (cosmetic) | Half-block logo with Apple Terminal fallback                                                   |
| 9   | Custom editor           | P3            | Extends Editor with app keybindings                                                            |
| 10  | Extension system (full) | Out of scope  | Needs real API design                                                                          |
| 11  | Commands                | P2            | `/clone`, `/import`, `/reload`, `/debug`, `/hotkeys`, `/tree`, `/scoped`, `/trust`, `/skill:*` |
| 12  | Settings (full)         | P2            | 40+ items vs lazydsh's 10 (DSH-delegated)                                                      |

### ⚠️ Code smells (fixed)

| #   | Issue                                   | Status                                                  |
| --- | --------------------------------------- | ------------------------------------------------------- |
| 1   | `messageCount: 0`                       | ✅ Fixed — now counts user messages from session events |
| 2   | `footer.ts` inline `homedir()`          | ✅ Fixed — imports from `node:os`                       |
| 3   | `getSessionPathKey` no canonicalization | ✅ Fixed — canonicalizes + case-insensitive on Windows  |
| 4   | `ScopedModel` missing `thinkingLevel`   | ✅ Fixed — added optional field                         |
| 5   | TODO.md stale (bash mode)               | ✅ Fixed — bash mode wired (§8.20)                      |
| 6   | `safeSessionName` always undefined      | ⚠️ Dead code (low impact)                               |
| 7   | `widthForLabel` hoisting                | ⚠️ Works (unusual)                                      |
| 8   | `ui.ts` ~2336 lines                     | ⚠️ Maintainability                                      |
| 9   | `connect()` many params                 | ⚠️ Maintainability                                      |
| 10  | `ask()` / `select()` race condition     | ⚠️ By design                                            |
| 11  | `sessionManager` getter fallback        | ⚠️ Low risk                                             |
| 12  | `settings-selector.ts` simplified       | ⚠️ DSH-delegated                                        |
| 13  | `session-selector-search.ts` simplified | ⚠️ Search quality degraded                              |

### 🟢 lazydsh extras (not in reference)

- `provider-brand.ts` — Brand logo (DSH-specific, animated)
- `status-container.ts` — Status indicator container
- `footer-data-provider.ts` — Footer data provider (git, extension statuses)
- `resume-directory.ts` — Resume directory picker
- `model-catalog-runtime.ts` — Model catalog adapter
- `model-cycle.ts` — Model cycling logic (extracted, tested)
- `session-select.ts` — Session selection helpers
- `presentation.ts` — Editor/status/transcript primitives
- `bash-mode.ts` — Bash mode parsing
- `tui-console.ts` — Console capture
- `tui-renderer.ts` — TUI renderer wrapper
- `program-status.ts` — Program status reporter
- `approval.ts` — Approval panel (DSH-specific)
- `detail.ts` — Tool detail rendering engine
- `tools.ts` — Tool row + tool log
- `history.ts` — History rows for replay
- `interrupt.ts` — Ctrl+C state machine
- `stream-highlight.ts` — Incremental syntax highlighting
- `streaming.ts` — Streaming markdown
- `cli-auth.ts` — Terminal login flow (shares auth-flow.ts)
- `open-url.ts` — Open URL helper
- `picker.ts` — Search picker component
- `question.ts` — Question panel
- `session-selector.ts` — Session selector (DSH-native)
- `session-share.ts` — Share link generation
- `settings-store.ts` — UI settings persistence
- `show-changelog.ts` — Changelog panel
- Commands: `/fork`, `/archive`, `/restore`, `/pin`, `/unpin`, `/ps`, `/stop`, `/effort`, `/cd`, `/file`, `/dsh`, `/permission`, `/session`, `/status`, `/new`, `/clear`

### 📦 Orphan files (ported, unwired — need product decision)

These files are **complete implementations** ported from pi-coding-agent. They are
NOT dead code — they represent features that DSH provides and the TUI needs to
display. They should be **wired, not deleted**.

#### Need wiring (DSH provides the feature, TUI needs to display it)

1. `branch-summary-message.ts` (105L) — DSH `branch_summary` events, not rendered
2. `compaction-summary-message.ts` (107L) — DSH compaction events, wired in ui.ts
3. `trust-selector.ts` (151L) — DSH trust management, no UI
4. `user-message-selector.ts` (176L) — DSH fork from message, uses different approach
5. `custom-entry.ts` (85L) — DSH custom entries, extension system needed
6. `custom-message.ts` (152L) — DSH custom messages, extension system needed
7. `extension-editor.ts` (136L) — DSH extension dialogs
8. `extension-input.ts` (101L) — DSH extension dialogs
9. `extension-selector.ts` (131L) — DSH extension dialogs
10. `first-time-setup.ts` (155L) — DSH onboarding
11. `settings-submenu.ts` (251L) — DSH complex settings
12. `show-images-selector.ts` (55L) — DSH show images setting
13. `bordered-loader.ts` (50L) — Utility for dialogs
14. `countdown-timer.ts` (41L) — Utility for dialogs

#### Quality improvements (merge or wire)

15. `session-selector-search.ts` (330L) — Tiered fuzzy search, merged into component version
16. `bash-execution.ts` (210L) — Bash mode renderer (used for `!cmd`/`!!cmd`)

## Onboarding Files

`AGENTS.md` (patterns + runtime API) · `ARCH.md` (architecture) ·
`CAUTRUC.md` (file map) · `TODO.md` (history + remaining)
(the 101-row DSH bundle this app boots).
