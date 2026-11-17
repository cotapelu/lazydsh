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

### ⏳ Remaining (Phase 7)

| Missing Feature              | Priority |
| ---------------------------- | -------- |
| Documentation (README, etc.) | Medium   |
| Performance Audit            | Medium   |
| Final Integration Testing    | Medium   |

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

### 4. Deferred Plugin Loading

- 50+ tool plugins disabled at boot
- Activated after first paint via `activateDeferredPlugins()`
- Keeps startup fast (< 500ms to first frame)

## Code Organization

```
src/
├── cli.ts                 # Entry point, arg parsing
├── dsh-boot.ts            # Profile boot, two-phase
├── plugin.ts              # Main plugin, Runtime creation
├── runtime.ts             # Runtime wrapper (DSH Agent → TUI API)
├── ui.ts                  # Main TUI orchestration (1300+ lines)
├── chat-viewport.ts       # Layout: Header/Chat/Pending/Status/Editor/Footer
├── footer.ts              # Context footer component
├── footer-data-provider.ts # Data provider for footer
├── tool-execution.ts      # Rich tool cards
├── bash-execution.ts      # Terminal streaming
├── model-selector.ts      # Model picker
├── session-selector.ts    # Session picker with tree
├── session-selector-search.ts # Session search utilities
├── keybindings.ts         # Configurable keybindings
├── assistant-message.ts   # Assistant message with thinking
├── user-message.ts        # User message component
├── tool-presentation.ts   # DSH tool → UI component bridge
├── visual-truncate.ts     # Visual line truncation
├── keybinding-hints.ts    # Key hint formatting
├── dynamic-border.ts      # Colored borders
├── markdown-transform.ts  # Markdown transformers
├── theme/
│   ├── lazydsh.json       # Default theme (renamed from theme.json)
│   ├── theme-tokens.ts    # Token definitions
│   └── theme-controller.ts # Live reload, DA1 query
├── presentation.ts        # Legacy message components (StartupBanner, etc.)
├── streaming.ts           # StreamingMarkdown
├── autocomplete.ts        # @ files, / commands
├── catalog.ts             # Provider/model catalog
├── deferred.ts            # Deferred plugin logic
├── history.ts             # Event rendering
├── commands.ts            # Slash commands
├── diff.ts                # Word-level diff rendering
├── format.ts              # Token/duration formatting
├── highlight.ts           # Syntax highlighting
├── limits.ts              # Account limits parsing
├── native-commands.ts     # Native DSH commands
├── open-url.ts            # OAuth URL opening
├── picker.ts              # SearchPicker component
├── plugin.ts              # Main plugin, Runtime creation
├── preferences.ts         # Model preference persistence
├── provider.ts            # Provider normalization
├── question.ts            # QuestionPanel component
├── approval.ts            # ApprovalPanel component
├── resume-directory.ts    # Resume directory selection
├── runtime-events.ts      # Runtime event types
├── session-select.ts      # Session selection (standalone)
├── stats.ts               # Session stats formatting
├── stream-highlight.ts    # Incremental syntax highlighting
├── streaming.ts           # StreamingMarkdown
├── telemetry-patch.ts     # Telemetry opt-out
├── terminal-login.ts      # Terminal-based auth
├── tui-console.ts         # Console capture
├── ui-commands.ts         # Command utilities
├── upgrade.ts             # Self-upgrade logic
├── types.ts               # Consolidated types
```

## Key Interfaces

### Runtime (src/runtime.ts)

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

_Current state: Core structure + all Phase 6 polish complete (Phases 1-6). Remaining: Phase 7 (Documentation, Performance Audit, Final Testing) ~20h. See TODO.md for remaining work._
