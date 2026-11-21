# TODO.md - Full Implementation Plan for lazydsh Interactive Mode Upgrade

## Overview

Upgrade lazydsh from basic single-column TUI to pi-coding-agent-level interactive experience while keeping full DSH runtime features.

> **Path note:** Phase 1-6 were planned against the original flat `src/` tree. The 3-layer refactor (Phase 8 / CAUTRUC.md) moved those files: TUI files now live in `src/interactive-mode/` (+ `components/`, `theme/`), the DSH bridge in `src/runtime/`, shared pure helpers in `src/utils/`, with `src/interfaces.ts` and `src/runtime-events.ts` as the root contracts. Old paths below are kept for history; the current map is AGENTS.md / CAUTRUC.md.

**Total Estimated Effort**: ~5 weeks (80 hours) + ~3 weeks (40 hours) for polish = ~120 hours
**Approach**: Port pi-tui UI patterns, wire to existing DSH Runtime

---

## Phase 1: Foundation Layout & Footer (Week 1 - 16h) ✅ COMPLETE

### 1.1 Layout Infrastructure

- [x] **Create `src/chat-viewport.ts`** (2h) — _later superseded by the inline layout in `ui.ts`; the file was deleted in §8.11 as dead code_
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

_Historical cleanup pass; two rows below are actively false today and are corrected here:_

- [x] **Delete `src/tools.ts`** (ToolLog - replaced by tool-execution.ts) — **NOT deleted: `src/interactive-mode/tools.ts` still ships `ToolLog`/`ToolRow` and `ui.ts` imports both** (§8.7 made the rows expandable)
- [x] **Delete `src/presentation.ts` ThinkingView** (keep SentMessage, Notification, etc.)
- [x] **Update `src/theme.ts`** → mark for replacement in Phase 4
- [x] **Update `src/autocomplete.ts`** → mark for replacement in Phase 3
- [x] **Delete `src/plugin-patch.ts`** (use `catalog.providerPatch()`) — **NOT deleted: `src/runtime/plugin-patch.ts` still adds the non-base services** (`cli.ts` writes it into the profile patch))

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
  - [x] **Custom renderers per tool** (via `toolDefinition.renderCall/renderResult`)
  - [x] **Images in results** (base64 display)
  - [x] **Duration display** (durationMs)

- [x] **Create `src/bash-execution.ts`** (5h)
  - [x] Port pi's `BashExecutionComponent` class
  - [x] Streaming stdout/stderr with ANSI stripping
  - [x] Preview mode (last 20 lines) + expanded mode (all lines)
  - [x] Visual line truncation (`truncateToVisualLines`)
  - [x] Exit code pill: green (0), red (non-zero), yellow (cancelled)
  - [x] **Truncation warning** with full output path
  - [x] **Command header** with `$` prompt
  - [x] **Color key**: normal vs excluded-from-context (`!!`)

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
  - [x] **Save as default** (Ctrl+S) → persist to preferences
  - [x] **Async catalog refresh** with progress
  - [x] **Error handling** for provider failures
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
  - [x] **Delete session**: Ctrl+D → archive via runtime.manageSession
  - [x] **Rename session**: Ctrl+R → onRename callback
  - [x] **Progress loading** with loaded/total
  - [x] Current session marker (accent color)
  - [x] Named session badge (warning color)
  - [x] Message count + age display
  - [x] CWD display (All scope)
  - [x] Wire to `runtime.sessions()`, `runtime.renameSession()`, `runtime.manageSession()`, `runtime.sessionDirectory()`

- [x] **Test & Verify** (2h) ✅ COMPLETE
  - [x] Model selector: fuzzy search, scoped toggle, save default
  - [x] Session selector: tree view, search, delete, rename, scope toggle
  - [x] Keyboard shortcuts all work
  - [x] Persist selections to preferences

---

## Phase 4: Polish Systems (Week 4 - 16h) ✅ CORE COMPLETE

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

- [x] **Add Keybinding Hints in UI** (HIGH) ✅ COMPLETE
  - [x] Header: Dynamic key hints (logo click, key hints)
  - [x] Footer: Key hints for current context
  - [x] Selectors: Show hints in footer (Tab=scope, Ctrl+S=sort, etc.)
  - [x] Dialogs: Show hints (Enter=select, Esc=cancel)

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

- [x] **Test & Verify** (1h) ✅ COMPLETE
  - [x] Theme loads, live reload works
  - [x] Keybindings load, hot reload works
  - [x] All shortcuts functional

### 4.3 Bash Mode & Thinking Toggle ✅ COMPLETE

- [x] **Bash mode in `ui.ts`** (1h)
  - [x] Detect `!` prefix in editor → `isBashMode = true`
  - [x] `!!` prefix → excluded from context
  - [x] Show `BashExecutionComponent` in transcript
  - [x] Border color change for bash mode

- [x] **Thinking block click-toggle** (1h)
  - [x] In `components/assistant-message.ts`
  - [x] Click thinking block → expand/collapse
  - [x] Configurable hide via settings

- [x] **Copy message (Ctrl+X)** (0.5h) ✅ COMPLETE
  - [x] Copy last assistant message or selection to clipboard

- [x] **External editor (Ctrl+G)** (0.5h) ✅ COMPLETE
  - [x] Open `$EDITOR` with current editor text
  - [x] On save, update editor content

---

## Phase 5: Message Components (Week 5 - 8h) ✅ COMPLETE

### 5.1 Assistant Message Component ✅ COMPLETE

- [x] **Create `src/assistant-message.ts`** (3h)
  - [x] Port pi's `AssistantMessageComponent`
  - [x] Markdown rendering with transformers
  - [x] Thinking blocks: click to toggle visibility
  - [x] Hidden thinking label: "Thinking..." (configurable)
  - [x] **OSC133 shell integration** (zone markers) ✅ COMPLETE
  - [x] **Stop reason display**: error/aborted/length ✅ COMPLETE
  - [x] Streaming support: `updateContent(message, isStreaming)`

### 5.2 User Message Component ✅ COMPLETE

- [x] **Create `src/user-message.ts`** (1h)
  - [x] Port pi's `UserMessageComponent`
  - [x] Command highlighting (accent)
  - [x] Queued message styling (dim)
  - [x] **OSC133 shell integration** (zone markers) ✅ COMPLETE
  - [x] Reference highlighting (@file, @skill, paths) ✅ COMPLETE

### 5.3 Integration ✅ COMPLETE

- [x] **Wire in `ui.ts`** (2h)
  - [x] Replace `StreamingMarkdown` + `Text` with new components
  - [x] Handle `message_start` (assistant) → create `AssistantMessageComponent`
  - [x] Handle `message_update` → `component.updateContent(message, true)`
  - [x] Handle `message_end` → `component.updateContent(message, false)`
  - [x] Handle thinking blocks in streaming

---

## Phase 6: Missing Polish (Week 6-8 - 40h) ✅ COMPLETE

### 6.1 Status Indicators (HIGH) - 8h ✅ COMPLETE

- [x] **Create `src/components/status-indicator.ts`** (4h)
  - [x] `WorkingStatusIndicator` - spinner with message
  - [x] `RetryStatusIndicator` - retry count, message
  - [x] `CompactionStatusIndicator` - spinner + label (no progress bar; §8.17 wired it to DSH's `compaction/start`/`compaction/end`)
  - [x] `IdleStatus` - ready state
  - [x] Wire into `ui.ts` status container

- [x] **Wire into `ui.ts`** (4h)
  - [x] Show/hide based on runtime state (working → idle → stopping)
  - [x] `StatusIndicatorContainer` manages transitions
  - [x] Layout: scroll → status → editor

### 6.2 Header Component (HIGH) - 8h ✅ COMPLETE

- [x] **Create `src/components/header.ts`** (4h)
  - [x] Logo (whale logo, lazydsh branding)
  - [x] Version display
  - [x] Keybinding hints (compact + expandable full list)
  - [x] Click to expand/collapse full hints
  - [x] **Changelog display** (collapsible) ✅ COMPLETE
  - [x] Model scope notice — deferred (not needed)

- [x] **Wire into `ui.ts`** (4h)
  - [x] Replaces StartupBanner
  - [x] Header sits above transcript in the scroll container

### 6.3 Keybinding Hints in UI (HIGH) - 6h ✅ COMPLETE

- [x] **Hints follow configured keybindings** (src/keybinding-hints.ts)
  - [x] keyHint/keyDisplayText helpers used everywhere
  - [x] Picker hints reflect the user keybindings (not hardcoded keys)

- [x] **Wired into pickers/dialogs** (3h)
  - [x] SearchPicker: move/select/back + type-to-filter + quick-pick
  - [x] SearchPicker supports extra contextual hints via setHints()
  - [x] ApprovalPanel + QuestionPanel hints

### 6.4 Model Selector Polish (HIGH) - 6h ✅ COMPLETE

- [x] **Async catalog refresh** with status message
- [x] **Error handling** for provider failures
- [x] **Save as default** (Ctrl+S) → onSelectAsDefault callback
- [x] **Scoped/All toggle** with Tab

### 6.5 Session Selector Polish (HIGH) - 8h ✅ COMPLETE (DSH-native)

- [x] **Rewrote as DSH-native component** (src/session-selector.ts)
- [x] **Progress loading** with loaded/total
- [x] **Archive action** (Ctrl+D) → runtime.manageSession (no file ops needed)
- [x] **Rename action** (Ctrl+R) → onRename callback
- [x] **Current session marker** (accent ✓) + pinned marker (★)
- [x] **Fuzzy search** over id/title/directory
- [x] **Scope toggle** (Tab: all folders / current folder)
- [x] **Sort toggle** (Ctrl+S: threaded/recent/relevance)
- [x] **Named filter** (Ctrl+N) + **path toggle** (Ctrl+P)
- [x] **Wired into /resume** in ui.ts with toSessionRecords adapter
- [x] Runtime.sessions() now returns modified + messageCount

### 6.6 Login Dialog (MEDIUM) - 6h ✅ COMPLETE

- [x] **Create `src/components/login-dialog.ts`** (4h)
  - [x] OAuth notice with spinner + device code
  - [x] Secret input (API key) with placeholder
  - [x] Select list for login-method choice
  - [x] Wired into Runtime.onAuth in ui.ts

### 6.7 External Editor Integration (MEDIUM) - 4h ✅ COMPLETE

- [x] **Ctrl+G** → open `$VISUAL`/`$EDITOR` with current text (src/external-editor.ts)
- [x] Temp file handling, cleanup on exit
- [x] On save, editor content replaced

### 6.8 Copy Message (MEDIUM) - 2h ✅ COMPLETE

- [x] **Ctrl+X** → copy last transcript message to clipboard (src/clipboard.ts)
- [x] Native clipboard helper with pbcopy/clip/wl-copy/xclip fallback

### 6.9 Thinking Selector (MEDIUM) - 3h ✅ COMPLETE

- [x] **Ctrl+T** → cycle thinking level (cycles runtime.efforts() list)
- [x] Applies /effort and reports the new level in the transcript
- [x] **Thinking Selector Component** (src/components/thinking-selector.ts) with fuzzy search, save-as-default, scoped/all toggle

### 6.10 Message Components Polish (MEDIUM) - 6h ✅ COMPLETE

- [x] **Assistant Message**: OSC133 zones + stop reasons (error/aborted/length)
- [x] **User Message**: OSC133 zones + markdown + userMessage tokens
- [x] add() in ui.ts now renders final answers via AssistantMessageComponent
- [x] add() sends user messages via UserMessageComponent

### 6.11 Bug Report (LOW) - 4h ✅ COMPLETE

- [x] **`/bug` command** with auto-attached crash details
- [x] Collects version, node, platform, session info, environment
- [x] Opens GitHub issue with pre-filled template

### 6.12 Program Status (LOW) - 3h ✅ COMPLETE

- [x] **OSC 7501** shell integration (idle/working/blocked/done/error)
- [x] src/program-status.ts wraps pi-tui formatProgramStatus
- [x] Wired to ui.ts: working on turn start, done on turn end, blocked on panels

### 6.13 Session Share (LOW) - 4h ✅ COMPLETE

- [x] **`/share` command** generates share link for session
- [x] src/session-share.ts with generateShareLink()
- [x] Placeholder URL (ready for sharing service integration)

### 6.14 Model Catalog Refresh (LOW) - 4h ✅ COMPLETE

- [x] **Background refresh** with progress (src/model-catalog-refresh.ts)
- [x] **Error handling** with timeout and error display
- [x] **Scoped/All toggle** with Tab in Model Selector

### 6.15 Changelog Display (LOW) - 3h ✅ COMPLETE

- [x] **`/changelog` command** shows version history
- [x] src/changelog.ts with expand/collapse toggle
- [x] Hardcoded entries (ready for GitHub releases API)

### 6.16 Theme System Enhancements (LOW) - 4h ✅ COMPLETE

- [x] **ThemedText component** (src/components/themed-text.ts) for live theme updates
- [x] **Theme Selector component** (src/components/theme-selector.ts) with live preview
- [x] **getAvailableThemes()** in theme.ts for theme discovery
- [x] **getAvailableThemesWithPaths()** for theme metadata

### 6.17 Extension Widgets (LOW) - 4h ✅ COMPLETE

- [x] **Widget registry** (src/extensions.ts)
- [x] Widgets above/below editor in layout
- [x] ExtensionWidgetRegistry with priority ordering

### 6.18 Settings Selector (LOW) - 4h ✅ COMPLETE

- [x] **`/settings` command** opens settings UI
- [x] src/settings-selector.ts with categories: General, Appearance, Keybindings, Extensions, About
- [x] Toggle, select, info item types
- [x] Opens keybindings config file, GitHub repo

---

## Phase 7: Documentation & Final Testing (Week 9-10 - 20h) ✅ COMPLETE

### 7.1 Documentation - 8h ✅ COMPLETE

- [x] Update `README.md` with new features
- [x] Add keybindings reference
- [x] Add theme customization guide
- [x] Document tool card interactions

### 7.2 Performance Audit - 6h ✅ COMPLETE

- [x] Profile cold startup (~122ms, < 500ms target)
- [x] Profile streaming frame rate (30+ fps target)
- [x] Memory leak check (long session)
- [x] Optimize any bottlenecks

### 7.3 Final Testing - 6h ✅ COMPLETE

- [x] Full integration test: ask, resume, login, logout, upgrade
- [x] All slash commands work
- [x] All tools render correctly
- [x] Session fork/resume/archive/pin work
- [x] Model cycling works
- [x] Theme/keybinding persistence works

---

## Phase 8: Upstream Parity (Cherry-pick from pi-coding-agent) ✅ COMPLETE

**Test Suite**: 111/111 passing (was 51/95 at start)

### 8.0 Housekeeping ✅

- [x] Remove debug `appendFileSync("/tmp/afp.log", ...)` from `src/dsh-boot.ts`

### 8.1 Quick wins ✅

- [x] **`-v, --version` flag** (`src/cli.ts`)
- [x] **`runtime.cancel()` completeness** (`src/runtime.ts`)

### 8.2 Ctrl+C interrupts the turn ✅

- [x] **Create `src/interrupt.ts`** — `ctrlCAction(state)` pure state machine
- [x] **Wire in `src/ui.ts`** — draft→clear, active→interrupt, cancelling→force-exit, idle→exit
- [x] **Tests** — port `test/interrupt.test.ts`

### 8.3 `/new` keeps transcript, `/clear` wipes ✅

- [x] `startNewConversation(clearScreen)` in `src/ui.ts`

### 8.4 QuestionPanel fits short terminals ✅

- [x] Rewrite `src/question.ts` render budget
- [x] Add `panelHeight()` to `src/ui.ts`
- [x] Port upstream tests

### 8.5 History shows reasoning ✅

- [x] `reasoningText(content)` in `src/runtime-events.ts`
- [x] `historyRows()` pushes `ThinkingView` row
- [x] Tests: history restores reasoning rows

### 8.6 Meta plumbing end-to-end ✅

- [x] `eventText()` returns `meta` from `tool/*` events
- [x] `ToolLog.record()` passes meta into the row

### 8.7 `detail.ts` — one detail engine ✅

- [x] `prettyArguments(raw)` — JSON args → compact lines
- [x] `readFileDiffs(meta)` — extract diffs from tool meta
- [x] `detailDiff(diffs, width)` — word-level diff reusing `src/diff.ts`
- [x] `toolDetails(...)` — one entry point for approval + history
- [x] **Approval panel** (`src/approval.ts`): tool title, arguments, expandable diff
- [x] **History rows** (`src/tools.ts`): expandable `ToolRow` with mouse support

### 8.8 Deps `0.2.2-rc.4` ✅

- [x] Bump all 36 `@deepseek-ai/dsh-*` packages
- [x] Verify old sessions still resume

### 8.9 Overlay panel follow-ups ✅

- [x] **`/model` overlay** — nested provider→model pickers with stack
- [x] **Inverted `selecting` guards fixed** — pickers fill items only while open
- [x] **Login dialog overlay no longer leaks** — dismiss in finally
- [x] **Header version no longer hardcoded** — reads `package.json`
- [x] Tests: `test/version.test.ts` + dist smoke test

### 8.10 Wire the unwired selectors ✅

- [x] **Theme selector reachable** — `/settings` → Appearance → Theme
- [x] **Thinking selector reachable** — `/effort` opens `ThinkingSelectorComponent`
- [x] Tests: `test/settings-selector.test.ts` + `test/thinking-selector.test.ts`

### 8.11 Wire the remaining orphans or delete them ✅

- [x] **Theme schema validation is real** — `typebox/compile` import, validates user themes
- [x] **`tui-renderer.ts` is real** — `ui.ts` uses `createInteractiveTui()`
- [x] **Deleted dead code** — `ui-commands.ts`, `chat-viewport.ts`
- [x] Tests: `test/theme-schema.test.ts` — 121/121 passing

### 8.12 Wire `ModelSelectorComponent` ✅

- [x] **`/model` uses real selector** — fuzzy search, current marker, save-as-default
- [x] **Adapter for missing contract** — `model-catalog-runtime.ts` presents DSH catalog
- [x] Tests: `test/model-catalog-runtime.test.ts` — 123/123 passing

### 8.13 Auto light/dark theme setting ✅

- [x] **Pair setting reachable** — `auto (follow terminal)` row in theme picker
- [x] Tests: `test/theme-selector.test.ts` — 126/126 passing

### 8.14 Wire the advertised-but-dead keybindings ✅

- [x] **6 global keys now handled**: Ctrl+L, Ctrl+P, Alt+Enter, Alt+Up, Ctrl+D, Ctrl+Z, Ctrl+Backspace
- [x] Model cycling refuses mid-turn switches
- [x] Tests: `test/model-cycle.test.ts` — 129/129 passing
- [x] **No declared keybinding left unhandled** (except pi-tui internal)

### 8.15 Theme setting persistence ✅

- [x] **Persist to `~/.config/lazydsh/theme.json`** — name or `<light>/<dark>` pair
- [x] Tests: `test/theme-settings.test.ts` — 133/133 passing
- [x] README config paths corrected

### 8.16 Real settings: confirm-exit, honest info rows ✅

- [x] **Confirm-on-exit real** — `src/interactive-mode/settings-store.ts`
- [x] Three cosmetic toggles → honest info rows
- [x] Tests: `test/ui-settings.test.ts` + rewritten `test/settings-selector.test.ts` — 137/137 passing

### 8.17 Retry + compaction status rows are live ✅

- [x] Retry/compaction indicators never fired — `ui.ts` only showed `working`/`idle`, making `RetryStatusIndicator` and `CompactionStatusIndicator` dead code and README's "Progress bar + Compacting context" fiction. The session-event handler now maps DSH's `llm/retry` (attempt/maxRetries/delayMs), `llm/retry-started`, `step/start`, `compaction/start`, `compaction/end` onto the status row; `StatusOptions` gained `maxAttempts` instead of a hardcoded 3.
- [x] Fixed a mislabeled state: cancelling a turn showed the retry row (which renders its own text) — a bogus `Retrying (1/3) in 1s…` instead of `Stopping`. It uses the working row now.
- [x] README's status table corrected (no progress bar; countdown + cancel hint documented).
- [x] Tests: `test/status-container.test.ts` — 141/141 passing

### 8.18 Footer extension-status row is live ✅

- [x] The footer's extension status registry was unreachable — `setExtensionStatus` had no caller, so the row always rendered empty and README's "extensions" footer claim was fiction. `ExtensionWidget` gained an optional `status?: () => string | undefined` hook; `ui.ts`'s `update()` syncs every registered widget (widgets that stop reporting drop out), and the footer filters empty statuses.
- [x] Dead parameters removed: `createFooterDataProvider` took `_getSessionName`/`_getModelRuntime` callbacks nothing consumed (ui.ts built throwaway adapters for them).
- [x] Tests: `test/footer-data-provider.test.ts` (set/sanitize/remove/clear, footer row rendering + empty filtering, provider count, token/cwd formatting) — 145/145 passing

---

## ✅ FINAL VERIFICATION CHECKLIST

- [x] Ctrl+C during a turn interrupts (not exits); second press force-exits; idle exits; draft clears
- [x] `--version` prints the package version
- [x] `/new` keeps the transcript, `/clear` wipes it
- [x] Question panel never pushes choices off screen at 80x24 and below
- [x] Resumed sessions show reasoning rows and expandable tool details with diffs
- [x] Approval prompts show tool name, arguments, and diff before allowing
- [x] Pickers that load asynchronously (`/archive`, `/ps`, `/cd`, …) fill their items while open and close on error
- [x] Login dialogs (notice/secret/select) vanish when the flow settles or aborts

**Suite: 111/111 passing** (was 51/95 at the start of Phase 8)

---

## 📦 Dependencies Added

```bash
npm i diff @types/diff
```

---

## 🎯 CURRENT STATE: PRODUCTION READY

**lazydsh now matches pi-coding-agent interactive mode feature parity.**

All Phases 1-8 complete. Test suite: 111/111 passing.

---
