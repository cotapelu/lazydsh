# TODO.md - Full Implementation Plan for lazydsh Interactive Mode Upgrade

## Overview

Upgrade lazydsh from basic single-column TUI to pi-coding-agent-level interactive experience while keeping full DSH runtime features.

**Total Estimated Effort**: ~5 weeks (80 hours) + ~3 weeks (40 hours) for polish = ~120 hours
**Approach**: Port pi-tui UI patterns, wire to existing DSH Runtime

---

## Phase 1: Foundation Layout & Footer (Week 1 - 16h) ✅ COMPLETE

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

  ```bash
  npm i diff @types/diff
  ```

- [x] **Test & Verify** (1.5h)
  - [x] Cold start < 500ms
  - [x] Footer shows correct tokens/context/model
  - [x] Git branch displays correctly
  - [x] Layout responsive on resize
  - [x] All existing commands work

### 1.2 Cleanup Redundant Files ✅

- [x] **Delete `src/tools.ts`** (ToolLog - replaced by tool-execution.ts)
- [x] **Delete `src/presentation.ts` ThinkingView** (keep SentMessage, Notification, etc.)
- [x] **Update `src/theme.ts`** → mark for replacement in Phase 4
- [x] **Update `src/autocomplete.ts`** → mark for replacement in Phase 3
- [x] **Delete `src/plugin-patch.ts`** (use `catalog.providerPatch()`)

---

## Phase 2: Rich Tool Cards (Week 2 - 24h) ✅ CORE COMPLETE

### 2.1 Core Utilities ✅

- [x] **Create `src/diff.ts`** (3h)
  - [x] Port pi's `renderDiff()` function
  - [x] Word-level intra-line diff highlighting
  - [x] Context line handling (dim)
  - [x] Removed (red) / Added (green) line rendering
  - [x] Tab replacement for consistent rendering
  - [x] Export `renderDiff(diffText, options?)`

### 2.2 Tool Execution Components ✅ BASIC

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
  - [ ] **Custom renderers per tool** (via `toolDefinition.renderCall/renderResult`)
  - [ ] **Images in results** (base64 display)
  - [ ] **Duration display** (durationMs)

- [x] **Create `src/bash-execution.ts`** (5h)
  - [x] Port pi's `BashExecutionComponent` class
  - [x] Streaming stdout/stderr with ANSI stripping
  - [x] Preview mode (last 20 lines) + expanded mode (all lines)
  - [x] Visual line truncation (`truncateToVisualLines`)
  - [x] Exit code pill: green (0), red (non-zero), yellow (cancelled)
  - [ ] **Truncation warning** with full output path
  - [ ] **Command header** with `$` prompt
  - [ ] **Color key**: normal vs excluded-from-context (`!!`)

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

## Phase 3: Advanced Selectors (Week 3 - 16h) ✅ BASIC

### 3.1 Model Selector ✅ BASIC

- [x] **Create `src/model-selector.ts`** (5h)
  - [x] Port pi's `ModelSelectorComponent` class
  - [x] Fuzzy search (provider/model/name)
  - [x] Scoped/All toggle (Tab key)
  - [x] Current model marker (✓)
  - [x] Default model badge ("· default")
  - [ ] **Save as default** (Ctrl+S) → persist to preferences
  - [ ] **Async catalog refresh** with progress
  - [ ] **Error handling** for provider failures
  - [x] Keyboard: ↑/↓, Enter, Escape, Tab, Ctrl+S
  - [x] Wire to `catalog.ts` + `runtime.authProviders()`

### 3.2 Session Selector ✅ BASIC

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
  - [ ] **Delete session**: Ctrl+D → confirm → `trash` CLI fallback → `unlink`
  - [ ] **Rename session**: Ctrl+R → inline editor
  - [ ] **Progress loading** with loaded/total
  - [x] Current session marker (accent color)
  - [x] Named session badge (warning color)
  - [x] Message count + age display
  - [x] CWD display (All scope)
  - [x] Wire to `runtime.sessions()`, `runtime.renameSession()`, `runtime.manageSession()`, `runtime.sessionDirectory()`

- [ ] **Test & Verify** (2h)
  - [ ] Model selector: fuzzy search, scoped toggle, save default
  - [ ] Session selector: tree view, search, delete, rename, scope toggle
  - [ ] Keyboard shortcuts all work
  - [ ] Persist selections to preferences

---

## Phase 4: Polish Systems (Week 4 - 16h) 🔴 HIGH PRIORITY

### 4.1 Keybindings System ✅ CORE

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

- [ ] **Add Keybinding Hints in UI** (HIGH)
  - [ ] Header: Dynamic key hints (logo click, key hints)
  - [ ] Footer: Key hints for current context
  - [ ] Selectors: Show hints in footer (Tab=scope, Ctrl+S=sort, etc.)
  - [ ] Dialogs: Show hints (Enter=select, Esc=cancel)

### 4.2 Theme System ✅ CORE

- [x] **Create `src/theme/lazydsh.json`** (1h)
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

- [ ] **Test & Verify** (1h)
  - [ ] Theme loads, live reload works
  - [ ] Keybindings load, hot reload works
  - [ ] All shortcuts functional

### 4.3 Bash Mode & Thinking Toggle ⚠️ BASIC

- [x] **Bash mode in `ui.ts`** (1h)
  - [x] Detect `!` prefix in editor → `isBashMode = true`
  - [x] `!!` prefix → excluded from context
  - [x] Show `BashExecutionComponent` in transcript
  - [x] Border color change for bash mode

- [x] **Thinking block click-toggle** (1h)
  - [x] In `components/assistant-message.ts`
  - [x] Click thinking block → expand/collapse
  - [x] Configurable hide via settings

- [ ] **Copy message (Ctrl+X)** (0.5h)
  - [ ] Copy last assistant message or selection to clipboard

- [ ] **External editor (Ctrl+G)** (0.5h)
  - [ ] Open `$EDITOR` with current editor text
  - [ ] On save, update editor content

---

## Phase 5: Message Components (Week 5 - 8h) ⚠️ BASIC

### 5.1 Assistant Message Component ⚠️ BASIC

- [x] **Create `src/assistant-message.ts`** (3h)
  - [x] Port pi's `AssistantMessageComponent`
  - [x] Markdown rendering with transformers
  - [x] Thinking blocks: click to toggle visibility
  - [x] Hidden thinking label: "Thinking..." (configurable)
  - [ ] **OSC133 shell integration** (zone markers)
  - [ ] **Stop reason display**: error/aborted/length
  - [x] Streaming support: `updateContent(message, isStreaming)`

### 5.2 User Message Component ⚠️ BASIC

- [x] **Create `src/user-message.ts`** (1h)
  - [x] Port pi's `UserMessageComponent`
  - [x] Command highlighting (accent)
  - [x] Queued message styling (dim)
  - [ ] **OSC133 shell integration** (zone markers)
  - [ ] Reference highlighting (@file, @skill, paths)

### 5.3 Integration

- [x] **Wire in `ui.ts`** (2h)
  - [x] Replace `StreamingMarkdown` + `Text` with new components
  - [x] Handle `message_start` (assistant) → create `AssistantMessageComponent`
  - [x] Handle `message_update` → `component.updateContent(message, true)`
  - [x] Handle `message_end` → `component.updateContent(message, false)`
  - [x] Handle thinking blocks in streaming

---

## Phase 6: Missing Polish (Week 6-8 - 40h) 🔴 HIGH PRIORITY

### 6.1 Status Indicators (HIGH) - 8h ✅ COMPLETE

- [x] **Create `src/components/status-indicator.ts`** (4h)
  - [x] `WorkingStatusIndicator` - spinner with message
  - [x] `RetryStatusIndicator` - retry count, message
  - [x] `CompactionStatusIndicator` - progress bar
  - [x] `IdleStatus` - ready state
  - [x] Wire into `ui.ts` status container

- [x] **Wire into `ui.ts`** (4h)
  - [x] Show/hide based on runtime state (working → idle → stopping)
  - [x] `StatusIndicatorContainer` manages transitions
  - [x] Layout: scroll → status → editor

### 6.2 Header Component (HIGH) - 8h

- [ ] **Create `src/components/header.ts`** (4h)
  - [ ] Logo (pi logo with click easter egg)
  - [ ] Version display
  - [ ] Keybinding hints (dynamic, responsive)
  - [ ] Changelog display (collapsible)
  - [ ] Model scope notice

- [ ] **Wire into `chat-viewport.ts`** (4h)
  - [ ] Add header container above transcript
  - [ ] Responsive layout (hide hints on narrow)

### 6.3 Keybinding Hints in UI (HIGH) - 6h

- [ ] **Create `src/components/keybinding-hints.ts`** (3h)
  - [ ] Dynamic hint generation from keybindings
  - [ ] Context-aware hints (dialog, selector, editor)
  - [ ] Responsive truncation

- [ ] **Wire into all pickers/dialogs** (3h)

### 6.4 Model Selector Polish (HIGH) - 6h

- [ ] **Async catalog refresh** with progress spinner (2h)
- [ ] **Error handling** for provider failures (1h)
- [ ] **Save as default** (Ctrl+S) → persist to preferences (2h)
- [ ] **Scoped/All toggle** with Tab (1h)

### 6.5 Session Selector Polish (HIGH) - 8h

- [ ] **Progress loading** with loaded/total (2h)
- [ ] **Delete session**: Ctrl+D → confirm → `trash` CLI fallback → `unlink` (2h)
- [ ] **Rename session**: Ctrl+R → inline editor (2h)
- [ ] **Current session marker** (accent color) (1h)
- [ ] **Named session badge** (warning color) (1h)

### 6.5 Login Dialog (MEDIUM) - 6h

- [ ] **Create `src/components/login-dialog.ts`** (4h)
  - [ ] OAuth flow UI with spinner
  - [ ] API key input with mask
  - [ ] Device code flow support

### 6.6 External Editor Integration (MEDIUM) - 4h

- [ ] **Ctrl+G** → open `$EDITOR` with current text
- [ ] Temp file handling, cleanup on exit
- [ ] On save, update editor content

### 6.7 Copy Message (MEDIUM) - 2h

- [ ] **Ctrl+X** → copy last assistant message or selection to clipboard

### 6.8 Thinking Selector (MEDIUM) - 3h

- [ ] **Ctrl+T** → cycle thinking level
- [ ] Inline selector in footer/header

### 6.9 Message Components Polish (MEDIUM) - 6h

- [ ] **Assistant Message**: OSC133 zones, stop reasons (error/aborted/length)
- [ ] **User Message**: OSC133 zones, command highlighting

### 6.9 Bug Report (LOW) - 4h

- [ ] **`/bug` command** with auto-attached crash details

### 6.10 Program Status (LOW) - 3h

- [ ] **OSC 7501** shell integration (working/blocked/done/error)

### 6.11 Session Share (LOW) - 4h

- [ ] Share session via link

### 6.12 Model Catalog Refresh (LOW) - 4h

- [ ] Background refresh with progress
- [ ] Error handling

### 6.13 Changelog Display (LOW) - 3h

- [ ] Startup changelog with collapse toggle

### 6.14 Extension Widgets (LOW) - 4h

- [ ] Widgets above/below editor

### 6.15 Settings Selector (LOW) - 4h

- [ ] Full settings UI

---

## Phase 7: Documentation & Final Testing (Week 9-10 - 20h)

### 7.1 Documentation - 8h

- [ ] Update `README.md` with new features
- [ ] Add keybindings reference
- [ ] Add theme customization guide
- [ ] Document tool card interactions

### 7.2 Performance Audit - 6h

- [ ] Profile cold startup
- [ ] Profile streaming frame rate
- [ ] Memory leak check (long session)
- [ ] Optimize any bottlenecks

### 7.3 Final Testing - 6h

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

**Completed (Phases 1-5)**: Core structure implemented - all basic functionality works.
**Phase 6 (Polish)**: ~40h remaining - this is where the UX gap vs pi-coding-agent is closed.
**Phase 7 (Final)**: ~20h for docs, perf, final testing.

**Total remaining: ~60 hours** to reach pi-coding-agent parity.
