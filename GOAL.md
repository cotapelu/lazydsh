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
| Tests    | vitest — 145/145                                                 |

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

**All phases complete** (see TODO.md phase history). 145/145 tests, `check` and
`build` clean.

- Full interactive parity with pi-coding-agent's documented feature set.
- 27 keybindings wired; Ctrl+C state machine; suspend/resume; model cycling.
- Live status rows for retry/compaction; footer with git, providers, extension
  statuses.
- Persistence: keybindings, theme (name/auto pair), UI settings, model choice.

## Layer Layout

Applied (CAUTRUC.md): `interactive-mode/` (TUI, `components/`, `theme/`),
`runtime/` (DSH bridge + boot), `utils/` (pure), root contracts
(`interfaces.ts`, `runtime-events.ts`) and wiring (`cli.ts`, `plugin.ts`,
`types.ts`).

## Current Gaps (honest list)

1. ~~Bash mode (`!` prefix)~~ — done (§8.20).
2. Tool-row renderer duplication — `tool-execution.ts` + `tool-presentation.ts`
   are unwired; live rows use `tools.ts`/`detail.ts`.
3. Orphan component library (extension/custom/first-run components) — awaiting
   product decisions.
4. Duplicate session-search implementations — merge or delete.

Details and priority: `TODO.md` REMAINING.

## Onboarding Files

`AGENTS.md` (patterns + runtime API) · `ARCH.md` (architecture) ·
`CAUTRUC.md` (file map) · `TODO.md` (history + remaining) · `DSH-BASE.md`
(the 101-row DSH bundle this app boots).
