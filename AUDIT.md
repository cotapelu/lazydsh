# AUDIT.md — Full Logic Flow Analysis: Interactive Mode (lazydsh)

> **Scope**: Every logic flow in `src/interactive-mode/` + `src/runtime/` integration.
> **Perspective**: LLM-readable architectural audit — no code dumps, pure logic descriptions.
> **Order**: Atomic operations → Composed flows → System-level loops.

---

## 0. GLOSSARY (Terms used throughout)

| Term                 | Meaning                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **TUI**              | `@earendil-works/pi-tui` — React-like terminal UI framework (components, layout, input, overlay, ANSI rendering).    |
| **Runtime**          | `src/runtime/runtime.ts:Runtime` — TypeScript wrapper around DSH Agent, exposes async API to UI.                     |
| **DSH**              | DeepSeek Harness — Cordis-based agent platform (101 plugins). Runs in same process.                                  |
| **Callbacks**        | `interfaces.ts:Callbacks` — Three hooks Runtime calls when it needs human: `onAuth`, `onApproval`, `onUserQuestion`. |
| **Overlay**          | `tui.showOverlay(panel)` — Modal panel stacked above editor; `dismissPanel()` pops.                                  |
| **Deferred Plugins** | 50+ plugin rows disabled at boot, mounted after first paint (`runtime/deferred.ts`).                                 |
| **ToolRow**          | `tools.ts:ToolRow` — One expandable row per tool call (pending → result/diff).                                       |
| **Streaming**        | Incremental rendering: reasoning + answer deltas → same `AssistantMessageComponent`.                                 |

---

## 1. ATOMIC OPERATIONS (Smallest reusable logic units)

### 1.1 Theme Token Resolution

- **Input**: Token name (e.g., `"accent"`), text string.
- **Process**: `theme.fg(token, text)` → looks up ANSI sequence from active `Theme` instance (proxy).
- **Fallback**: Token `""` → terminal default (`\x1b[39m` / `\x1b[49m`).
- **Dim**: `dimTokens` set → wraps with `\x1b[2m`.
- **Key property**: Proxy ensures every component reads **current** theme on every render — no rebuild needed on theme switch.

### 1.2 Keybinding Matching

- **Source**: `KeybindingsManager` (pi-tui) + user `~/.config/lazydsh/keybindings.json` (hot-reload via `watchFile`).
- **Matching**: `kb.matches(inputData, actionId)` → boolean.
- **Actions**: 27 `app.*` + pi-tui `tui.*` (editor, select, input, altScreen).
- **Platform diff**: Windows vs Unix defaults (e.g., `Ctrl+Z` only Unix, `Ctrl+Shift+P` vs `Alt+P`).

### 1.3 Component Render Cache

- **Pattern**: Every pi-tui `Component` caches `render(width)` output keyed by `(width, revision)`.
- **Invalidation**: `invalidate()` bumps revision → next render recomputes.
- **Layout**: `TUI.invalidate()` cascades to all children → full re-render on theme change, resize, overlay open/close.

### 1.4 Overlay Stack Management

- **Push**: `showPanel(panel)` → `tui.showOverlay()` → returns `OverlayHandle` → push to `overlayHandles[]`.
- **Pop (single)**: `dismissPanel(false)` → pop last handle → `handle.hide()`.
- **Pop (all)**: `dismissPanel(true)` → while stack not empty → pop & hide.
- **Focus**: `tui.setFocus(panel)` on push; `tui.setFocus(editor)` on pop to empty.
- **Selecting flag**: `selecting = overlayHandles.length > 0` — blocks editor input, pauses queue drain.

### 1.5 AbortSignal Composition

- **Pattern**: `AbortSignal.any([signalA, signalB, AbortSignal.timeout(ms)])`.
- **Usage**: Every async operation (API call, picker load, shell exec) accepts `signal` from caller + local timeout.
- **Cleanup**: `finally` blocks always `removeEventListener` for abort handlers.

### 1.6 Safe Runtime Access (First Paint)

- **Problem**: Before deferred plugins attach, `Runtime` is a **throwing proxy** — any property access throws "lazydsh is still starting".
- **Solution**: `safeRead(runtime, () => runtime.xxx)` → returns `undefined` on throw.
- **Used by**: Footer, status, autocomplete during `starting === true` window.

### 1.7 ToolRow Lifecycle (tools.ts)

- **Create**: `ToolLog.record(output)` → new `ToolRow(summary)` with `callId`.
- **Pending**: `tool_execution_start` → `row.setCall(rawArgsJson)`.
- **Settle**: `tool_execution_end` → `row.finish(status, resultText, reason, meta)`.
- **Expand**: Click → `row.toggle()` → renders `detail.ts:toolDetails(args, result, meta, width)`.
- **Replay**: History calls `ToolLog.record()` with final events → same `ToolRow` instances → identical render.

### 1.8 Incremental Highlighting (stream-highlight.ts)

- **Per-language state machine**: Tracks `blockComment`, `quote` (single/double/backtick), `lineComment`.
- **Scan**: Line-by-line → emits `ScanState` (unterminated block/quote).
- **Safe line**: Lines before first unsafe line → frozen, highlighted once.
- **Tail**: Unsafe region → re-highlighted on each delta, rate-limited (max 400 pending lines, 200ms refresh).
- **Opaque fallback**: Unknown language → whole-snippet highlight, throttled at 48 lines.

### 1.9 Streaming Markdown (streaming.ts)

- **Scanner**: `StreamScanner` finds completed block boundaries (blank line not inside fence/math).
- **Blocks**: Completed blocks → cached `Markdown` components (render once).
- **Tail**: Unfinished fence/math → `StreamingMarkdown` tail with incremental highlighter.
- **Final**: `setFinal(text)` → single `Markdown` for entire answer (restores fence highlighting).

### 1.10 Mermaid Transformer (mermaid.ts)

- **Trigger**: Top-level ```mermaid code blocks.
- **Render**: `lovely-mermaid` → Unicode braille art.
- **Constraints**: Max width = terminal width; warnings appended if diagram too wide.
- **Streaming**: Disabled during streaming (raw markdown shown until completion).

---

## 2. COMPOSED FLOWS (Atomic ops combined)

### 2.1 Boot Sequence (ui.ts lines 2280–2332)

1. **Create TUI**: `createInteractiveTui({tuiMode: "fullscreen", mouse: true})` → `TuiAltScreen`.
2. **Component Tree**:
   - `HeaderComponent` (whale logo + key hints)
   - `Transcript` (chat history container)
   - `QueueView` (queued follow-ups)
   - `PromptEditor` (input + autocomplete)
   - `StatusIndicatorContainer` (working/retry/compaction/idle)
   - `ProgramStatusReporter` (OSC 7501 shell integration)
   - `FooterContainer` → lazy `FooterComponent` (needs Runtime)
   - Extension widget containers (above/below editor)
3. **ThemeController**: `applyFromSettings()` → DA1 query (100ms) → auto-sync light/dark.
4. **Keybindings**: `getAppKeybindings().startWatching()` → hot-reload.
5. **Console Capture**: `captureConsole(logFile)` → redirect `console.*` to file.
6. **Start TUI**: `tui.start()` → enters alt screen, enables raw mode.
7. **First Paint**: `tui.renderNow()` → header + empty transcript + editor visible.
8. **After First Paint Hook** (async, blocks editor submit):
   - `catalog.validateRoute(provider, model)`
   - `packages.refresh()` (Cordis plugin resolution)
   - `activateDeferredPlugins(ctx, rows)` — 50+ rows mounted in parallel, each with 5s timeout
   - `waitForRuntimeServices(ctx)` — polls 14 services (agents, llm, commands, attachments, sessionProjections, authorization, credentials, userQuestions, sessionTitle, workspaceRegistry, jobs, fileReferences, skills, workingDirectory) — 15s deadline
   - `pending.attach(await createRuntime(ctx, options, effort))` — **swaps throwing proxy for real Runtime**
   - `starting = false` → editor enabled.
9. **Wait DA1**: `themeController.waitForTerminalColors()` — terminal color response.
10. **Initial Connect**: If `route.model` → `connect()`; else `pickModel()` / `pickProviderModel()`.

**Critical UX Gap**: Steps 8 takes 2–5s. Editor disabled, **no progress indicator**. User sees UI but cannot type.

### 2.2 Session Connect (`connect()` — ui.ts lines 690–764)

1. `runtime.open(route, callbacks)`:
   - Resume? → `agents.resume({resumeSessionId, agentOptions})`
   - New? → `agents.create({sessionId, meta, agentOptions})`
2. `persistSelection()` → save `{provider, model, effort}` to `$DSH_HOME/lazydsh-model.json`.
3. `runtime.cd(requestedDirectory)` → switch working dir.
4. `runtime.commands()` → build `commandMenu()` for autocomplete.
5. `setAutocomplete()` → new `Autocomplete(commands, cwd, runtime.references)`.
6. `toolLog.entries.clear()` + `clearQueue()`.
7. `transcript.clear()` (unless `keepTranscript`).
8. **History Replay** (sync, blocking):
   - `runtime.history()` → all `SessionEvent[]`
   - `historyRows(events, sessionId)` → `HistoryRow[]`:
     - User messages → `UserMessageComponent`
     - Assistant → `AssistantMessageComponent` (reasoning folded in)
     - Tool calls → `ToolRow` (via `ToolLog.record()`)
     - Commands → `Notification`
     - Turn metrics → `Text(dim)`
   - `transcript.addChild()` for each row.
   - `scroll.scrollToEnd()`.
9. `probeCredentialSource(provider)` → if env var → notify once.

**Performance Risk**: `historyRows()` creates **one component per event**. 10k events = 10k components = lag/OOM. No virtualization, no pagination.

### 2.3 Input Submission (`editor.onSubmit` — ui.ts lines 1284–1916)

#### Branch A: Bash Mode (`!cmd` / `!!cmd`)

- `parseBashMode(text)` → `{command, prefix, excludeFromContext}`.
- `runBash(intent)` → `runtime.shell(command, {signal})` → `ShellExecutor` (DSH sandbox).
- `BashExecutionComponent` streams stdout/stderr, shows exit code, truncation (10k lines / 1MB).
- `bashContextBlock(intent, result)` → prepend to next prompt (`!cmd`) or drop (`!!cmd`).

#### Branch B: Queue Follow-up (`Alt+Enter`)

- `enqueue(text)` → `QueuedMessage` in `QueueView` + history.
- `drainQueue()` called after each turn ends → `editor.onSubmit(queuedText)`.

#### Branch C: Slash Commands (~35)

| Command                               | Flow                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| `/clear`                              | `startNewConversation(true)` → clear transcript, new session       |
| `/quit`                               | `stop()` → `runtime.close()` → shutdown                            |
| `/bug`                                | `reportBug()` → GitHub issue URL with context                      |
| `/share`                              | `generateShareLink()` → placeholder URL                            |
| `/changelog`                          | `showChangelog()` → `ChangelogComponent` overlay                   |
| `/debug`                              | Full TUI render dump to console                                    |
| `/copy`                               | `copyLastMessage()` → clipboard                                    |
| `/name`                               | `renameSession()` → prompt → `runtime.renameSession()`             |
| `/hotkeys`                            | Static help text                                                   |
| `/clone`                              | `forkSession(lastTurn)` → new session → `connect()`                |
| `/settings`                           | `SettingsSelectorComponent` overlay (categories, toggles, selects) |
| `/model`                              | `pickModel()` → `ModelSelectorComponent`                           |
| `/new`                                | `startNewConversation(false)` → keep transcript                    |
| `/login` `/logout`                    | `signIn()` / `signOut()` → **see Auth Flow (2.5)**                 |
| `/resume` `/cd` `/permission`         | `runtime.choices(kind)` → `SearchPicker`                           |
| `/archive` `/restore` `/pin` `/unpin` | `SessionSelector` → `runtime.manageSession()`                      |
| `/ps` `/stop`                         | Job picker → `runtime.job(id, stop)`                               |
| `/session`                            | Show session ID                                                    |
| `/effort`                             | `ThinkingSelectorComponent` → `runtime.run("/effort " + level)`    |
| `/status`                             | `StatusPanel` → `runtime.stats(connect=true)` (blocking)           |
| `/file`                               | `runtime.attach(path)` → pending attachment                        |
| `/dsh`                                | Native DSH command passthrough                                     |

#### Branch D: Normal Prompt → `runtime.run()`

1. `bashContext` (from previous `!cmd`) + user text → single prompt.
2. `agent.followup(createUserMessage(...))`.
3. Register listeners:
   - `session/event` → events + tool events → `onEvent` callback
   - `agent/assistant-stream` → `assistant.delta` / `assistant.reasoning`
   - `agent/request-error` → auto-reauth on 401/403
4. `wait()` → `agent.whenIdle()` + subagent tree wait.
5. Build `RunResult` from events:
   - `finalResponse` = last assistant message text (or command output)
   - `finishReason` = completed / error / aborted
   - `events` = all session events this turn.

---

### 2.4 Streaming Response Loop (ui.ts lines 1738–1915)

1. `ensureLiveAssistant()` → create `AssistantMessageComponent` (streaming mode).
2. `renderLive(true)` → per-frame render.
3. **Event Handlers**:
   - `assistant.reasoning` → `liveReasoning += text` → `renderLive(true)`
   - `assistant.delta` → `liveText += text` → `renderLive(true)`
   - `session.event`:
     - `llm/retry` → `statusContainer.show("retry", {count, maxAttempts, delayMs})`
     - `compaction/start` → `statusContainer.show("compaction", {reason})`
     - `compaction/end` → `statusContainer.show("working")`
     - `compaction/summary` → `CompactionSummaryMessageComponent`
   - `tool_execution_start` → `toolLog.record()` → `ToolRow` (pending, expandable)
   - `tool_execution_end` → `toolLog.finish()` → `ToolRow` (result/diff)
   - `finish` → `renderLive(false, stopReason)` → settle component, clear `liveAssistant`.

**Missing**: `tool_execution_update` listener exists in comments only — **no live arg/result streaming**.

---

### 2.5 Authentication Flow (3 Entry Points)

#### Entry 1: CLI `lazydsh login [provider]`

- `cli.ts` → `plugin.ts` → `command-runner.ts` → `terminal-login.ts`
- **Creates own `TuiAltScreen`** (separate terminal session).
- `SearchPicker` for provider → `runtime.authenticate()` with inline `onAuth` using `Input`/`SecretInput`/`SearchPicker`.
- **Disconnected from main TUI** — different keybindings, no overlay, no transcript.

#### Entry 2: TUI `/login [provider]`

- `signIn(provider?)` → if no provider: `buildLoginProviderOptions()` → **BUG: creates fake OAuth+API key for every provider**.
- `OAuthSelectorComponent` overlay (fuzzy search, auth-type tabs, status badges).
- User picks `(providerId, authType)` → `startProviderLogin()`.
- `runtime.authenticate({provider, onAuth: callbacks.onAuth})`.

#### Entry 3: Auto-Reauth (during `runtime.run`)

- `runtime.authenticate({reauthenticate: true})` → skips "already logged in" check.
- Same `callbacks.onAuth` → `LoginDialog`.

#### Shared: `callbacks.onAuth` (ui.ts lines 543–594)

| Method                   | UI Component                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| `lazydsh/auth-notice`    | `LoginDialog(kind: "notice")` — **BUG: only spinner, no progress, no buttons** |
| `secret` (API key)       | `LoginDialog(kind: "secret")` — masked `Input`                                 |
| `select` (method picker) | `LoginDialog(kind: "select")` — `SearchPicker`                                 |

**LoginDialog Notice Kind Issues**:

- Only spinner "Waiting for authorization…"
- `handleInput`: only `Escape` works; `Enter` does nothing (except device-code branch overrides handler dynamically).
- No "Open Browser", "Copy Code", "Check Status", "Retry" buttons.
- No auto-close on success — relies on DSH callback returning.

#### `runtime.authenticate()` (runtime.ts lines 712–834)

1. `credentialSource(provider)` → if not `none`/`unknown` & not `reauthenticate` → return "Already logged in".
2. Loop:
   - `deepseek-official` → prompt `secret` (API key) → `ctx.credentials.set()`.
   - Others → `ctx.authorization.list().find(llm-pi-ai/${provider})` → if multiple methods → prompt `select` → `ctx.authorization.begin({interaction: {prompt, notify}})`.
3. `notify` → `onAuth("lazydsh/auth-notice", {url, code})` → `LoginDialog(notice)`.
4. `prompt` → `onAuth("lazydsh/auth-prompt", {kind, message, options?})` → `LoginDialog(secret/select)`.
5. **Silent Retry Bug**: User cancels `select` → `goingBack = true` → loop restarts **silently**, no user feedback.

---

### 2.6 Tool Execution Rendering

1. **Log** (`tools.ts:ToolLog`): `record(output)` → creates/updates `ToolRow` keyed by `[sessionId, callId]`.
2. **Detail** (`detail.ts`): `toolDetails(args, result, meta, width)` → args (pretty JSON), result, diffs (intra-line).
3. **Presenter** (`tool-presentation.ts`): `presentCall/presentResult` — maps DSH `ToolCallView`/`ToolResultView` → pi-tui components:
   - `terminal` → command + output + exit pill
   - `diff` → unified diff + intra-line highlight
   - `read` → line-numbered, syntax-highlighted
   - `search` → matches by file
   - `web` → sources / fetch summary
   - `generic` → fallback
4. **Rich Card** (`tool-execution.ts:ToolExecutionComponent`): **Dùng cho Bash mode** (`bash-execution.ts:BashExecutionComponent`), nhưng **chưa wired vào main transcript flow** cho tool calls thường.

**Missing Wire**: `tool_execution_update` event listener in `runtime.ts` only has comment — **no live streaming args/result** in `ToolRow`.

---

### 2.7 Overlay Panel System

- **Stack**: `overlayHandles: OverlayHandle[]` — LIFO.
- **Push**: `showPanel(panel)` → `tui.showOverlay({anchor: "center", margin: 2, minWidth: 50, maxHeight: rows-8})` → push handle → `tui.setFocus(panel)` → `selecting = true`.
- **Pop**: `dismissPanel(clearAll?)` → pop (or all) → `handle.hide()` → `selecting = overlayHandles.length > 0` → if false `tui.setFocus(editor)`.
- **Panels** (12+): `LoginDialog`, `ApprovalPanel`, `QuestionPanel`, `OAuthSelectorComponent`, `ModelSelectorComponent`, `SessionSelector`, `ThemeSelectorComponent`, `ThinkingSelectorComponent`, `SettingsSelectorComponent`, `SessionSelector` (resume), `FirstTimeSetupComponent`, `ChangelogComponent`.
- **Focus**: `panel.focused` setter → `tui.setFocus(panel)`.
- **Input**: `panel.handleInput(keyData)` → pi-tui `matchesKey` → navigation, confirm, cancel.
- **Height Budget**: `panelHeight()` → `terminal.rows - statusContainer.render().length` — dynamic on resize.

---

### 2.8 Session Management

| Action                     | Flow                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions()`               | `runtime.sessions()` → `SessionRecord[]` → `SessionSelector` (threaded tree, fuzzy search, scope toggle, sort toggle, named filter, path toggle). |
| `forkSession(boundary)`    | `runtime.forkPoints()` → pick turn → `runtime.forkSession(boundary)` → new session → `connect(childId)`.                                          |
| `renameSession(id, title)` | `runtime.renameSession(id, title)`.                                                                                                               |
| `manageSession(id, archive | restore                                                                                                                                           | pin | unpin)` | `runtime.manageSession()` → workspace registry. |
| `resume`                   | `selectSession()` → `SessionSelector` → optional `selectResumeDirectory()` → `connect(id, directory)`.                                            |

---

### 2.9 Model/Provider Cycling

- `cycleModel(±1)` → `model-cycle.ts:nextProvider(authenticatedProviders, current, direction)` → `connect({provider, model})`.
- `pickModel()` → `ModelSelectorComponent`:
  - Scoped/All toggle (authenticated providers vs all catalog).
  - Fuzzy search (`provider/model/name` + "default" badge).
  - Current marker ✓, default badge.
  - Live catalog refresh (15s timeout, shared coordinator).
  - Save-as-default (Ctrl+S) → `saveModel()`.

---

### 2.10 Status Indicators

- `StatusIndicatorContainer.show(kind, options)`:
  - `working` → `WorkingStatusIndicator` (spinner + message).
  - `retry` → `RetryStatusIndicator` (countdown timer, attempt/max).
  - `compaction` → `CompactionStatusIndicator` (reason: manual/overflow).
  - `idle` → `IdleStatus` (message).
- `ProgramStatusReporter` → OSC 7501 (idle/working/blocked/done/error) for shell integration.

---

### 2.11 Theme System

- `ThemeController`:
  - `applyFromSettings()` → resolve setting → `setTheme()` → `themeController.setAutoSync()` → `tui.setTerminalColorSchemeNotifications()`.
  - DA1 query (100ms) → `terminalColors` → `Theme` regenerates `colors` getter.
  - File watcher on `~/.config/lazydsh/themes/<name>.json` (100ms debounce) → hot reload.
  - Terminal color scheme change → `setTerminalColorScheme(scheme)` → reapply if auto.
- **Theme Proxy**: `theme` global proxy → every `theme.fg(token, text)` hits active `Theme` instance → instant update on switch.

---

### 2.12 Shutdown

1. `stop()` → `closing = true` → `decision?.(null)` → `runtime.close()` → `finish()`.
2. Signal handlers (SIGINT, SIGTERM) → `stop()`.
3. `restoreConsole()` → restore `console.*`.
4. `themeController.disableAutoSync()` → stop DA1, file watcher.
5. `tui.stop({preserveScreen: true})` → exit alt screen.
6. `continuationCommand(sessionId, resumeArgs)` → print `lazydsh resume <id> ...`.

---

### 2.13 Extensions

- `ExtensionWidgetRegistry` → `register(widget)` / `getWidgets(position)`.
- `createExtensionWidgetContainer(registry, "above"|"below")` → renders in layout.
- `FooterDataProvider` → `setExtensionStatus(id, text)` / `getExtensionStatuses()` → footer line 3.

---

### 2.14 Bash Mode

- `parseBashMode(text)` → `!cmd` / `!!cmd` → `{command, prefix, excludeFromContext}`.
- `runBash()` → `runtime.shell()` → `ShellExecutor` (DSH sandbox policy applies).
- `BashExecutionComponent` → streaming output, expandable, truncation (10k lines / 1MB).
- `bashContextBlock()` → `!cmd` prepends `[! cmd — exit N]\noutput` to next prompt; `!!cmd` drops.

---

### 2.15 Clipboard / External Editor

- `copyToClipboard(text)` → native clipboard / `pbcopy` / `clip` / `wl-copy` / `xclip`.
- `editInExternalEditor({content, command})` → temp file → `$EDITOR`/`$VISUAL` (fallback `nano`/`notepad`) → read back → strip VT codes.

---

### 2.16 Autocomplete

- `Autocomplete` extends `CombinedAutocompleteProvider` (pi-tui):
  - Triggers: `@` / `/`
  - `@` → `runtime.references(query, signal)` → files, skills, subagents.
  - `/` → `commandMenu()` slash commands.
  - File paths → pi-tui built-in.

---

### 2.17 History Replay

- `historyRows(events, sessionId)` → `HistoryRow[]`:
  - `UserMessageComponent`
  - `AssistantMessageComponent` (reasoning folded)
  - `ToolRow` (same instances as live — `ToolLog` replay)
  - `Notification` (commands, notices)
  - `Text(dim)` (turn metrics)
- `continuationCommand()` on exit → prints `lazydsh resume <id> ...`.

---

### 2.18 Footer

- **Line 1**: `pwd (git branch) • session name` — `FooterDataProvider` (git watcher 5s poll).
- **Line 2**: `↑tokens ↓tokens R/W CH% $cost context% model thinking` — computed from `SessionStats` + `FooterDataProvider`.
- **Line 3**: Extension statuses (sorted by id).
- **Git Branch**: `spawnSync("git", ["branch", "--show-current"], {cwd, timeout: 1s})` every 5s.

---

### 2.19 Mermaid / Code Highlighting

- **Mermaid**: `createMermaidMarkdownTransformer()` → `lovely-mermaid` → Unicode braille. Disabled during streaming. Max width = terminal width.
- **Streaming Markdown**: `StreamingMarkdown` + `StreamScanner` (completed blocks cached, tail incremental).
- **Incremental Highlight**: `IncrementalHighlighter` (per-language state machine, rate-limited).
- **Highlight.js**: Lazy language load (77 aliases), `highlightAuto` for unknown.

---

### 2.20 Settings

- `SettingsSelectorComponent` (categories: general/appearance/keybindings/extensions/about).
- `UiSettings` persisted to `~/.config/lazydsh/settings.json` (`confirmExit`, `mermaidMode`).
- Theme row → opens real `ThemeSelectorComponent` (live preview).

---

## 3. SYSTEM-LEVEL LOOPS (Largest cycles)

### 3.1 Main Event Loop

```
tui.start() → raw mode + alt screen
  └─ input → keybindings → editor.onSubmit / panel.handleInput
       └─ editor.onSubmit → runtime.run() → streaming loop → renderLive()
            └─ session.event / assistant.delta / tool events → UI updates
       └─ panel.handleInput → overlay navigation → confirm/cancel
  └─ tui.requestRender() → layout → component.render(width) → ANSI → stdout
  └─ SIGINT/SIGTERM → stop() → shutdown
```

### 3.2 Deferred Plugin Activation (Once per session)

```
afterFirstPaint:
  catalog.validateRoute()
  packages.refresh()
  activateDeferredPlugins(50+ rows) → parallel mount
  waitForRuntimeServices(14 services, 15s)
  pending.attach(createRuntime()) → proxy swap
```

### 3.3 Auto-Reauth Loop (Per failed request)

```
runtime.run() → agent/request-error (401/403)
  → runtime.authenticate({reauthenticate: true})
       → callbacks.onAuth → LoginDialog
       → success → retry original request
```

### 3.4 Compaction Loop (Context pressure)

```
session.event: compaction/start → statusContainer.show("compaction")
  → DSH summarizes history
  → session.event: compaction/summary → CompactionSummaryMessageComponent
  → session.event: compaction/end → statusContainer.show("working")
```

### 3.5 Retry Loop (LLM failures)

```
session.event: llm/retry → statusContainer.show("retry", {count, maxAttempts, delayMs})
  → wait delayMs
  → session.event: llm/retry-started → statusContainer.show("working")
  → repeat up to maxAttempts
```

### 3.6 Git Branch Watcher (Footer)

```
setInterval(5000):
  spawnSync("git", ["branch", "--show-current"], {cwd})
  → if changed → branchChangeCallbacks.forEach(cb()) → tui.requestRender()
```

### 3.7 Theme File Watcher

```
watch(customThemesDir):
  on change <name>.json → 100ms debounce → setTheme(name) → tui.invalidate() + requestRender()
```

### 3.8 Terminal Color Scheme Sync (Auto Theme)

```
tui.onTerminalColorSchemeChange(scheme):
  setTerminalColorScheme(scheme)
  if appearance changed → reapplyTheme() → DA1 query → tui.invalidate() + requestRender()
```

---

## 4. UX PROBLEMS INVENTORY (Prioritized)

### P0 — Critical (Blocks core workflow)

| #   | Flow                       | Problem                                                      | Impact                                           |
| --- | -------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| 1   | Boot (`afterFirstPaint`)   | Editor disabled 2–5s, **no progress indicator**              | User sees UI but cannot type; thinks frozen      |
| 2   | History Replay (`connect`) | **No virtualization** — 1 component per event                | 10k events = lag/OOM; first paint blocks         |
| 3   | Login (3 entry points)     | **Duplicate code**, fake OAuth options, broken notice dialog | Confusing, broken auth UX                        |
| 4   | Tool Streaming             | `tool_execution_update` **not wired**                        | No live args/result; ToolRow only updates on end |

### P1 — High (Degrades experience significantly)

| #   | Flow         | Problem                                                | Impact                               |
| --- | ------------ | ------------------------------------------------------ | ------------------------------------ |
| 5   | Footer Git   | **Polling 5s**                                         | Branch changes not realtime          |
| 6   | Theme DA1    | **Blocking first paint** (100ms+)                      | Delay before connect                 |
| 7   | Ctrl+C       | **4-state behavior** (clear/interrupt/force-exit/exit) | User confusion                       |
| 8   | `!!cmd`      | Output **dropped from transcript**                     | User forgets context                 |
| 9   | Queue        | **No visual indicator** for queued vs sent             | Unclear message state                |
| 10  | Silent Retry | `authenticate()` `goingBack` loop restarts silently    | User thinks cancelled, flow restarts |

### P2 — Medium (Polish gaps)

| #   | Flow                   | Problem                                     |
| --- | ---------------------- | ------------------------------------------- |
| 11  | Nested Panels          | No global ESC — must dismiss each           |
| 12  | Mermaid Streaming      | Disabled during stream — raw markdown shown |
| 13  | ToolExecutionComponent | Orphan — rich cards not used in transcript  |
| 14  | ApprovalPanel          | No "Always allow" option                    |
| 15  | ModelSelector          | No "test connection" button                 |

### P3 — Low (Nice to have)

| #   | Flow            | Problem                        |
| --- | --------------- | ------------------------------ |
| 16  | History         | No search/filter in transcript |
| 17  | Footer          | No cost breakdown per model    |
| 18  | SessionSelector | No "delete multiple"           |
| 19  | Theme           | No custom theme creator UI     |

---

## 5. ARCHITECTURAL OBSERVATIONS

### 5.1 Clean Separation (Good)

- **Runtime ↔ UI**: Only via `interfaces.ts` (types) + `runtime-events.ts` (events). No circular deps.
- **Callbacks**: UI owns all pixels; Runtime only sends structured events.
- **Theme**: Token-based, proxy — instant global updates.

### 5.2 Technical Debt (Needs refactor)

- **Login**: 3 code paths → should unify to single `OAuthSelectorComponent` + `LoginDialog`.
- **Tool Rendering**: `tool-execution.ts` dùng cho Bash mode nhưng **chưa dùng cho tool calls thường** → wire `tool_execution_update` + dùng `ToolExecutionComponent` trong transcript.
- **History**: Needs virtualization (render only visible window).
- **Boot**: Needs async progress indicator during deferred plugin activation.

### 5.3 Performance Risks

- `historyRows()` O(n) components — linear memory/time.
- `Footer` git spawnSync every 5s — blocks Node event loop briefly.
- `StreamingMarkdown` tail re-renders on every delta — fine for small, heavy for large code blocks.

---

## 6. RECOMMENDED FIX ORDER

1. **Unify Login** (P0#3) — delete `terminal-login.ts`, `command-runner.ts` login; route CLI `lazydsh login` through main TUI `signIn()`.
2. **Fix Fake OAuth Options** (P0#3) — `buildLoginProviderOptions()` → query `flow.methods` from `authorization`.
3. **Redesign LoginDialog Notice** (P0#3) — add progress, buttons, auto-close.
4. **Virtualize History** (P0#2) — render only visible transcript window + sentinel.
5. **Wire Tool Streaming** (P0#4) — implement `tool_execution_update` → `ToolRow.updateArgs()` / partial result.
6. **Boot Progress** (P0#1) — show deferred plugin activation progress in status area.
7. **Footer Git** (P1#5) — switch to file watcher (`.git/HEAD`) or async spawn.
8. **Ctrl+C Simplify** (P1#7) — 2 states: clear draft / interrupt turn.
9. **Fix Silent Retry** (P1#10) — throw on cancel, show "Cancelled" notice.
10. **Queue Indicator** (P1#9) — distinct style for queued messages.

---

## 7. FILE MAP (Key logic locations)

| Flow         | Primary Files                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Boot         | `ui.ts` (2280–2332), `runtime/dsh-boot.ts`, `runtime/deferred.ts`                                                                      |
| Connect      | `ui.ts` (690–764), `runtime/runtime.ts` (open)                                                                                         |
| Input/Submit | `ui.ts` (1284–1916)                                                                                                                    |
| Streaming    | `ui.ts` (1738–1915), `streaming.ts`, `stream-highlight.ts`                                                                             |
| Auth         | `ui.ts` (1035–1156), `runtime/runtime.ts` (712–834), `components/login-dialog.ts`, `components/oauth-selector.ts`, `terminal-login.ts` |
| Tools        | `tools.ts`, `detail.ts`, `tool-presentation.ts`, `tool-execution.ts`                                                                   |
| Panels       | `ui.ts` (766–810), `components/*.ts`                                                                                                   |
| Sessions     | `ui.ts` (2020–2060), `session-selector.ts`, `session-select.ts`                                                                        |
| Models       | `ui.ts` (904–991), `model-selector.ts`, `model-cycle.ts`                                                                               |
| Status       | `components/status-container.ts`, `components/status-indicator.ts`                                                                     |
| Theme        | `theme/theme.ts`, `theme/theme-controller.ts`, `theme/system-theme.ts`                                                                 |
| Footer       | `footer.ts`, `footer-data-provider.ts`                                                                                                 |
| History      | `history.ts`, `tools.ts`                                                                                                               |
| Bash         | `bash-mode.ts`, `bash-execution.ts`                                                                                                    |
| Settings     | `settings-selector.ts`, `settings-store.ts`                                                                                            |

---

**END OF AUDIT**
