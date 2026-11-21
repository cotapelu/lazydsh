# AGENTS.md - Agent Development Guide for lazydsh

## Overview

This document describes the agent architecture, development patterns, and guidelines for working on lazydsh - a TUI client for DeepSeek Harness (DSH).

## Agent Architecture

### Core Runtime (DSH)

- **Framework**: DeepSeek Harness (DSH) - headless agent platform
- **Agent Core**: `@deepseek-ai/dsh-agent` (Cordis-based plugin system)
- **Session Management**: `@deepseek-ai/dsh-session` (JSONL event-sourced)
- **LLM Abstraction**: `@deepseek-ai/dsh-llm` + `@deepseek-ai/dsh-llm-pi-ai` (pi-ai providers)
- **Tools**: 19 tool plugins via `@deepseek-ai/dsh-tool-*` (bash, fs, web, subagent, etc.)
- **Presentation Protocol**: `@deepseek-ai/dsh-tools` (TypeScript types only - no UI implementation)

### UI Framework

- **TUI Library**: `@earendil-works/pi-tui` (React-like component system)
- **Components**: ScrollView, VStack/HStack, Editor, Markdown, SearchPicker, Container, etc.
- **Theming**: CSS-like token system with live reload support

### lazydsh Specific

- **Profile**: "lazydsh" Cordis profile extending `@deepseek-ai/dsh-base`
- **Boot**: Two-phase (paint shell first, defer 50+ tool plugins)
- **Runtime Wrapper**: `src/runtime.ts` (~1200 lines) - wraps DSH Agent for TUI consumption

## Current Implementation Status

### ✅ Core Structure Complete (Phases 1-6)

| Component                        | Status      | Notes                                               |
| -------------------------------- | ----------- | --------------------------------------------------- |
| Layout (`chat-viewport.ts`)      | ✅          | Header/Chat/Pending/Status/Widgets/Editor/Footer    |
| Footer (`footer.ts`)             | ✅          | Tokens, git, model, context%, responsive            |
| Tool Cards (`tool-execution.ts`) | ✅ Polished | Custom renderers, images, duration, expandable      |
| Bash Execution                   | ✅ Polished | ANSI strip, exit code, truncation warning           |
| Model Selector                   | ✅ Polished | Fuzzy search, async refresh, progress, save default |
| Session Selector                 | ✅ Polished | Tree view, progress, delete/archive, rename         |
| Keybindings                      | ✅          | Configurable, hot-reload, legacy migration          |
| Theme System                     | ✅          | Tokens, DA1 sync, live reload, auto-sync            |
| Assistant Message                | ✅ Polished | Thinking toggle, OSC133 zones, stop reasons         |
| User Message                     | ✅ Polished | OSC133 zones                                        |
| Status Indicators                | ✅ Complete | Working/Retry/Compaction/Idle                       |
| Header                           | ✅ Complete | Logo, key hints, changelog, click expand            |
| Keybinding Hints                 | ✅ Complete | Everywhere in UI                                    |
| Login Dialog                     | ✅ Complete | OAuth flow UI                                       |
| External Editor (Ctrl+G)         | ✅ Complete | $EDITOR integration                                 |
| Copy Message (Ctrl+X)            | ✅ Complete | Clipboard with fallback                             |
| Thinking Selector (Ctrl+T)       | ✅ Complete | Cycle reasoning effort                              |
| Bug Report (/bug)                | ✅ Complete | Auto-attached crash details                         |
| Program Status (OSC 7501)        | ✅ Complete | Idle/Working/Blocked/Done/Error                     |
| Session Share (/share)           | ✅ Complete | Placeholder share links                             |
| Extension Widgets                | ✅ Complete | Registry, above/below editor                        |
| Changelog Display (/changelog)   | ✅ Complete | Expand/collapse toggle                              |
| Settings Selector (/settings)    | ✅ Complete | 5 categories, toggle/select/info                    |

### ✅ Phase 7 Complete

Documentation (README/keybindings/theme/tool-card guides), performance audit (~122ms cold start, streaming frame-rate check), and final integration testing are done — see TODO.md for the phase history.

## Development Patterns

### 1. Event-Driven Architecture

```typescript
// DSH tools emit events via Cordis context
ctx.on("tool/bash", (agent, request) => { ... })

// lazydsh UI subscribes to Runtime events
runtime.on("tool_execution_start", (event) => {
  // Create ToolExecutionComponent
})
```

### 2. Component Structure (pi-tui)

```typescript
class MyComponent implements Component {
  invalidate() {
    /* mark dirty */
  }
  render(width: number): string[] {
    /* return ANSI lines */
  }
  handleMouse?(event): { handled: boolean } | undefined;
  handleInput?(keyData): void;
}
```

### 3. Theme System

```typescript
// Use theme tokens, not hardcoded colors
import { theme } from "./theme/theme.js";
const styled = theme.fg("accent", text); // ✅
const styled = "\x1b[34m" + text; // ❌ Hardcoded
```

### 4. Layering (CAUTRUC.md)

- `interactive-mode/` may import `interfaces.ts`, `runtime-events.ts`, `utils/*`, `runtime/*`
- `runtime/` may import `interfaces.ts`, `runtime-events.ts`, `utils/*` — never `interactive-mode/`
- `utils/*` and the contract files import nothing local
- Root (`cli.ts`, `plugin.ts`, `types.ts`) is the wiring plane and may reference both layers

### 5. Deferred Plugin Loading

- 50+ tool plugins disabled at boot
- Activated after first paint via `activateDeferredPlugins()`
- Keeps startup fast (< 500ms to first frame)

## Code Organization

Three layers plus a root wiring plane (see CAUTRUC.md for the full file map
and the resolutions taken against its original inventory):

```
src/
├── cli.ts                 # Entry point, arg parsing (wiring)
├── plugin.ts              # Main Cordis plugin, Runtime creation (wiring)
├── types.ts               # Barrel re-export of the contracts
├── interfaces.ts          # CONTRACT: boundary types (Route, Callbacks, ...)
├── runtime-events.ts      # CONTRACT: runtime event types
├── runtime/               # DSH bridge + boot (no pi-tui imports)
│   ├── runtime.ts         # Runtime wrapper (DSH Agent → TUI API)
│   ├── dsh-boot.ts        # Profile boot, two-phase
│   ├── deferred.ts        # Deferred plugin logic (RUNTIME_SERVICE_NAMES)
│   ├── plugin-patch.ts    # Profile patches (extra services)
│   ├── telemetry-patch.ts # Telemetry opt-out patch
│   ├── catalog.ts         # Provider/model catalog
│   ├── provider.ts        # Provider normalization
│   ├── native-commands.ts # Native DSH commands
│   ├── preferences.ts     # Model preference persistence
│   ├── command-runner.ts  # ask/login/logout CLI runner
│   ├── pending-runtime.ts # Pre-attach Runtime proxy
│   └── upgrade.ts         # Self-upgrade logic
├── interactive-mode/      # FE: the TUI (imports contracts + utils + runtime)
│   ├── ui.ts              # Main TUI orchestration (1300+ lines)
│   ├── presentation.ts    # Message/status/editor components
│   ├── tool-execution.ts  # Rich tool cards
│   ├── tool-presentation.ts # DSH tool → UI component bridge
│   ├── bash-execution.ts  # Terminal streaming
│   ├── model-selector.ts  # Model picker
│   ├── session-selector.ts # Session picker with tree
│   ├── session-selector-search.ts # Session search utilities
│   ├── session-select.ts  # Session selection (standalone)
│   ├── picker.ts          # SearchPicker component
│   ├── keybindings.ts     # Configurable keybindings
│   ├── keybinding-hints.ts # Key hint formatting
│   ├── assistant-message / user-message → components/
│   ├── approval.ts, question.ts, interrupt.ts, detail.ts, diff.ts
│   ├── history.ts, tools.ts, streaming.ts, stream-highlight.ts
│   ├── footer.ts, footer-data-provider.ts, stats panel data
│   ├── theme.ts           # Theme core facade (tokens + controller)
│   ├── theme/             # theme-tokens, theme-controller, system-theme, JSONs
│   ├── components/        # 32 UI components (header, status, dialogs, selectors)
│   └── ...                # extensions, bug-report, clipboard, program-status, ...
└── utils/                 # Shared pure helpers (no pi-tui, no dsh)
    ├── ansi.ts, truncate.ts, format.ts, models-are-equal.ts
    ├── version.ts         # package.json version lookup
    ├── stats.ts, limits.ts # formatting used by both layers
```

## Key Interfaces

### Runtime (src/runtime/runtime.ts)

```typescript
class Runtime {
  // Session management
  open(route: Route, callbacks: Callbacks): Promise<string>;
  sessions(): Promise<SessionInfo[]>;
  forkSession(boundary: number): Promise<string>;
  renameSession(id: string, title: string): Promise<string>;
  manageSession(id: string, action: "archive" | "restore" | "pin" | "unpin"): Promise<void>;

  // Model management
  selection(): { provider: string; model: string; effort?: string } | undefined;
  efforts(): Promise<{ current: string; defaultEffort?: string; options: any[] }>;

  // Execution
  run(
    text: string,
    onEvent?: (event: RuntimeEvent) => void,
    attachments?: any[],
    options?: any,
  ): Promise<RunResult>;
  cancel(): Promise<void>;
  close(): Promise<void>;

  // Auth
  authenticate(signal?: AbortSignal, options?: any): Promise<string | undefined>;
  logout(provider: string): Promise<string[] | undefined>;
  credentialSource(provider?: string, signal?: AbortSignal): Promise<CredentialSource>;

  // Tools/Refs
  references(query: string, signal: AbortSignal): Promise<AutocompleteItem[]>;
  attach(path: string): Promise<AdmittedPromptContentPart>;

  // Stats
  stats(connect?: boolean, onSnapshot?: (stats: SessionStats) => void): Promise<SessionStats>;
}
```

### Tool Events (emitted from Runtime)

```typescript
interface ToolExecutionStartEvent {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

interface ToolExecutionUpdateEvent {
  toolCallId: string;
  partialResult: any;
}

interface ToolExecutionEndEvent {
  toolCallId: string;
  result: any;
  isError: boolean;
  durationMs?: number;
}
```

## Testing Guidelines

### Unit Tests

- Test pure functions in isolation
- Mock Cordis context for plugin tests
- Use `vitest` (configured in package.json)

### Integration Tests

- Test Runtime methods against real DSH profile
- Use `--offline` flag for CI

### Manual Testing

```bash
# Development
npm run start          # Run from source
npm run demo           # Demo script

# Build & test
npm run check          # TypeScript + lint
npm run test           # Unit tests
npm run build          # Production build
```

## Common Pitfalls

1. **Don't hardcode ANSI colors** - use `theme.ts` tokens
2. **Don't block the event loop** - use async/await properly
3. **Don't mutate shared state** - pi-tui components expect immutable updates
4. **Handle terminal resize** - components receive `width` in `render(width)`
5. **Clean up subscriptions** - use `ctx.effect(() => cleanup)` pattern

## Extension Points

### Adding New Tool UI

1. Tool plugin emits `tool_execution_start/update/end` via Cordis
2. `Runtime` forwards as typed events
3. `ui.ts` creates `ToolExecutionComponent` with tool definition
4. Component uses `toolDefinition.renderCall/renderResult` if available

### Adding New Slash Command

1. Add to `commands.ts` slash command list
2. Handle in `ui.ts` `editor.onSubmit`
3. Or register via Cordis plugin for DSH-native commands

### Adding Theme

1. Add JSON file to `src/theme/`
2. Register in `theme-controller.ts`
3. Use token references in components

## Performance Targets

| Metric                 | Target  |
| ---------------------- | ------- |
| Time to first frame    | < 500ms |
| Frame rate (idle)      | 60fps   |
| Frame rate (streaming) | 30fps   |
| Memory (idle)          | < 100MB |
| Startup (cold)         | < 2s    |

## Debugging

```bash
# Enable debug logging
DEBUG=lazydsh:* npm run start

# Profile startup
PI_STARTUP_BENCHMARK=1 npm run start

# Inspect Cordis context
# Use /plugin command in running TUI
```

---

_Current state: Phases 1-7 complete; Phase 8 (upstream parity) complete including the overlay panel follow-ups (§8.9). Next structured plan: the 3-layer restructure in CAUTRUC.md. Suite: 112/112 passing._
