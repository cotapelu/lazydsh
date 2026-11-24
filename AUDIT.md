# AUDIT.md — Full Logic Flow Analysis: Interactive Mode (lazydsh)

> **Scope**: Every logic flow in `src/interactive-mode/` + `src/runtime/` integration.
> **Perspective**: LLM-readable architectural audit — no code dumps, pure logic descriptions.
> **Order**: Atomic operations → Composed flows → System-level loops → Status inventory.
> **Last verified**: 2026-11-24 (full source scan of `src/` and `test/`; `npm run check` clean, 182/182 tests pass, build clean).

---

## 0. GLOSSARY

| Term                 | Meaning                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **TUI**              | `@earendil-works/pi-tui` — React-like terminal UI framework (components, layout, input, overlay, ANSI rendering).      |
| **Runtime**          | `src/runtime/runtime.ts:Runtime` — TypeScript wrapper around DSH Agent, exposes async API to UI.                       |
| **DSH**              | DeepSeek Harness — Cordis-based agent platform (101 plugins + 11 extra services). Runs in same process.                |
| **Callbacks**        | `interfaces.ts:Callbacks` — Three hooks Runtime calls when it needs a human: `onAuth`, `onApproval`, `onUserQuestion`. |
| **Overlay**          | `tui.showOverlay(panel)` — Modal panel stacked above editor; `dismissPanel()` pops.                                    |
| **Deferred Plugins** | 33 deferred entries (`DEFERRED_ENTRY_IDS`), full profile activates ~50+ rows at boot.                                  |
| **ToolRow**          | `tools.ts:ToolRow` — One expandable row per tool call (pending → result/diff).                                         |
| **Streaming**        | Incremental rendering: reasoning + answer deltas → same `AssistantMessageComponent`.                                   |

---

## 1. ATOMIC OPERATIONS

### 1.1 Theme Token Resolution

- `theme.fg(token, text)` → ANSI sequence from active `Theme` (process-wide proxy). `""` token → terminal default (`\x1b[39m`/`\x1b[49m`). Dim tokens wrap with `\x1b[2m`. Proxy ensures every component reads the current theme on every render — no rebuild needed on theme switch.

### 1.2 Keybinding Matching

- `KeybindingsManager` (pi-tui) + user `~/.config/lazydsh/keybindings.json` (hot-reload via `watchFile`). `kb.matches(inputData, actionId)` → boolean. 25 `app.*` actions + pi-tui `tui.*`. Platform defaults differ (Windows vs Unix). Note: `ctrl+s` is bound to three actions (`app.thinking.save`, `app.session.toggleSort`, `app.models.save`).

### 1.3 Component Render Cache

- Every pi-tui `Component` caches `render(width)` keyed by `(width, revision)`. `invalidate()` bumps revision. `TUI.invalidate()` cascades to all children.

### 1.4 Overlay Stack Management

- Push: `showPanel(panel)` → `tui.showOverlay()` → push handle → `tui.setFocus(panel)` → `selecting = true`.
- Pop single: `dismissPanel(false)` → pop last → `handle.hide()`. Pop all: `dismissPanel(true)`.
- Focus returns to editor when stack empty. `selecting` blocks editor input and pauses queue drain.

### 1.5 AbortSignal Composition

- `AbortSignal.any([signalA, signalB, AbortSignal.timeout(ms)])`. Every async op accepts caller signal + local timeout. `finally` blocks always remove abort listeners.

### 1.6 Safe Runtime Access (First Paint)

- Before deferred plugins attach, `Runtime` is a throwing proxy. `safeRead(runtime, () => runtime.xxx)` returns `undefined` on throw. Used by Footer/status/autocomplete during `starting === true`.

### 1.7 ToolRow Lifecycle (`tools.ts`)

- Create: `ToolLog.record(output)` → `ToolRow(summary)` with `callId`.
- Pending: `tool_execution_start` → `row.setCall(rawArgsJson)`.
- Streaming: `tool_execution_update` → `row.updateArgs()` / `row.updateResult()`.
- Settle: `tool_execution_end` → `row.finish(status, resultText, reason, meta)`.
- Expand: click → `row.toggle()` → `detail.ts:toolDetails(...)`.
- Replay: `historyRows` calls `ToolLog.record()` with final events → identical render.

### 1.8 Incremental Highlighting (`stream-highlight.ts`)

- Per-language state machine tracks `blockComment`, `quote`, `lineComment`. Line scan emits `ScanState`. Safe (neutral) lines frozen and highlighted once; tail re-highlighted per delta, rate-limited (400 pending lines, 200ms). Unknown language → whole-snippet highlight throttled at 48 lines.

### 1.9 Streaming Markdown (`streaming.ts`)

- Note: `streaming.ts` is only imported by `test/streaming.test.ts`, not by source. The live UI uses `AssistantMessageComponent` directly. `StreamScanner` finds completed block boundaries (blank line outside fence/math); completed blocks cached as `Markdown`; tail with incremental highlighter; `setFinal` → single `Markdown`.

### 1.10 Mermaid Transformer (`mermaid.ts`)

- Top-level ` ```mermaid ` blocks → `lovely-mermaid` Unicode braille art. Max width = terminal width; warnings appended if too wide. Disabled during streaming in `final`/`off` modes; enabled in `streaming` mode.

---

## 2. COMPOSED FLOWS

### 2.1 Boot Sequence (`ui.ts` ~2296–2336)

1. Create TUI: `createInteractiveTui({tuiMode: "fullscreen", mouse: true})` → `TuiAltScreen`.
2. Component tree: Header, Transcript, QueueView, PromptEditor, StatusIndicatorContainer, ProgramStatusReporter, FooterContainer (lazy), extension widget containers.
3. ThemeController `applyFromSettings()` → DA1 query (100ms) → auto-sync.
4. Keybindings `startWatching()` (hot-reload).
5. Console capture → log file.
6. `tui.start()` → alt screen.
7. First paint `tui.renderNow()`.
8. After-first-paint (async, blocks submit): catalog validate, packages refresh, `activateDeferredPlugins` (33 entries, 5s each, ~50+ rows total), `waitForRuntimeServices` (14 services, 15s), `pending.attach(createRuntime())` → proxy swap, `starting = false`.
9. `waitForTerminalColors()` (DA1).
10. Initial connect (`connect()` or `pickModel()`).

Editor disabled during step 8; status shows "Loading plugins x/y".

### 2.2 Session Connect (`connect()`, `ui.ts` ~737–827)

1. `runtime.open(route, callbacks)` → resume or create session.
2. `persistSelection()` → `$DSH_HOME/lazydsh-model.json`.
3. `runtime.cd(requestedDirectory)`.
4. `runtime.commands()` → `commandMenu()` for autocomplete.
5. `setAutocomplete()`.
6. Clear toolLog + queue.
7. `transcript.clear()` unless `keepTranscript`.
8. History replay (sync): `runtime.history()` → `historyRows()` → components → `scroll.scrollToEnd()`.
9. `probeCredentialSource(provider)`.

History virtualized to max 500 rows (`maxHistoryRows`).

### 2.3 Input Submission (`editor.onSubmit`, `ui.ts` ~1186–1859)

- **Bash mode** (`!cmd`/`!!cmd`): `parseBashMode` → `runBash` → `runtime.shell()` → `BashExecutionComponent` (streaming output, exit code, truncation 10k/1MB). `bashContextBlock` prepends to next prompt (`!`) or drops (`!!`).
- **Queue follow-up** (Alt+Enter): `enqueue()` → `QueuedMessage` in `QueueView`; `drainQueue()` after turn ends.
- **Slash commands**: ~30 commands (clear, quit, bug, share, changelog, debug, copy, name, hotkeys, clone, settings, model, new, login/logout, resume/cd/permission, archive/restore/pin/unpin, ps/stop, session, status, file, dsh, fork, rename, effort).
- **Normal prompt**: credential check → `agent.followup(createUserMessage)` → listeners (session/event, assistant-stream, request-error) → `wait()` → `RunResult`.

### 2.4 Streaming Response Loop (`ui.ts` ~1629–1851)

1. `ensureLiveAssistant()` → `AssistantMessageComponent` (streaming).
2. `renderLive(true)` per frame.
3. Handlers: `assistant.reasoning` → `liveReasoning`; `assistant.delta` → `liveText`; session events (llm/retry, compaction/*, compaction/summary); tool_execution_start/update/end → ToolRow; finish → `renderLive(false, stopReason)`.

### 2.5 Authentication Flow

- **CLI** `lazydsh login [provider]`: `cli-auth.ts` terminal `AuthHost` (stdin prompts) reuses `auth-flow.ts`.
- **TUI** `/login [provider]`: `signIn()` → `buildLoginProviderOptions()` → `OAuthSelectorComponent` → `runtime.authenticate()`.
- **Auto-reauth**: during `runtime.run()` on 401/403 → `authenticate({reauthenticate: true})`.
- `callbacks.onAuth`: `lazydsh/auth-notice` → `LoginDialog(notice)`; `secret` → masked Input; `select` → SearchPicker.
- `runtime.authenticate()`: credentialSource check → deepseek-official API key prompt or authorization flow (method select → begin). Going back on cancel restarts the attempt.

### 2.6 Tool Execution Rendering

- `ToolLog` records/updates `ToolRow` keyed by `[sessionId, callId]`.
- `detail.ts` renders args/result/diffs (one engine, replay-safe).
- `BashExecutionComponent` used for bash mode only.
- Live streaming wired via `tool_execution_update`.

### 2.7 Overlay Panel System

- Stack `overlayHandles[]` (LIFO). Push: `showPanel()` → overlay + focus + `selecting=true`. Pop: `dismissPanel(clearAll?)`. Height budget `panelHeight()` dynamic. Panels: LoginDialog, ApprovalPanel, QuestionPanel, OAuthSelector, ModelSelector, SessionSelector, ThemeSelector, ThinkingSelector, SettingsSelector, FirstTimeSetup, Changelog, SearchPicker.

### 2.8 Session Management

- `sessions()` → `SessionRecord[]` → `SessionSelector` (threaded tree, fuzzy search, scope/sort/named/path toggles).
- `forkSession(boundary)` → pick turn → new session → `connect()`.
- `renameSession`, `manageSession` (archive/restore/pin/unpin).
- `resume` → `selectSession()` → optional `selectResumeDirectory()` → `connect()`.

### 2.9 Model/Provider Cycling

- `cycleModel(±1)` → `nextProvider(authenticated, current, direction)` → `connect()`.
- `pickModel()` → `ModelSelectorComponent`: scoped/all toggle, fuzzy search, current/default markers, live refresh (15s, shared coordinator), save-as-default (Ctrl+S).

### 2.10 Status Indicators

- `StatusIndicatorContainer.show(kind, options)`: working/retry/compaction/idle.
- `ProgramStatusReporter` → OSC 7501 (idle/working/blocked/done/error).

### 2.11 Theme System

- `ThemeController`: apply setting → `setTheme()` → auto-sync → DA1 query (100ms) → `terminalColors` → theme regenerates `colors`. File watcher on custom themes (100ms debounce) → hot reload. Terminal scheme change → reapply if auto.
- `theme` global proxy → instant update on switch.

### 2.12 Shutdown

1. `stop()` → `closing=true` → `decision?.(null)` → `runtime.close()` → `finish()`.
2. Signal handlers (SIGINT/SIGTERM) → `stop()`.
3. `restoreConsole()`, `themeController.disableAutoSync()`, `tui.stop({preserveScreen: true})`, print continuation command.

Note: `keybindings.dispose()` and `themeController.dispose()` are not called in the `finally` block (watchers stay active) — see status inventory.

### 2.13 Extensions

- `ExtensionWidgetRegistry` → register/get by position. `FooterDataProvider` → extension statuses on footer line 3.

### 2.14 Bash Mode

- `parseBashMode(text)` → `!cmd`/`!!cmd`. `runBash()` → `runtime.shell()` (DSH sandbox). `BashExecutionComponent` (streaming, expandable, truncation). `bashContextBlock()` prepends (`!`) or drops (`!!`).

### 2.15 Clipboard / External Editor

- `copyToClipboard()` → native / pbcopy / clip / wl-copy / xclip.
- `editInExternalEditor()` → temp file → `$EDITOR`/`$VISUAL` → read back, strip VT codes.

### 2.16 Autocomplete

- `Autocomplete` extends `CombinedAutocompleteProvider`: `@` → `runtime.references()` (files, skills, subagents); `/` → `commandMenu()`; file paths → pi-tui built-in.

### 2.17 History Replay

- `historyRows(events, sessionId)` → UserMessage, AssistantMessage (reasoning folded), ToolRow (replay), Notification, Text(dim metrics). `continuationCommand()` on exit.

### 2.18 Footer

- Line 1: `pwd (git branch) • session name` (git watcher, 5s).
- Line 2: `↑↓tokens R/W CH% $cost context% model thinking`.
- Line 3: extension statuses (sorted).

### 2.19 Code Highlighting

- Mermaid: `createMermaidMarkdownTransformer()` → lovely-mermaid → braille. Disabled during streaming in final/off; enabled in streaming.
- Incremental: `IncrementalHighlighter` (per-language, rate-limited).
- Highlight.js: lazy language load (77 aliases), `highlightAuto` fallback.

### 2.20 Settings

- `SettingsSelectorComponent` (general/appearance/keybindings/extensions/about). `UiSettings` persisted to `~/.config/lazydsh/settings.json` (`confirmExit`, `mermaidMode`). Theme row → opens real `ThemeSelectorComponent`.

---

## 3. SYSTEM-LEVEL LOOPS

### 3.1 Main Event Loop

```
tui.start() → raw mode + alt screen
  input → keybindings → editor.onSubmit / panel.handleInput
    editor.onSubmit → runtime.run() → streaming loop → renderLive()
      session.event / assistant.delta / tool events → UI updates
    panel.handleInput → overlay navigation → confirm/cancel
  tui.requestRender() → layout → component.render(width) → ANSI → stdout
  SIGINT/SIGTERM → stop() → shutdown
```

### 3.2 Deferred Plugin Activation (once per session)

```
afterFirstPaint:
  catalog.validateRoute()
  packages.refresh()
  activateDeferredPlugins(33 entries) → parallel, 5s timeout each (~50+ rows total)
  waitForRuntimeServices(14 services, 15s)
  pending.attach(createRuntime()) → proxy swap
```

### 3.3 Auto-Reauth Loop (per failed request)

```
runtime.run() → agent/request-error (401/403)
  → runtime.authenticate({reauthenticate: true}) → callbacks.onAuth → LoginDialog
  → success → retry original request
```

### 3.4 Compaction Loop

```
session.event: compaction/start → statusContainer.show("compaction")
  → DSH summarizes → compaction/summary → CompactionSummaryMessageComponent
  → compaction/end → statusContainer.show("working")
```

### 3.5 Retry Loop (LLM failures)

```
session.event: llm/retry → statusContainer.show("retry", {count, maxAttempts, delayMs})
  → wait → llm/retry-started → statusContainer.show("working") → repeat up to maxAttempts
```

### 3.6 Git Branch Watcher (Footer)

```
setInterval(5000): spawnSync git branch --show-current
  → if changed → branchChangeCallbacks → tui.requestRender()
```

### 3.7 Theme File Watcher

```
watch(customThemesDir): on change <name>.json → 100ms debounce → setTheme → invalidate + requestRender
```

### 3.8 Terminal Color Scheme Sync

```
tui.onTerminalColorSchemeChange(scheme): setTerminalColorScheme → if appearance changed → reapply → DA1 query → invalidate + requestRender
```

---

## 4. STATUS INVENTORY

### Implemented

- Boot progress indicator during deferred plugin activation.
- History virtualization (max 500 rows + omitted marker).
- Login: provider options from authorization flow methods.
- Tool streaming (`tool_execution_update` wired).
- Footer git watcher (FSWatcher on .git/HEAD).
- Theme DA1 async (non-blocking first paint).
- Ctrl+C simplified (clear/interrupt/exit).
- Auth silent retry fixed.
- Nested panels global ESC.
- Mermaid streaming enabled.
- Approval "always allow" (session-scoped grants).

### Remaining (not implemented)

| Priority | Flow                   | Problem                                 | Impact                              |
| -------- | ---------------------- | --------------------------------------- | ----------------------------------- |
| P2       | BashExecutionComponent | Only used for bash mode, not tool calls | Inconsistent tool rendering         |
| P2       | ModelSelector          | No "test connection" button             | Can't verify route before selecting |
| P3       | History                | No search/filter in transcript          | Hard to find old content            |
| P3       | Footer                 | No cost breakdown per model             | Unclear spending                    |
| P3       | SessionSelector        | No multi-delete                         | Tedious cleanup                     |
| P3       | Theme                  | No custom theme creator UI              | Hand-edit JSON                      |

### Resource leaks (documented)

- `keybindings.dispose()` never called in `finally` (watcher stays active).
- `themeController.dispose()` not called (only `disableAutoSync()`; file watcher stays active).
- `FooterDataProvider` has no `dispose()` (git watcher stays active).

---

## 5. ARCHITECTURAL OBSERVATIONS

### Clean separation (good)

- Runtime ↔ UI only via `interfaces.ts` (types) + `runtime-events.ts` (events). No circular deps.
- Callbacks: UI owns pixels; Runtime sends structured events.
- Theme: token-based proxy — instant global updates.

### Technical debt

- `ui.ts` (~2336 lines) and `runtime.ts` (~1473 lines) are orchestration hotspots.
- `Theme` class duplicated between `theme/theme.ts` and `theme/system-theme.ts` (system-theme version unused by source).
- `sanitizeStatusText` duplicated in `footer.ts` and `footer-data-provider.ts`.
- `streaming.ts` only imported by test, not source.
- `session-share.ts` uses placeholder URL.

### Performance risks

- `historyRows()` O(n) components — linear memory/time.
- Footer git `spawnSync` every 5s — blocks event loop briefly.
- `StreamingMarkdown` tail re-renders on every delta — heavy for large code blocks.

---

## 6. BUG INVENTORY (corrected, 2026-11-24)

### Critical

| #   | File:Line                        | Issue                                                                                                                                    | Fix                                                                              |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `src/runtime/runtime.ts:136-164` | `Runtime` constructor monkey-patches `globalThis.fetch` globally with `__ofmFetchWrapped` flag; not reversible, affects all fetch calls. | Move wrapper to module-level function called once at boot, or scope per-runtime. |
| 2   | `src/runtime/runtime.ts:992`     | `this.ctx.authorization.cancel(key)` called without `await` in `logout()`; siblings are awaited.                                         | Verify if `cancel()` returns a Promise; add `await` if so.                       |

### Medium

| #   | File:Line                                                      | Issue                                                                                               | Fix                                               |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 3   | `src/interactive-mode/keybindings.ts`                          | `ctrl+s` bound to three actions (`app.thinking.save`, `app.session.toggleSort`, `app.models.save`). | Reassign conflicting bindings.                    |
| 4   | `src/interactive-mode/footer-data-provider.ts:73`              | `spawnSync("git", ...)` blocks event loop on every footer render (5s poll).                         | Replace with async spawn or move off render path. |
| 5   | `src/interactive-mode/external-editor.ts:42`                   | Editor command split on spaces without shell quoting.                                               | Use `shell: true` or proper shell-quote parser.   |
| 6   | `src/interactive-mode/components/user-message-selector.ts:169` | `setTimeout(() => onCancel(), 100)` timer ID not stored; may fire after unmount.                    | Store timer ID and `clearTimeout` in `dispose()`. |

### Low

| #   | File:Line                                     | Issue                                                                            | Fix                       |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| 7   | `src/interactive-mode/ui.ts:1826`             | `runtime.history().catch(() => [])` swallows errors silently.                    | Log or surface the error. |
| 8   | `src/interactive-mode/keybindings.ts:264-268` | `dispose()` may call `unwatchFile` on a path never watched if `watchFile` threw. | Guard with a flag.        |

### Removed (stale claims from prior audit)

- `src/types.ts` dead duplicate — file does not exist; contract lives in `interfaces.ts`.
- `src/providers/ofm-provider/index.ts` debug `appendFileSync` — path does not exist (provider is under `src/runtime/custom-providers/ofm-provider/`); no such debug code present.
- `src/providers/models/index.ts` Vietnamese comments — path does not exist.
- `src/providers/**` tsconfig/vite exclusion — paths do not exist; `vite.config.ts` only ignores `src/providers/ofm-provider/test/**` (nonexistent).
- Hardcoded ANSI escape claims — the cited lines (`ui.ts:87`, `highlight.ts:154`, `presentation.ts:61/70/153`, `custom-message.ts:120`, `branch-summary-message.ts:63`, `compaction-summary-message.ts:65`) do not contain hardcoded ANSI; they use theme helpers.
- `streaming.ts` "dead code" is accurate (only test import) and retained in §1.9.

---

## 7. FILE MAP

| Flow         | Primary Files                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Boot         | `ui.ts` (~2296–2336), `runtime/dsh-boot.ts`, `runtime/deferred.ts`                                                                             |
| Connect      | `ui.ts` (737–827), `runtime/runtime.ts` (open)                                                                                                 |
| Input/Submit | `ui.ts` (1186–1859)                                                                                                                            |
| Streaming    | `ui.ts` (1629–1851), `stream-highlight.ts`                                                                                                     |
| Auth         | `ui.ts` (607–658), `auth-flow.ts`, `runtime/runtime.ts` (834–974), `components/login-dialog.ts`, `components/oauth-selector.ts`, `cli-auth.ts` |
| Tools        | `tools.ts`, `detail.ts`, `bash-execution.ts`                                                                                                   |
| Panels       | `ui.ts` (871–925), `components/*.ts`                                                                                                           |
| Sessions     | `ui.ts` (2056–2111), `session-selector.ts`, `session-select.ts`                                                                                |
| Models       | `ui.ts` (1031–1052), `model-selector.ts`, `model-cycle.ts`                                                                                     |
| Status       | `components/status-container.ts`, `components/status-indicator.ts`                                                                             |
| Theme        | `theme/theme.ts`, `theme/theme-controller.ts`, `theme/system-theme.ts`                                                                         |
| Footer       | `footer.ts`, `footer-data-provider.ts`                                                                                                         |
| History      | `history.ts`, `tools.ts`                                                                                                                       |
| Bash         | `bash-mode.ts`, `bash-execution.ts`                                                                                                            |
| Settings     | `settings-selector.ts`, `settings-store.ts`                                                                                                    |
| Providers    | `runtime/catalog.ts`, `runtime/custom-providers/`                                                                                              |

---

## 8. VERDICT

AUDIT.md architecture and flow descriptions are accurate (3-layer contract, two-phase boot, overlay stack, safe runtime access, ToolRow lifecycle, incremental highlighting, streaming via `AssistantMessageComponent`, Mermaid, theme, status indicators, shutdown, extension points, bash mode, clipboard, autocomplete, history replay, footer, settings, all 8 system-level loops).

The prior bug inventory contained stale/wrong claims (nonexistent paths, wrong line numbers, nonexistent `AUDIT_REPORT.md` reference). The corrected inventory is in §6 above and mirrored in `TODO.md` §Bug-Fix Backlog.

**Counts (verified):** 153 src files, ~33.9k LOC, 52 test files, 182 tests. `npm run check` clean, `npm test` 182/182, `npm run build` clean. `ui.ts` ~2336 lines, `runtime.ts` ~1473 lines.

---

**END OF AUDIT**
