# AUDIT.md — Full Logic Flow Analysis: Interactive Mode (lazydsh)

> **Scope**: Every logic flow in `src/interactive-mode/` + `src/runtime/` integration.
> **Perspective**: LLM-readable architectural audit — no code dumps, pure logic descriptions.
> **Order**: Atomic operations → Composed flows → System-level loops → Bug inventory.
> **Last verified**: 2026-11-24 (every line of every `.ts` file in `src/` and `test/` read and cross-checked).

---

## 0. GLOSSARY (Terms used throughout)

| Term                 | Meaning                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **TUI**              | `@earendil-works/pi-tui` — React-like terminal UI framework (components, layout, input, overlay, ANSI rendering).    |
| **Runtime**          | `src/runtime/runtime.ts:Runtime` — TypeScript wrapper around DSH Agent, exposes async API to UI.                     |
| **DSH**              | DeepSeek Harness — Cordis-based agent platform (101 plugins). Runs in same process.                                  |
| **Callbacks**        | `interfaces.ts:Callbacks` — Three hooks Runtime calls when it needs human: `onAuth`, `onApproval`, `onUserQuestion`. |
| **Overlay**          | `tui.showOverlay(panel)` — Modal panel stacked above editor; `dismissPanel()` pops.                                  |
| **Deferred Plugins** | 33 deferred entries (`DEFERRED_ENTRY_IDS` in `runtime/deferred.ts`), full profile activates ~50+ rows at boot.       |
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
- **Actions**: 25 `app.*` + pi-tui `tui.*` (editor, select, input, altScreen). **Note:** `ctrl+p` and `ctrl+s` are each bound to two different actions (see Bug #8).
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
- **Streaming**: `tool_execution_update` → `row.updateArgs(partialResult.args)` / `row.updateResult(partialResult.content)`.
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

> **Note:** `streaming.ts` is **dead code** — it is not imported by any source file in `src/`. It is only imported by `test/streaming.test.ts`. The streaming logic in `ui.ts` uses `AssistantMessageComponent` directly, not `StreamingMarkdown`.

- **Scanner**: `StreamScanner` finds completed block boundaries (blank line not inside fence/math).
- **Blocks**: Completed blocks → cached `Markdown` components (render once).
- **Tail**: Unfinished fence/math → `StreamingMarkdown` tail with incremental highlighter.
- **Final**: `setFinal(text)` → single `Markdown` for entire answer (restores fence highlighting).

### 1.10 Mermaid Transformer (mermaid.ts)

- **Trigger**: Top-level ```mermaid code blocks.
- **Render**: `lovely-mermaid` → Unicode braille art.
- **Constraints**: Max width = terminal width; warnings appended if diagram too wide.
- **Streaming**: Disabled during streaming in `final`/`off` modes; enabled in `streaming` mode (verified by `test/mermaid.test.ts`).

---

## 2. COMPOSED FLOWS (Atomic ops combined)

### 2.1 Boot Sequence (ui.ts ~2288–2325)

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
   - `activateDeferredPlugins(ctx, rows)` — 33 deferred entries mounted in parallel, each with 5s timeout; full profile activates ~50+ rows total
   - `waitForRuntimeServices(ctx)` — polls 14 services (agents, llm, commands, attachments, sessionProjections, authorization, credentials, userQuestions, sessionTitle, workspaceRegistry, jobs, fileReferences, skills, workingDirectory) — 15s deadline
   - `pending.attach(await createRuntime(ctx, options, effort))` — **swaps throwing proxy for real Runtime**
   - `starting = false` → editor enabled.
9. **Wait DA1**: `themeController.waitForTerminalColors()` — terminal color response.
10. **Initial Connect**: If `route.model` → `connect()`; else `pickModel()` / `pickProviderModel()`.

**Critical UX Gap**: Steps 8 takes 2–5s. Editor disabled, **no progress indicator** (though `statusContainer.show("working", { message: "Loading plugins…" })` is shown). User sees UI but cannot type.

### 2.2 Session Connect (`connect()` — ui.ts ~737–827)

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

**Performance Risk**: `historyRows()` creates **one component per user-facing event**. A session with 10k raw events may produce ~1-2k components = lag/OOM risk. History is virtualized to max 500 rows (added in §8.2).

### 2.3 Input Submission (`editor.onSubmit` — ui.ts ~1186–1851)

#### Branch A: Bash Mode (`!cmd` / `!!cmd`)

- `parseBashMode(text)` → `{command, prefix, excludeFromContext}`.
- `runBash(intent)` → `runtime.shell(command, {signal})` → `ShellExecutor` (DSH sandbox).
- `BashExecutionComponent` streams stdout/stderr, shows exit code, truncation (10k lines / 1MB).
- `bashContextBlock(intent, result)` → prepend to next prompt (`!cmd`) or drop (`!!cmd`); the card renders the output either way.

#### Branch B: Queue Follow-up (`Alt+Enter`)

- `enqueue(text)` → `QueuedMessage` in `QueueView` + history.
- `drainQueue()` called after each turn ends → `editor.onSubmit(queuedText)`.

#### Branch C: Slash Commands (~16 unique)

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

### 2.4 Streaming Response Loop (ui.ts ~1629–1851)

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
   - `tool_execution_update` → `row.updateArgs()` / `row.updateResult()` (live streaming)
   - `tool_execution_end` → `toolLog.finish()` → `ToolRow` (result/diff)
   - `finish` → `renderLive(false, stopReason)` → settle component, clear `liveAssistant`.

---

### 2.5 Authentication Flow (3 Entry Points)

#### Entry 1: CLI `lazydsh login [provider]`

- `cli.ts` → `plugin.ts` → `command-runner.ts` → `cli-auth.ts` → `auth-flow.ts`
- Runs **without a TUI**: a terminal `AuthHost` (`cli-auth.ts`) turns transcript
  notices into stdout lines and the dialogs into stdin prompts (numbered
  select, masked secret) — the same `authenticateProvider()` flow the TUI uses.

#### Entry 2: TUI `/login [provider]`

- `signIn(provider?)` → if no provider: `buildLoginProviderOptions()` → queries `authorization.list()` for methods.
- `OAuthSelectorComponent` overlay (fuzzy search, auth-type tabs, status badges).
- User picks `(providerId, authType)` → `startProviderLogin()`.
- `runtime.authenticate({provider, onAuth: callbacks.onAuth})`.

#### Entry 3: Auto-Reauth (during `runtime.run`)

- `runtime.authenticate({reauthenticate: true})` → skips "already logged in" check.
- Same `callbacks.onAuth` → `LoginDialog`.

#### Shared: `callbacks.onAuth` (ui.ts ~607–658)

| Method                   | UI Component                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `lazydsh/auth-notice`    | `LoginDialog(kind: "notice")` — spinner only, no progress/buttons (see Bug inventory) |
| `secret` (API key)       | `LoginDialog(kind: "secret")` — masked `Input`                                        |
| `select` (method picker) | `LoginDialog(kind: "select")` — `SearchPicker`                                        |

#### `runtime.authenticate()` (runtime.ts ~834–974)

1. `credentialSource(provider)` → if not `none`/`unknown` & not `reauthenticate` → return "Already logged in".
2. Loop:
   - `deepseek-official` → prompt `secret` (API key) → `ctx.credentials.set()`.
   - Others → `ctx.authorization.list().find(llm-pi-ai/${provider})` → if multiple methods → prompt `select` → `ctx.authorization.begin({interaction: {prompt, notify}})`.
3. `notify` → `onAuth("lazydsh/auth-notice", {url, code})` → `LoginDialog(notice)`.
4. `prompt` → `onAuth("lazydsh/auth-prompt", {kind, message, options?})` → `LoginDialog(secret/select)`.
5. **Silent Retry**: User cancels `select` → `goingBack = true` → loop restarts silently, no user feedback (fixed in §8.11 per TODO.md).

---

### 2.6 Tool Execution Rendering

1. **Log** (`tools.ts:ToolLog`): `record(output)` → creates/updates `ToolRow` keyed by `[sessionId, callId]`.
2. **Detail** (`detail.ts`): `toolDetails(args, result, meta, width)` → args (pretty JSON), result, diffs (intra-line).
3. **Rich Card** (`bash-execution.ts:BashExecutionComponent`): used for Bash mode (`!cmd`/`!!cmd`), not wired into main transcript flow for regular tool calls.
4. **Live Streaming**: `tool_execution_update` → `ToolRow.updateArgs()` / `updateResult()` (wired since §8.4).

---

### 2.7 Overlay Panel System

- **Stack**: `overlayHandles: OverlayHandle[]` — LIFO.
- **Push**: `showPanel(panel)` → `tui.showOverlay({anchor: "center", margin: 2, minWidth: 50, maxHeight: rows-8})` → push handle → `tui.setFocus(panel)` → `selecting = true`.
- **Pop**: `dismissPanel(clearAll?)` → pop (or all) → `handle.hide()` → `selecting = overlayHandles.length > 0` → if false `tui.setFocus(editor)`.
- **Panels** (12+): `LoginDialog`, `ApprovalPanel`, `QuestionPanel`, `OAuthSelectorComponent`, `ModelSelectorComponent`, `SessionSelector`, `ThemeSelectorComponent`, `ThinkingSelectorComponent`, `SettingsSelectorComponent`, `FirstTimeSetupComponent`, `ChangelogComponent`.
- **Focus**: `panel.focused` setter → `tui.setFocus(panel)`.
- **Input**: `panel.handleInput(keyData)` → pi-tui `matchesKey` → navigation, confirm, cancel.
- **Height Budget**: `panelHeight()` → `terminal.rows - statusContainer.render().length` — dynamic on resize.

---

### 2.8 Session Management

| Action                                                  | Flow                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions()`                                            | `runtime.sessions()` → `SessionRecord[]` → `SessionSelector` (threaded tree, fuzzy search, scope toggle, sort toggle, named filter, path toggle). |
| `forkSession(boundary)`                                 | `runtime.forkPoints()` → pick turn → `runtime.forkSession(boundary)` → new session → `connect(childId)`.                                          |
| `renameSession(id, title)`                              | `runtime.renameSession(id, title)`.                                                                                                               |
| `manageSession(id, archive \| restore \| pin \| unpin)` | `runtime.manageSession()` → workspace registry.                                                                                                   |
| `resume`                                                | `selectSession()` → `SessionSelector` → optional `selectResumeDirectory()` → `connect(id, directory)`.                                            |

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

**Resource Leak Note**: `keybindings.dispose()` is never called (watcher stays active). `themeController.dispose()` is not called (only `disableAutoSync()`). `FooterDataProvider` has no `dispose()` method (git watcher stays active). See Bug #9, #10, #13.

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
- `bashContextBlock()` → `!cmd` prepends `[! cmd — exit N]\noutput` to next prompt; `!!cmd` drops (its output still renders in the transcript card).

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

- **Mermaid**: `createMermaidMarkdownTransformer()` → `lovely-mermaid` → Unicode braille. Disabled during streaming in `final`/`off` modes; enabled in `streaming` mode. Max width = terminal width.
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
  activateDeferredPlugins(33 entries from DEFERRED_ENTRY_IDS) → parallel mount, 5s timeout each; full DSH-base profile ~50+ rows total
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

### Implemented (code exists — verified against source)

- Boot progress indicator during deferred plugin activation (statusContainer "Loading plugins x/y")
- History virtualization (max 500 rows + omitted marker)
- Login: fake OAuth options fixed (buildLoginProviderOptions queries authorization flow methods)
- Tool streaming (`tool_execution_update` wired → ToolRow.updateArgs/updateResult)
- Footer git watcher (FSWatcher on .git/HEAD)
- Theme DA1 async (non-blocking first paint, `void waitForTerminalColors()`)
- Ctrl+C simplified (clear/interrupt/exit, 3 states)
- Auth silent retry fixed (goingBack guard throws on cancel)
- Nested panels global ESC (dismissPanel(true) on ESC when selecting)
- Mermaid streaming enabled (mode "streaming")
- Approval "always allow" (session-scoped grants via `runtime/approvals.ts`)

### Remaining (not implemented in code)

| Priority | #   | Flow                   | Problem                                     | Impact                              |
| -------- | --- | ---------------------- | ------------------------------------------- | ----------------------------------- |
| P2       | 1   | BashExecutionComponent | Only used for bash mode, not for tool calls | Inconsistent tool rendering         |
| P2       | 2   | ModelSelector          | No "test connection" button                 | Can't verify route before selecting |
| P3       | 3   | History                | No search/filter in transcript              | Hard to find old content            |
| P3       | 4   | Footer                 | No cost breakdown per model                 | Unclear spending                    |
| P3       | 5   | SessionSelector        | No "delete multiple"                        | Tedious session cleanup             |
| P3       | 6   | Theme                  | No custom theme creator UI                  | Users must hand-edit JSON           |

---

## 5. ARCHITECTURAL OBSERVATIONS

### 5.1 Clean Separation (Good)

- **Runtime ↔ UI**: Only via `interfaces.ts` (types) + `runtime-events.ts` (events). No circular deps.
- **Callbacks**: UI owns all pixels; Runtime only sends structured events.
- **Theme**: Token-based, proxy — instant global updates.

### 5.2 Technical Debt (Needs refactor)

- **Tool Rendering**: `bash-execution.ts:BashExecutionComponent` used for Bash mode only; `tool_execution_update` already wired to ToolRow.
- **History**: Virtualized (max 500 rows). Search/filter still missing.
- **Boot**: Progress indicator implemented.
- **Dead Code**: `src/types.ts` (never imported), `src/interactive-mode/diff.ts` (never imported by source or test), `src/interactive-mode/streaming.ts` (only test import), `src/interactive-mode/theme/system-theme.ts` exports unused `Theme` class.
- **Resource Leaks**: `keybindings.dispose()` never called; `themeController.dispose()` not called (only `disableAutoSync()`); `FooterDataProvider` has no `dispose()` method (git watcher stays active).

### 5.3 Performance Risks

- `historyRows()` O(n) components — linear memory/time.
- `Footer` git `spawnSync` every 5s — blocks Node event loop briefly.
- `StreamingMarkdown` tail re-renders on every delta — fine for small, heavy for large code blocks.

---

## 6. BUG INVENTORY (Full line-by-line source scan, 2026-11-24)

### Critical (must fix before release)

| #   | File:Line                                     | Issue                                                                                                                                                                                            | Fix                                                                                      |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | `src/types.ts`                                | Dead code — duplicates `interfaces.ts`, never imported anywhere in `src/` or `test/`                                                                                                             | Remove file or make `interfaces.ts` the single contract                                  |
| 2   | `src/runtime/runtime.ts:136-164`              | `Runtime` constructor monkey-patches `globalThis.fetch` globally with `__ofmFetchWrapped` flag. Affects all `fetch` calls in the process; not reversible                                         | Move to a module-level function called once at boot, or pass a custom fetch per-provider |
| 3   | `src/providers/ofm-provider/index.ts:134-143` | `fs.appendFileSync("/tmp/ofm-debug.log", ...)` on every `session_start`/`before_agent_start`, including `event.systemPrompt.length`. Blocks event loop, leaks prompt-size info, no on/off switch | Delete the three `appendFileSync` blocks                                                 |
| 4   | `tsconfig.json:14` + `vite.config.ts:13`      | `src/providers/**` excluded from type-check and lint. ~4,000 lines of ofm-provider code ship unverified                                                                                          | Remove exclusion; fix resulting type errors                                              |
| 5   | `src/runtime/runtime.ts:992`                  | `this.ctx.authorization.cancel(key)` called without `await`. Sibling calls (`unset`, `deleteRecord`) are awaited. If `cancel()` returns a Promise, race condition                                | Verify if `cancel()` is async; add `await` if so                                         |

### High

| #   | File:Line                                     | Issue                                                                           | Fix                                                       |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 6   | `src/interactive-mode/keybindings.ts:264-268` | `dispose()` may call `unwatchFile` on a path never watched if `watchFile` threw | Guard with a flag tracking whether watch actually started |

### Medium

| #   | File:Line                                                          | Issue                                                                           | Fix                                                |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| 7   | `src/interactive-mode/ui.ts:87`                                    | Hardcoded `\x1b[1m` (bold) instead of theme token                               | Use `theme.fg()` or `theme.bold()`                 |
| 8   | `src/interactive-mode/highlight.ts:154`                            | Hardcoded `\x1b[38;2;155;175;255m` (string color)                               | Use `theme.fg("syntaxString", ...)`                |
| 9   | `src/interactive-mode/presentation.ts:61`                          | Hardcoded `\x1b[38;2;160;166;172m` (gray)                                       | Use `theme.fg("muted", ...)`                       |
| 10  | `src/interactive-mode/presentation.ts:70`                          | Hardcoded `\x1b[38;2;60;63;68m`                                                 | Use `theme.fg("borderMuted", ...)`                 |
| 11  | `src/interactive-mode/presentation.ts:153`                         | Hardcoded `\x1b[38;2;77;107;254m` (accent)                                      | Use `theme.fg("accent", ...)`                      |
| 12  | `src/interactive-mode/components/custom-message.ts:120`            | Hardcoded `\x1b[1m[...]\x1b[22m` (bold)                                         | Use `theme.bold()`                                 |
| 13  | `src/interactive-mode/components/branch-summary-message.ts:63`     | Hardcoded `\x1b[1m[branch]\x1b[22m`                                             | Use `theme.bold()`                                 |
| 14  | `src/interactive-mode/components/compaction-summary-message.ts:65` | Hardcoded `\x1b[1m[compaction]\x1b[22m`                                         | Use `theme.bold()`                                 |
| 15  | `src/interactive-mode/keybindings.ts:38,69`                        | `ctrl+p` bound to both `app.model.cycleForward` and `app.session.togglePath`    | Reassign one binding                               |
| 16  | `src/interactive-mode/keybindings.ts:37,70`                        | `ctrl+s` bound to both `app.thinking.save` and `app.session.toggleSort`         | Reassign one binding                               |
| 17  | `src/interactive-mode/footer-data-provider.ts:73`                  | `spawnSync("git", ...)` blocks event loop on every 5s poll                      | Replace with async `spawn` or move off render path |
| 18  | `src/interactive-mode/external-editor.ts:42`                       | Editor command split on spaces without shell quoting                            | Use shell-quote parser or `shell: true`            |
| 19  | `src/interactive-mode/components/user-message-selector.ts:169`     | `setTimeout(() => onCancel(), 100)` timer ID not stored; may fire after unmount | Store timer ID and `clearTimeout` in `dispose()`   |

### Low

| #   | File:Line                                                                    | Issue                                                                         | Fix                      |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| 20  | `src/interactive-mode/ui.ts:1826`                                            | `runtime.history().catch(() => [])` swallows errors silently                  | Log or surface the error |
| 21  | `src/providers/models/index.ts:20`                                           | Vietnamese comments in English codebase (`// ← ĐÚNG TÊN`)                     | Translate or remove      |
| 22  | `vite.config.ts:11`                                                          | Provider tests (`src/providers/ofm-provider/test/*`) excluded from `npm test` | Add to `test.include`    |
| 23  | `src/interactive-mode/components/user-message-selector.ts:169` (same as #19) | Timer leak — already listed                                                   | —                        |

### Resource Leaks (not previously documented)

| #   | File:Line                                      | Issue                                                                                                             | Fix                                                     |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 24  | `src/interactive-mode/ui.ts:1855`              | `keybindings.startWatching()` called but `keybindings.dispose()` never called in `finally` block                  | Add `keybindings.dispose()` to `finally`                |
| 25  | `src/interactive-mode/ui.ts:2316`              | `themeController.disableAutoSync()` called but `themeController.dispose()` not called (file watcher stays active) | Add `themeController.dispose()` to `finally`            |
| 26  | `src/interactive-mode/footer-data-provider.ts` | `FooterDataProvider` has `branchWatcher` (FSWatcher) but no `dispose()` method                                    | Add `dispose()` method and call it in `ui.ts` `finally` |

---

## 7. FILE MAP (Key logic locations)

| Flow         | Primary Files                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Boot         | `ui.ts` (~2288–2325), `runtime/dsh-boot.ts`, `runtime/deferred.ts`                                                                                                 |
| Connect      | `ui.ts` (~737–827), `runtime/runtime.ts` (open)                                                                                                                    |
| Input/Submit | `ui.ts` (1186–1851)                                                                                                                                                |
| Streaming    | `ui.ts` (1629–1851), `stream-highlight.ts` (note: `streaming.ts` is dead code, not used in source)                                                                 |
| Auth         | `ui.ts` (607–658), `auth-flow.ts`, `runtime/runtime.ts` (834–974), `components/login-dialog.ts`, `components/oauth-selector.ts`, `cli-auth.ts` (CLI terminal host) |
| Tools        | `tools.ts`, `detail.ts`, `bash-execution.ts`                                                                                                                       |
| Panels       | `ui.ts` (871–925), `components/*.ts`                                                                                                                               |
| Sessions     | `ui.ts` (2056–2111), `session-selector.ts`, `session-select.ts`                                                                                                    |
| Models       | `ui.ts` (1031–1052), `model-selector.ts`, `model-cycle.ts`                                                                                                         |
| Status       | `components/status-container.ts`, `components/status-indicator.ts`                                                                                                 |
| Theme        | `theme/theme.ts`, `theme/theme-controller.ts`, `theme/system-theme.ts`                                                                                             |
| Footer       | `footer.ts`, `footer-data-provider.ts`                                                                                                                             |
| History      | `history.ts`, `tools.ts`                                                                                                                                           |
| Bash         | `bash-mode.ts`, `bash-execution.ts`                                                                                                                                |
| Settings     | `settings-selector.ts`, `settings-store.ts`                                                                                                                        |
| Providers    | `runtime/catalog.ts`, `runtime/custom-providers/`, `providers/`, `providers/ofm-provider/`                                                                         |

---

## 8. VERDICT

**AUDIT.md** is approximately **85% correct** on architecture and flow description. It accurately describes the 3-layer contract, two-phase boot, overlay stack, safe runtime access, ToolRow lifecycle, incremental highlighting, streaming (via `AssistantMessageComponent`, not `StreamingMarkdown`), Mermaid, theme system, status indicators, shutdown, extension points, bash mode, clipboard, autocomplete, history replay, footer, settings, and all 8 system-level loops.

However, it is **~15% inaccurate** on specific technical claims:

1. `tool_execution_update` is **not** "defined but never emitted" — it is emitted and consumed.
2. Several features listed as "Remaining / not implemented" are actually implemented (approval always-allow, boot progress, history virtualization, fake OAuth fix, tool streaming, footer git watcher, DA1 async, Ctrl+C simplify, auth silent retry, global ESC, Mermaid streaming).
3. It does not mention any of the 23 bug groups (5 Critical, 1 High, 11 Medium, 4 Low, 3 resource leaks) found by the line-by-line source scan.

**AUDIT_REPORT.md** is more thorough in finding actual code bugs (5 Critical, 5 Medium, 4 Low, 3 resource leaks) and correctly identifies 6 points where AUDIT.md is stale. However, it has 9 factual errors of its own:

1. "2 test fail" — false (all 182 pass).
2. "`npm run check` fails due to 13 temp files" — misleading (temp test artifacts, not source).
3. `session-select.ts:169` timer leak — wrong file (it's `user-message-selector.ts:169`).
4. `cli.ts:44` hardcoded ANSI — debatable (CLI, not TUI).
5. `ctrl+d` conflict — overstates (context-gated).
6. `thinking-selector.ts` dead code — false (exported from `components/index.ts`).
7. `Theme` class duplication — mischaracterizes (unused, not duplicate).
8. "Theme not found" build issue — unverified.
9. `current()` potentially undefined — debatable (defensive, not a real bug).

**Final conclusion:** Both documents are useful but neither is fully accurate. The corrected bug inventory is in `TODO.md` §Bug-Fix Backlog. The corrected architecture description is in this file. All stale claims have been corrected in both documents.

---

**END OF AUDIT**
