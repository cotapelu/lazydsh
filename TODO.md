# TODO.md - Full Implementation Plan for lazydsh Interactive Mode Upgrade

## Overview

Upgrade lazydsh from basic single-column TUI to pi-coding-agent-level interactive experience while keeping full DSH runtime features.

**Total Estimated Effort**: ~5 weeks (80 hours)
**Approach**: Port pi-tui UI patterns, wire to existing DSH Runtime

---

## Phase 1: Foundation Layout & Footer (Week 1 - 16h)

### 1.1 Layout Infrastructure

- [x] **Create `src/chat-viewport.ts`** (2h)
  - [x] Copy pi's `createChatViewport()` function
  - [x] Layout: Header → Transcript → Pending → Status → Widgets → Editor → Footer
  - [x] Support `overscroll: "chain"` for smooth scrolling
  - [x] Export `ChatViewport` interface

- [x] **Create `src/footer-data-provider.ts`** (3h)
  - [x] Adapt pi's `FooterDataProvider` for DSH
  - [x] Git branch detection (spawn `git branch --show-current`)
  - [x] Extension status registry (Map<string, string>)
  - [x] CWD formatting with ~ home replacement
  - [x] Session name display
  - [x] Available provider count

- [x] **Create `src/footer.ts`** (4h)
  - [x] Port pi's `FooterComponent` class
  - [x] Token display: ↑input ↓output Rcache-read Wcache-write
  - [x] Cache hit rate % (CHxx%)
  - [x] Cost display ($x.xxx or "sub" for subscription)
  - [x] Context usage bar: XX%/XXXXtokens (color: green<70, yellow<90, red≥90)
  - [x] Auto-compact indicator: "(auto)"
  - [x] Model display: provider/model + thinking level
  - [x] Routed model indicator: "→ provider/model"
  - [x] Extension status line (sorted alphabetically)
  - [x] Responsive truncation for narrow terminals

- [x] **Refactor `src/ui.ts` to use new layout** (5h)
  - [x] Replace `VStack([scroll, composer])` with `chat-viewport`
  - [x] Initialize `FooterComponent` with `FooterDataProvider`
  - [x] Wire `runtime.stats()` → footer updates
  - [x] Wire `runtime.on("tool_execution_*")` → status indicators
  - [x] Preserve all existing functionality (commands, queue, auth, etc.)
  - [x] Update `runUI()` signature to accept new components

- [x] **Install `diff` package** (0.5h)

- [x] **Test & Verify** (1.5h)
  - [x] Cold start < 500ms
  - [x] Footer shows correct tokens/context/model
  - [x] Git branch displays correctly
  - [x] Layout responsive on resize
  - [x] All existing commands work

### 1.2 Cleanup Redundant Files

- [x] **Delete `src/tools.ts`** (ToolLog - replaced by tool-execution.ts)
- [x] **Delete `src/presentation.ts` ThinkingView** (keep SentMessage, Notification, etc.)
- [x] **Update `src/theme.ts`** → mark for replacement in Phase 4
- [x] **Update `src/autocomplete.ts`** → mark for replacement in Phase 3
- [x] **Delete `src/plugin-patch.ts`** (use `catalog.providerPatch()`)

---

## Phase 2: Rich Tool Cards (Week 2 - 24h)

### 2.1 Core Utilities

- [x] **Create `src/diff.ts`** (3h)
  - [x] Port pi's `renderDiff()` function
  - [x] Word-level intra-line diff highlighting
  - [x] Context line handling (dim)
  - [x] Removed (red) / Added (green) line rendering
  - [x] Tab replacement for consistent rendering
  - [x] Export `renderDiff(diffText, options?)`

### 2.2 Tool Execution Components

- [x] **Create `src/tool-execution.ts`** (10h)
  - [x] Port pi's `ToolExecutionComponent` class
  - [x] **States**: pending → running → success/error
  - [x] **Shells**: "default" (Box wrapper) + "self" (custom renderer)
  - [x] **Custom renderers**: Use `toolDefinition.renderCall/renderResult` from DSH tools
  - [x] **Fallback renderers**: Generic call/result display
  - [x] **Expandable**: Click to expand/collapse (MouseRegion)
  - [x] **Live args streaming**: `updateArgs()` buffers, renders once per frame
  - [x] **Execution markers**: `markExecutionStarted()`, `setArgsComplete()`
  - [x] **Result rendering**: `updateResult(result, isPartial)`
  - [x] **Images**: Display base64 images in results (reuse transcoded)
  - [x] **Duration display**: Show `durationMs` when complete
  - [x] **Background colors**: pending (blue), success (green), error (red)
  - [x] **Output padding**: Configurable via `outputPad`
  - [x] **Truncation**: Preview lines when collapsed (10 lines default)

- [x] **Create `src/bash-execution.ts`** (5h)
  - [x] Port pi's `BashExecutionComponent` class
  - [x] Streaming stdout/stderr with ANSI stripping
  - [x] Preview mode (last 20 lines) + expanded mode (all lines)
  - [x] Visual line truncation (`truncateToVisualLines`)
  - [x] Exit code pill: green (0), red (non-zero), yellow (cancelled)
  - [x] Truncation warning with full output path
  - [x] Command header with `$` prompt
  - [x] Color key: normal vs excluded-from-context (`!!`)

- [x] **Wire DSH Tool Events** (4h)
  - [x] In `runtime.ts`: Emit typed events from Cordis tool handlers
  - [x] In `ui.ts`: Subscribe to events, create/update `ToolExecutionComponent`
  - [x] Map DSH tool names to presentation definitions
  - [x] Handle nested tool calls (parentToolCallId)

- [x] **Test & Verify** (2h)
  - [x] Bash tool shows live streaming output
  - [x] File read/write/edit show diffs
  - [x] Search results grouped by file
  - [x] Web search shows sources + answer
  - [x] Click to expand/collapse works
  - [x] Colors correct for pending/success/error

---

## Phase 3: Advanced Selectors (Week 3 - 16h)

### 3.1 Model Selector

- [x] **Create `src/model-selector.ts`** (5h)
  - [x] Port pi's `ModelSelectorComponent` class
  - [x] Fuzzy search (provider/model/name)
  - [x] Scoped/All toggle (Tab key)
  - [x] Current model marker (✓)
  - [x] Default model badge ("· default")
  - [x] Save as default (Ctrl+S) → persist to preferences
  - [x] Async catalog refresh with progress
  - [x] Error handling for provider failures
  - [x] Keyboard: ↑/↓, Enter, Escape, Tab, Ctrl+S
  - [x] Wire to `catalog.ts` + `runtime.authProviders()`

### 3.2 Session Selector

- [x] **Create `src/session-selector-search.ts`** (2h)
  - [x] Port pi's `filterAndSortSessions()`, `hasSessionName()`
  - [x] Threaded tree building (`buildSessionTree`, `flattenSessionTree`)
  - [x] Sort modes: threaded / recent / relevance
  - [x] Name filter: all / named only
  - [x] Path display toggle

- [x] **Create `src/session-selector.ts`** (7h)
  - [x] Port pi's `SessionSelectorComponent` + `SessionList` + `SessionSelectorHeader`
  - [x] Tree view with branch characters (├─ └─ │)
  - [x] Fuzzy search with regex support (`re:pattern`, `"exact"`)
  - [x] Scope toggle: Current Folder / All (Tab)
  - [x] Sort toggle: Threaded / Recent / Fuzzy (Ctrl+S)
  - [x] Name filter toggle: All / Named (Ctrl+N)
  - [x] Path display toggle: on/off (Ctrl+P)
  - [x] Delete session: Ctrl+D → confirm → `trash` CLI fallback → `unlink`
  - [x] Rename session: Ctrl+R → inline editor
  - [x] Progress loading with loaded/total
  - [x] Current session marker (accent color)
  - [x] Named session badge (warning color)
  - [x] Message count + age display
  - [x] CWD display (All scope)
  - [x] Wire to `runtime.sessions()`, `runtime.renameSession()`, `runtime.manageSession()`, `runtime.sessionDirectory()`

- [x] **Test & Verify** (2h)
  - [x] Model selector: fuzzy search, scoped toggle, save default
  - [x] Session selector: tree view, search, delete, rename, scope toggle
  - [x] Keyboard shortcuts all work
  - [x] Persist selections to preferences

---

## Phase 4: Polish Systems (Week 4 - 16h)

### 4.1 Keybindings System

- [x] **Create `src/keybindings.ts`** (4h)
  - [x] Port pi's `KeybindingsManager` class
  - [x] Define `KEYBINDINGS` object (60+ actions)
  - [x] Platform-aware defaults (Win/macOS/Linux)
  - [x] Legacy migration map (old names → new names)
  - [x] Load from `~/.config/lazydsh/keybindings.json`
  - [x] Schema validation (custom, no typebox)
  - [x] Hot reload on file change
  - [x] Wire to `editor.onAction()`, `tui.addInputListener()`

- [x] **Integrate keybindings in `ui.ts`** (2h)
  - [x] Replace hardcoded `matchesKey("escape")` etc.
  - [x] Map actions: interrupt, clear, exit, model cycling, tool expand, thinking toggle, external editor, copy, followUp, dequeue, paste image, session commands, etc.

### 4.2 Theme System

- [x] **Create `src/theme/theme.json`** (1h)
  - [x] Default theme (port pi's default)
  - [x] Token definitions: colors, semantic aliases

- [x] **Create `src/theme/theme-tokens.ts`** (1h)
  - [x] Token type definitions
  - [x] Theme class with `get()`, `set()`, `resolve()`

- [x] **Create `src/theme/theme-controller.ts`** (4h)
  - [x] Port pi's `InteractiveThemeController`
  - [x] Terminal color query (DA1) with 100ms timeout
  - [x] System theme auto-sync (light/dark)
  - [x] Live reload on theme file change
  - [x] Apply theme to pi-tui via `setTheme()`, `setTerminalColors()`
  - [x] `waitForTerminalColors()` for startup header

- [x] **Refactor `src/theme.ts`** (2h)
  - [x] Replace hardcoded colors with theme tokens
  - [x] Export `theme` object compatible with pi-tui
  - [x] Remove `terminalColor()`, `formatNotification()` → use theme tokens

- [x] **Test & Verify** (1h)
  - [x] Theme loads, live reload works
  - [x] Keybindings load, hot reload works
  - [x] All shortcuts functional

### 4.3 Bash Mode & Thinking Toggle

- [x] **Bash mode in `ui.ts`** (1h)
  - [x] Detect `!` prefix in editor → `isBashMode = true`
  - [x] `!!` prefix → excluded from context
  - [x] Show `BashExecutionComponent` in transcript
  - [x] Border color change for bash mode

- [x] **Thinking block click-toggle** (1h)
  - [x] In `components/assistant-message.ts`
  - [x] Click thinking block → expand/collapse
  - [x] Configurable hide via settings

- [x] **Copy message (Ctrl+X)** (0.5h)
  - [x] Copy last assistant message or selection to clipboard

- [x] **External editor (Ctrl+G)** (0.5h)
  - [x] Open `$EDITOR` with current editor text
  - [x] On save, update editor content

---

## Phase 5: Message Components (Week 5 - 8h)

### 5.1 Assistant Message Component

- [x] **Create `src/assistant-message.ts`** (3h)
  - [x] Port pi's `AssistantMessageComponent`
  - [x] Markdown rendering with transformers
  - [x] Thinking blocks: click to toggle visibility
  - [x] Hidden thinking label: "Thinking..." (configurable)
  - [x] OSC133 shell integration (zone markers)
  - [x] Stop reason display: error/aborted/length
  - [x] Streaming support: `updateContent(message, isStreaming)`

### 5.2 User Message Component

- [x] **Create `src/user-message.ts`** (1h)
  - [x] Port pi's `UserMessageComponent`
  - [x] Command highlighting (accent)
  - [x] Queued message styling (dim)
  - [x] Reference highlighting (@file, @skill, paths)

### 5.3 Integration

- [x] **Wire in `ui.ts`** (2h)
  - [x] Replace `StreamingMarkdown` + `Text` with new components
  - [x] Handle `message_start` (assistant) → create `AssistantMessageComponent`
  - [x] Handle `message_update` → `component.updateContent(message, true)`
  - [x] Handle `message_end` → `component.updateContent(message, false)`
  - [x] Handle thinking blocks in streaming

- [x] **Test & Verify** (2h)
  - [x] Streaming markdown renders correctly
  - [x] Thinking blocks click-toggle works
  - [x] OSC133 zones work in supported terminals
  - [x] Stop reasons display correctly
  - [x] User messages styled correctly

---

## Phase 6: Cleanup & Polish (Week 6 - 8h)

### 6.1 Remaining Cleanup

- [x] Remove dead code from `presentation.ts` (ThinkingView, old ToolLog usage)
- [x] Remove dead code from `autocomplete.ts` (replace with pi's provider)
- [x] Remove `plugin-patch.ts` entirely
- [x] Consolidate types into `src/types.ts`

### 6.2 Documentation

- [ ] Update `README.md` with new features
- [ ] Add keybindings reference
- [ ] Add theme customization guide
- [ ] Document tool card interactions

### 6.3 Performance Audit

- [ ] Profile cold startup
- [ ] Profile streaming frame rate
- [ ] Memory leak check (long session)
- [ ] Optimize any bottlenecks

### 6.4 Final Testing

- [ ] Full integration test: ask, resume, login, logout, upgrade
- [ ] All slash commands work
- [ ] All tools render correctly
- [ ] Session fork/resume/archive/pin work
- [ ] Model cycling works
- [ ] Theme/keybinding persistence works

### 6.2 Documentation

- [ ] Update `README.md` with new features
- [ ] Add keybindings reference
- [ ] Add theme customization guide
- [ ] Document tool card interactions

### 6.3 Performance Audit

- [ ] Profile cold startup
- [ ] Profile streaming frame rate
- [ ] Memory leak check (long session)
- [ ] Optimize any bottlenecks

### 6.4 Final Testing

- [ ] Full integration test: ask, resume, login, logout, upgrade
- [ ] All slash commands work
- [ ] All tools render correctly
- [ ] Session fork/resume/archive/pin work
- [ ] Model cycling works
- [ ] Theme/keybinding persistence works

---

## Dependencies Added

```bash
npm i diff @types/diff
```

---

## Summary

**Completed (Phases 1-5)**: ✅ All core functionality implemented
**Remaining (Phase 6)**: Minor cleanup, docs, performance tuning, final testing

---

## File Creation Summary

### New Files (~18)

```
src/
├── chat-viewport.ts
├── footer-data-provider.ts
├── footer.ts
├── tool-execution.ts
├── bash-execution.ts
├── diff.ts
├── model-selector.ts
├── session-selector.ts
├── session-selector-search.ts
├── keybindings.ts
├── assistant-message.ts
├── user-message.ts
├── tool-presentation.ts
├── visual-truncate.ts
├── components/
│   ├── dynamic-border.ts
│   ├── assistant-message.ts
│   └── user-message.ts
├── theme/
│   ├── theme.json
│   ├── theme-tokens.ts
│   └── theme-controller.ts
```

### Modified Files (~10)

```
src/
├── ui.ts                    # Major refactor
├── runtime.ts               # Add tool event emission
├── theme.ts                 # Replace with theme tokens
├── autocomplete.ts          # Extend pi's provider
├── presentation.ts          # Remove ThinkingView, enhance messages
├── plugin.ts                # Wire new components
├── catalog.ts               # Ensure provider patch used
├── deferred.ts              # Verify deferred list
├── types.ts (new)           # Consolidated types
└── plugin-patch.ts          # DELETE
```

---

## Success Criteria

| Metric                                         | Target  |
| ---------------------------------------------- | ------- |
| Time to first frame                            | < 500ms |
| Frame rate (idle)                              | 60fps   |
| Frame rate (streaming)                         | 30fps   |
| All DSH tools render with rich cards           | ✅      |
| Context footer shows tokens/context%/git/model | ✅      |
| Model/Session selectors match pi UX            | ✅      |
| Keybindings configurable + persistent          | ✅      |
| Themes live-reload + system sync               | ✅      |
| Bash mode (! prefix) works                     | ✅      |
| Thinking blocks click-toggle                   | ✅      |
| All existing features preserved                | ✅      |

---

## Risk Mitigation

| Risk                         | Mitigation                                |
| ---------------------------- | ----------------------------------------- |
| pi-tui API changes           | Pin version, test on upgrade              |
| DSH tool event shapes differ | Add adapter layer in runtime.ts           |
| Theme system complex         | Start with minimal token set              |
| Keybinding conflicts         | Use pi's migration map                    |
| Performance regression       | Profile each phase, keep deferred loading |

---

_Generated from comprehensive analysis of pi-coding-agent, DSH core, and lazydsh codebases._
