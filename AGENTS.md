# AGENTS.md — Agent Development Guide for lazydsh

## Overview

lazydsh is a standalone TUI client for **DeepSeek Harness (DSH)** — a headless
Cordis-based agent platform. It is **not** a DSH plugin: it boots the DSH
`@deepseek-ai/dsh-base` profile (101 plugin rows) inside its
own process and wraps the Agent in a `Runtime` class for the TUI.

- Runtime: DSH via `@deepseek-ai/dsh-base` (+ 11 extra services from
  `src/runtime/plugin-patch.ts`)
- UI: `@earendil-works/pi-tui` (React-like component system)
- Language: TypeScript ESM, Node ≥ 24.9, bundled by `vite-plus`
- Suite: 150/150 · `npm run check` (format + lint + types) · `npm run build`

## Architecture (3 layers + contracts)

```
src/
├── cli.ts, plugin.ts, types.ts         # wiring: CLI → boot → app plugin
├── interfaces.ts                       # CONTRACT: Route, Callbacks, RunResult, …
├── runtime-events.ts                   # CONTRACT: RuntimeEvent + helpers
├── runtime/                            # DSH bridge + boot (no pi-tui)
│   ├── runtime.ts                      #   Runtime class (DSH Agent → TUI API)
│   ├── dsh-boot.ts, deferred.ts,       #   two-phase boot, deferred loading
│   │   plugin-patch.ts, telemetry-patch.ts
│   ├── catalog.ts, provider.ts         #   provider/model table
│   ├── native-commands.ts              #   DSH /export, /effort registration
│   ├── preferences.ts                  #   $DSH_HOME/lazydsh-model.json
│   ├── pending-runtime.ts, upgrade.ts
├── interactive-mode/                   # the TUI (imports contracts, utils, runtime)
│   ├── ui.ts                           #   orchestration (~2338 lines)
│   ├── auth-flow.ts                    #   login/logout flows extracted from ui.ts
│   ├── presentation.ts, presentation   #   editor/status/transcript primitives
│   ├── tools.ts, detail.ts,            #   tool rows + the one render engine
│   │   approval.ts, question.ts
│   ├── bash-execution.ts               #   bash mode renderer (used for !cmd/!!cmd)
│   ├── model-*.ts, session-*.ts,       #   selectors + search
│   │   picker.ts, autocomplete.ts
│   ├── theme.ts, theme/                #   tokens, controller, JSON themes
│   └── components/ (31)                #   header, dialogs, selectors, messages (15 orphan)
└── utils/ (7)                          # pure: ansi, truncate, format, stats,
                                        # limits, models-are-equal, version
```

**Dependency rule:** `interactive-mode/` may import contracts, `utils/`,
`runtime/`; `runtime/` imports contracts and `utils/` only; `utils/` and the
contracts import nothing local. Root files may reference both layers.

## Boot: two phases

1. `cli.ts` writes a temp patch file (provider patch + app plugin patch), then
   `ensureProfile("lazydsh", ["@deepseek-ai/dsh-base"])` and `runProfile`.
2. `dsh-boot.ts` mounts **only the launcher plugin** first → first paint
   (< 500 ms), then activates the remaining rows via `activateDeferredPlugins`
   and waits for the 14 `RUNTIME_SERVICE_NAMES` services.
3. `plugin.ts` creates the `Runtime` (or a `pending-runtime` proxy before attach)
   and runs `ui.ts`.

Services the TUI needs eagerly (`runtime/deferred.ts`): `agents`,
`workingDirectory`, `commands`, `attachments`, `sessionProjections`, `llm`,
`authorization`, `credentials`, `userQuestions`, `sessionTitle`,
`workspaceRegistry`, `jobs`, `fileReferences`, `skills`. Everything else
(tools, sandboxes, web, telemetry, PTC, MCP, …) mounts after first paint, and
every enabled row of the 101-row bundle eventually runs.

**Deferred entries:** 33 hardcoded in `DEFERRED_ENTRY_IDS` (`runtime/deferred.ts`); full profile activates ~50+ rows total.

## Runtime API (used by the TUI)

```typescript
interface Runtime {
  open(route, callbacks): Promise<string>;
  run(text, onEvent?, attachments?, options?): Promise<RunResult>;
  cancel(): Promise<void>;  close(): Promise<void>;
  sessions(); forkSession(boundary); renameSession(id, title);
  manageSession(id, "archive" | "restore" | "pin" | "unpin");
  selection(); efforts(); authProviders(); credentialSource(provider);
  authenticate(signal, options); logout(provider);
  references(query, signal); attach(path); stats(connect?, onSnapshot?);
  job(id, stop?); choices(kind, value?); history(); sessionDirectory(id);
  shell(command, {timeoutMs?, signal?}); // local bash (`!` mode) via DSH's executor
  getToolDefinition(name); // + ctx accessors (sessionPersistence, sessionQuery, …)
}
```

Events (`runtime-events.ts`): `session.event` (DSH events, incl. `llm/retry`,
`compaction/start|end` → status rows), `assistant.delta`, `assistant.reasoning`,
`tool_execution_start|update|end`.

## Development Patterns

- **Provider-neutral tool UI**: tools declare render intent; the UI owns the
  pixels. `detail.ts` renders arguments/diffs/output for history rows and the
  approval panel — one engine, replay-safe.
- **Overlay panels**: `showPanel(panel)` pushes an overlay handle; `dismissPanel(false)`
  pops one, `dismissPanel(true)` clears all. Async pickers fill items only while
  `selecting` is true.
- **Theme tokens, never hardcoded ANSI**: `theme.fg("accent", …)`; `ThemedText`
  is unnecessary here because `TUI.invalidate()` cascades to every child.
- **Immutability**: components cache by width; mutate through setters and call
  `tui.requestRender()`.
- **Pure logic gets extracted and tested** (`interrupt.ts`, `model-cycle.ts`,
  `settings-store.ts`, `theme-settings.ts`, `*_test.ts` beside them).

## Testing

```bash
npm run check    # format + lint + types (must be warning-free)
npm test         # vitest — 150 tests, 41 files
npm run build    # vite-plus bundle → dist/
node dist/cli.mjs --version
```

Unit tests cover pure helpers and components (status container, selectors,
theme, keybindings, detail, history, interruption, upgrade, CLI). Boot paths are
covered by `test/runtime.test.ts` (real profile, temp home).

## Configuration Files

| File                                   | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `~/.config/lazydsh/keybindings.json`   | 25 actions, hot-reloaded                              |
| `~/.config/lazydsh/theme.json`         | Selected theme (`{"theme":"dark"}` or `"light/dark"`) |
| `~/.config/lazydsh/themes/<name>.json` | User themes (validated on load)                       |
| `~/.config/lazydsh/settings.json`      | UI prefs (`confirmExit`)                              |
| `$DSH_HOME/lazydsh-model.json`         | Last provider/model/effort                            |
| `$DSH_HOME/cache/lazydsh/tui.log`      | Captured console output                               |

## Common Pitfalls

1. No hardcoded colors — theme tokens only.
2. Don't block the event loop; the deferred bridge returns promises.
3. Don't mutate components in place — setters + `requestRender()`.
4. Panels: push/pop the overlay stack symmetrically; dismiss in `finally` for
   promise-driven dialogs.
5. Clean up timers (`picker.dispose()`, theme file watchers) on close.
6. The runtime is a throwing proxy until the deferred plugins attach — use the
   `safeRead`/`safe*` helpers during first paint.

## Performance Targets

| Metric              | Target   | Measured |
| ------------------- | -------- | -------- |
| Time to first frame | < 500 ms | ~122 ms  |
| Idle frame          | < 16 ms  | ~2 ms    |
| Streaming frame     | < 33 ms  | ~5 ms    |
| Memory (idle)       | < 100 MB | ~80 MB   |

## Debugging

```bash
DEBUG=lazydsh:* npm start   # plugin logs
node dist/cli.mjs --list    # providers/models without a session
# Runtime diagnostics: ~/.dsh/cache/lazydsh/tui.log (console capture)
```

## Status

Core complete. Many UX gaps fixed (see AUDIT.md §4). Remaining: login unification (CLI), !!cmd output, queue indicator, bash execution for tools, approval always-allow, model test connection, history search, footer cost breakdown, session multi-delete, theme creator UI.
