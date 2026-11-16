# ARCH.md - Architecture Document for lazydsh

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              lazydsh Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │   User Input     │────▶│   pi-tui TUI     │────▶│  lazydsh UI      │   │
│  │  (keyboard/mouse) │     │  (components)    │     │  (orchestration) │   │
│  └──────────────────┘     └──────────────────┘     └────────┬─────────┘   │
│                                                              │             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌────────▼─────────┐   │
│  │  DSH Runtime     │◀───│   Runtime        │◀───│  Runtime Events  │   │
│  │  (Cordis Context)│     │  Wrapper         │     │  (typed events)  │   │
│  └────────┬─────────┘     └──────────────────┘     └──────────────────┘   │
│           │                                                 ▲              │
│           ▼                                                 │              │
│  ┌──────────────────┐     ┌──────────────────┐             │              │
│  │  DSH Plugins     │     │  Tool Events     │─────────────┘              │
│  │  (80+ plugins)   │     │  (execution)     │                            │
│  └──────────────────┘     └──────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer Details

### 1. UI Layer (pi-tui Components)

**Location**: `src/*.ts` (components), `node_modules/@earendil-works/pi-tui`

| Component                        | Responsibility                           |
| -------------------------------- | ---------------------------------------- |
| `TuiAltScreen` / `TuiMainScreen` | Terminal screen management               |
| `ScrollView`                     | Scrollable content with follow mode      |
| `VStack` / `HStack`              | Flexbox-like layout                      |
| `Editor`                         | Input editor with autocomplete           |
| `Markdown`                       | Markdown rendering with syntax highlight |
| `SearchPicker`                   | Fuzzy search modal picker                |
| `Container`                      | Generic child container                  |
| `Loader`                         | Spinner animation                        |
| `Image`                          | Image rendering (Kitty/ITerm2)           |
| `Box`                            | Bordered container                       |
| `MouseRegion`                    | Click handling                           |
| `Text`                           | Styled text                              |

### 2. lazydsh UI Orchestration

**Location**: `src/ui.ts`, `src/chat-viewport.ts`, `src/footer.ts`, `src/components/*`

```
ui.ts (Main Orchestrator, 1300+ lines)
├── Layout (chat-viewport.ts)
│   ├── Header (startup banner, key hints)
│   ├── Transcript (ScrollView)
│   │   ├── User Messages (UserMessageComponent)
│   │   ├── Assistant Messages (AssistantMessageComponent)
│   │   ├── Tool Executions (ToolExecutionComponent)
│   │   └── Bash Executions (BashExecutionComponent)
│   ├── Pending Messages Queue (QueueView)
│   ├── Status Indicators (working/retry/compaction)
│   ├── Editor (PromptEditor with autocomplete)
│   └── Footer (FooterComponent)
├── Event Handling
│   ├── Keyboard (keybindings.ts)
│   ├── Mouse (click tool cards to expand)
│   └── Runtime Events (tool_execution_*, message_*, agent_*)
├── State Management
│   ├── Session/Route state
│   ├── Tool output expansion
│   ├── Thinking visibility
│   └── Queued messages
└── Command System
    ├── Slash commands (/model, /session, /login, etc.)
    ├── Extension commands
    └── Bash mode (! prefix)
```

### 3. Runtime Wrapper (`src/runtime.ts`)

**Purpose**: Bridge DSH Agent → TUI-consumable API

```typescript
class Runtime {
  // DSH Agent reference
  private handle?: AgentHandle

  // Event emission for UI
  emit(event: "tool_execution_start", data: ToolExecutionStartEvent)
  emit(event: "tool_execution_update", data: ToolExecutionUpdateEvent)
  emit(event: "tool_execution_end", data: ToolExecutionEndEvent)
  emit(event: "message_start", data: MessageStartEvent)
  emit(event: "message_update", data: MessageUpdateEvent)
  emit(event: "message_end", data: MessageEndEvent)
  emit(event: "agent_start" | "agent_end", data: AgentEvent)

  // Public API (50+ methods)
  open(route, callbacks)
  run(text, onEvent, attachments, options)
  sessions(), forkSession(), renameSession(), manageSession()
  authenticate(), logout(), credentialSource()
  stats(), references(), attach()
  // ... 50+ methods
}
```

### 4. DSH Core (Cordis Plugin Context)

**Location**: `@deepseek-ai/dsh-base` bundle (80+ plugins)

```
Cordis Context (ctx)
├── Services (injected)
│   ├── agents: Agent management
│   ├── llm: LLM abstraction (dsh-llm + dsh-llm-pi-ai)
│   ├── sessionPersistence: JSONL storage
│   ├── sessionProjections: Queryable session views
│   ├── workspaceRegistry: Session archive/pin
│   ├── credentials: API key / OAuth storage
│   ├── authorization: OAuth flows
│   ├── userApproval: Tool approval prompts
│   ├── userQuestions: Ask-user questions
│   ├── commands: Slash command registry
│   ├── workingDirectory: CWD management
│   ├── fileReferences: @file autocomplete
│   ├── skills: Skill system
│   ├── subagents: Subagent management
│   ├── jobs: Background jobs
│   └── tools: Tool registry (via dsh-tools)
│
├── Plugins (lazy-loaded via deferred.ts)
│   ├── dsh-tool-bash, dsh-tool-fs, dsh-tool-web, etc.
│   ├── dsh-tool-subagent, dsh-tool-todo, dsh-tool-goal
│   └── 50+ more
│
└── lazydsh Plugin (src/plugin.ts)
    ├── Provides: lazydshApp { done: Promise }
    ├── Creates Runtime after appReady
    └── Handles: ask/resume/login/logout commands
```

### 5. Boot Process (`src/dsh-boot.ts`)

```
1. cli.ts: Parse args, create temp dir for patches
2. Generate provider patch (catalog.ts) + plugin patch (plugin-patch.ts)
3. dsh-boot.ts: ensureProfile("lazydsh", ["@deepseek-ai/dsh-base"])
4. composeProfile(): Load profile + overlay patches
5. Two-phase boot:
   Phase A (fast): Mount only lazydsh plugin → paint shell (< 500ms)
   Phase B (deferred): Activate 50+ tool plugins after first paint
6. plugin.ts: Create Runtime, launch UI
```

---

## Data Flow

### User Message Flow

```
User types in Editor
       │
       ▼
editor.onSubmit(text)
       │
       ▼
ui.ts: Validate, add "You" message to transcript
       │
       ▼
runtime.run(text, onEvent, attachments)
       │
       ▼
Runtime → DSH Agent → LLM
       │
       ▼
DSH Tool Plugins execute (bash, fs, web, etc.)
       │
       ▼
Tool Events emitted via Cordis (tool/call, tool/result)
       │
       ▼
Runtime forwards typed events:
  - tool_execution_start → UI creates ToolExecutionComponent
  - tool_execution_update → UI updates component (live args/result)
  - tool_execution_end → UI finalizes component
  - message_update (assistant delta) → StreamingMarkdown.append()
  - message_end → Finalize assistant message
       │
       ▼
UI renders each frame via pi-tui
```

### Session Resume Flow

```
lazydsh resume [session-id]
       │
       ▼
cli.ts: --resume flag
       │
       ▼
plugin.ts: pickSession=true or resume=sessionId
       │
       ▼
Runtime.open(route, { resume: sessionId })
       │
       ▼
DSH Agent.resume() → loads session from JSONL
       │
       ▼
UI: renderInitialMessages() → historyRows() → transcript
```

---

## Key Interfaces

### Runtime Events (for UI)

```typescript
// Tool execution (one card per call)
interface ToolExecutionStartEvent {
  toolName: string
  toolCallId: string
  args: Record<string, unknown>
}

interface ToolExecutionUpdateEvent {
  toolCallId: string
  partialResult: any
}

interface ToolExecutionEndEvent {
  toolCallId: string
  result: ToolResult    // { content, isError, meta? }
  isError: boolean
  durationMs?: number
}

// Assistant streaming
interface MessageUpdateEvent {
  sessionId: string
  attemptId: string
  type: "text-delta" | "reasoning-delta" | "usage"
  index?: number
  text?: string
  usage?: TokenUsage
}

// Session events
interface SessionEvent {
  sessionId: string
  event: {
    type: "user/message" | "assistant/message" | "assistant/attempt" | "turn/end" | "tool/bash" | ...
    seq: number
    data: any
  }
}
```

### Tool Presentation Protocol (from `@deepseek-ai/dsh-tools`)

```typescript
// Call views (what tool declares for pending state)
type ToolCallView =
  | GenericCallView // title, kind, rawInput, locations
  | TerminalCallView // command, cwd, description
  | DiffCallView; // title, diffs[]

// Result views (what tool declares for completed state)
type ToolResultView =
  | GenericResultView // title?, content?
  | TerminalResultView // output, exitCode, signal
  | DiffResultView // diffs[]
  | SearchResultView // matches grouped by file / paths
  | ReadResultView // path, lines[], offset, totalLines, lang
  | WebResultView; // sources[], answer? / url, statusCode

// UI maps these to components via toolDefinition.renderCall/renderResult
```

---

## Component Communication

### pi-tui Component Protocol

```typescript
interface Component {
  invalidate(): void; // Mark for re-render
  render(width: number): string[]; // Return ANSI lines
  handleMouse?(event): { handled: boolean }; // Optional mouse
  handleInput?(keyData): void; // Optional keyboard
}

// Layout components (VStack, HStack, ScrollView) compose children
// Focus management via tui.setFocus(component)
// Render cycle: tui.requestRender() → root.render(width) → terminal.write()
```

### Event Bus (Runtime → UI)

```typescript
// Runtime extends EventEmitter
runtime.on("tool_execution_start", handler);
runtime.on("tool_execution_update", handler);
runtime.on("tool_execution_end", handler);
runtime.on("message_start", handler);
runtime.on("message_update", handler);
runtime.on("message_end", handler);
runtime.on("agent_start", handler);
runtime.on("agent_end", handler);
```

---

## Configuration & Extensibility

### User Configuration

```
~/.config/lazydsh/
├── keybindings.json      # Custom keybindings (migrated from pi)
├── theme.json            # Custom theme (or theme name)
└── preferences.json      # Last used provider/model/effort
```

### Theme System (pi-tui based)

```typescript
// Token-based theming
interface ThemeTokens {
  colors: {
    foreground: string;
    background: string;
    palette: string[16];
    // Semantic tokens
    accent: string;
    muted: string;
    error: string;
    warning: string;
    success: string;
    toolPendingBg: string;
    toolSuccessBg: string;
    toolErrorBg: string;
    thinkingText: string;
    // ...
  };
}

// Live reload via theme-controller.ts
// Terminal color query (DA1) for system theme sync
```

### Keybindings (pi-coding-agent compatible)

```json
{
  "app.interrupt": "escape",
  "app.clear": "ctrl+c",
  "app.exit": "ctrl+d",
  "app.model.select": "ctrl+l",
  "app.tools.expand": "ctrl+o",
  "app.thinking.toggle": "ctrl+t",
  "app.editor.external": "ctrl+g",
  "app.message.followUp": "alt+enter",
  "app.session.resume": "ctrl+r"
}
```

---

## Performance Characteristics

| Metric                     | Current | Target         |
| -------------------------- | ------- | -------------- |
| Cold start to first frame  | ~500ms  | < 500ms        |
| Frame render (idle)        | ~2ms    | < 16ms (60fps) |
| Frame render (streaming)   | ~5ms    | < 33ms (30fps) |
| Memory (idle)              | ~80MB   | < 100MB        |
| Deferred plugin activation | ~300ms  | < 500ms        |

### Optimization Strategies

1. **Two-phase boot** - Paint shell before loading tool plugins
2. **Component caching** - `cachedWidth`/`cachedLines` in render()
3. **Selective invalidation** - Only re-render changed components
4. **Visual line truncation** - `truncateToVisualLines` for large output
5. **Image reuse** - Cache PNG transcoded images in ToolExecutionComponent

---

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARIES                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Input ──▶ Editor ──▶ Runtime.run() ──▶ DSH Agent     │
│       │                                              │      │
│       │         ┌────────────────────────────────────┘      │
│       ▼         ▼                                           │
│  Validation    DSH Sandbox (bwrap/landlock/Seatbelt)         │
│  (no shell    │  Tool plugins execute in sandbox            │
│   injection)  │  Network via dsh-http-proxy                  │
│               │                                             │
│               ▼                                             │
│         Credentials (dsh-credentials)                       │
│         - API keys in ~/.config/dsh/.env                    │
│         - OAuth tokens encrypted                            │
│         - Never logged, only passed to LLM                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment

### Distribution

- **npm package**: `lazydsh` (global CLI)
- **Binary**: Single `dist/cli.mjs` (ESM, Node.js 24+)
- **Dependencies**: Bundled via `vite-plus` (no external node_modules needed at runtime)

### Runtime Requirements

- Node.js ≥ 24.9.0
- Terminal with ANSI color + Unicode support
- Optional: `fd`, `rg` for autocomplete (auto-downloaded)

---

_Architecture derived from analysis of pi-coding-agent InteractiveMode, DSH core libraries, and lazydsh codebase. All Phases 1-5 implemented._
