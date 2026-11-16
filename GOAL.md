# GOAL.md - Project Context & Goals for lazydsh

## Project Overview

**lazydsh** is a standalone TUI (Terminal User Interface) client for **DeepSeek Harness (DSH)** — a headless agent platform. It provides a pi-coding-agent-level interactive experience while remaining completely independent from the DSH core package.

## Technical Stack

- **Runtime**: DeepSeek Harness (DSH) via `@deepseek-ai/dsh-base` profile
- **TUI Framework**: `@earendil-works/pi-tui` (React-like component system)
- **Language**: TypeScript (ESM, Node.js 24+)
- **Build**: `vite-plus` (single-file bundle)

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      lazydsh Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input ──▶ pi-tui TUI ──▶ lazydsh UI Orchestration    │
│                        │                    │                │
│                        ▼                    ▼                │
│              DSH Runtime Wrapper ◀─── Runtime Events        │
│                        │                                    │
│                        ▼                                    │
│              DSH Core (Cordis Context + 80+ plugins)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Layer         | Files                                                            | Responsibility                             |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| **UI**        | `ui.ts`, `chat-viewport.ts`, `components/*.ts`                   | TUI rendering, layout, input handling      |
| **Runtime**   | `runtime.ts`, `plugin.ts`                                        | DSH Agent wrapper, event emission          |
| **Theme**     | `theme/*.ts`, `theme.ts`                                         | Token-based theming, live reload, DA1 sync |
| **Tools**     | `tool-presentation.ts`, `tool-execution.ts`, `bash-execution.ts` | DSH tool → pi-tui component bridge         |
| **Selectors** | `model-selector.ts`, `session-selector*.ts`                      | Fuzzy search, tree views                   |
| **Config**    | `keybindings.ts`, `theme-controller.ts`                          | Persistent, hot-reload settings            |

## Current State

**Completed (Phases 1-5)**: Core structure implemented - all basic functionality works.

| Feature                              | Status   |
| ------------------------------------ | -------- |
| Layout (`chat-viewport.ts`)          | ✅       |
| Footer (`footer.ts`)                 | ✅       |
| Tool Cards (`tool-execution.ts`)     | ⚠️ Basic |
| Bash Execution (`bash-execution.ts`) | ⚠️ Basic |
| Model Selector                       | ⚠️ Basic |
| Session Selector                     | ⚠️ Basic |
| Keybindings                          | ✅       |
| Theme System                         | ✅       |
| Assistant Message                    | ⚠️ Basic |
| User Message                         | ⚠️ Basic |

**Missing Polish (vs pi-coding-agent's 199 components):**

- Status Indicators (Working/Retry/Compaction/Idle)
- Header with Logo/Key Hints/Changelog
- Keybinding Hints in UI
- Model Selector: Async Refresh/Progress/Errors
- Session Selector: Progress/Delete/Rename
- Login Dialog (OAuth Flow UI)
- External Editor Integration (Ctrl+G)
- Copy Message (Ctrl+X)
- Thinking Selector (Ctrl+T)
- Bug Report (/bug)
- Program Status (OSC 7501)

## Development Commands

```bash
npm run start      # Run from source
npm run check      # TypeScript + lint (vp check)
npm run check --fix  # Auto-fix formatting
npm run build      # Production bundle
npm run test       # Unit tests
```

## Key Design Principles

1. **No reimplementation of DSH internals** — Tools, auth, sessions, LLM abstraction all come from `@deepseek-ai/dsh-*` packages
2. **Provider-neutral tool UI** — Tools declare render intent via `presentCall`/`presentResult`; UI maps to pi-tui components
3. **Deferred plugin loading** — 50+ tool plugins activated after first paint (< 500ms cold start)
4. **Token-based theming** — No hardcoded colors; DA1 terminal query + semantic tokens
5. **Replay-safe** — Session log events drive identical UI on live and replay paths

## Critical Files for Onboarding

- `src/runtime.ts` — Runtime wrapper, tool event emission
- `src/ui.ts` — Main orchestration, event loop
- `src/tool-presentation.ts` — DSH tool → UI component bridge
- `src/theme/theme.ts` — Theme singleton, token resolution
- `src/theme/theme-controller.ts` — DA1, live reload, auto-sync

---

## Bắt buộc phải đọc: ./AGENTS.md, ./ARCH.md, ./TODO.md
