# ARCH.md — lazydsh Architecture

## System Overview

```
User input (keyboard/mouse)
      │
      ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│ interactive-mode/ (FE)      │        │ runtime/ (BE)               │
│  ui.ts orchestration        │◄──────►│  Runtime (DSH Agent wrapper)│
│  components/, theme/, …     │ types  │  catalog, native-commands,  │
│  imports ▼                  │        │  preferences, boot patches  │
│  interfaces.ts, utils/      │        └───────┬─────────────────────┘
└─────────────────────────────┘                │ Cordis ctx
                                               ▼
                                      ┌─────────────────────────────┐
                                      │ DSH: @deepseek-ai/dsh-base  │
                                      │ 101 plugin rows; 14 eager   │
                                      │ services + deferred tools   │
                                      └─────────────────────────────┘
```

## Layers

**Root wiring** — `cli.ts` (args, patch file, profile run), `plugin.ts` (app
plugin, Runtime creation, `ask/resume/login/logout` commands), `types.ts`
(barrel), plus the two contracts `interfaces.ts` (types that cross the boundary)
and `runtime-events.ts` (event union + helpers).

**runtime/ (11)** — everything DSH: the `Runtime` class, two-phase boot
(`dsh-boot.ts`, `deferred.ts`, `plugin-patch.ts`), catalog/provider, DSH-native
commands, preferences, pending-runtime proxy, upgrade. No pi-tui imports.

**interactive-mode/ (84 files: 47 top-level + 31 components + 6 theme)** — the TUI:
`ui.ts` (orchestration), presentation primitives, tool rows + detail engine,
selectors (model/session/effort/theme/permission), pickers, footer, header,
status indicators, dialogs (login, approval, question), messages, theme system.
Many ported components are unwired (see TODO.md §C).

**utils/ (7)** — pure helpers shared by both layers (ansi, truncate, format,
stats, limits, models-are-equal, version).

## Boot sequence

1. `cli.ts` parses args; writes a temp JSON patch (provider patch + app patch);
   calls `ensureProfile` + `runProfile`.
2. `dsh-boot.ts` composes the profile; for the interactive path it mounts **only
   the launcher plugin** (`fullDefer`), so the Loader never imports the other
   rows during boot. SIGINT/SIGTERM → graceful dispose.
3. First paint via `ui.ts` → `hooks.afterFirstPaint()`: refresh packages,
   `activateDeferredPlugins(rows)`, `waitForRuntimeServices(14 names)`, attach
   the real `Runtime` to the proxy.
4. Pending startup connection → session opens.

## Data flow (one turn)

```
editor.onSubmit → add("You", text) → runtime.run(text, onEvent)
  → DSH Agent → LLM → tool plugins execute (bash/fs/web/subagent/…)
  → events: tool_execution_start/end, assistant.delta,
            assistant.reasoning, session.event (llm/retry, compaction/*)
  → ui.ts: ToolRow / AssistantMessageComponent / status rows / footer
```

**Note:** `tool_execution_update` event type exists in `RuntimeEvent` union and is wired to `ToolRow.updateArgs/updateResult` — live arg/result streaming works.

Session resume replays `historyRows()` from the JSONL log — same components as
the live path.

## Key contracts

- `interfaces.ts`: `Route`, `RuntimeOptions`, `Callbacks`, `RunResult`,
  `CredentialSource`, `ApprovalRequest`, `QuestionResult`, `ModelRuntime`.
- `runtime-events.ts`: `RuntimeEvent` union; `eventText` projects DSH session
  events (incl. tool `meta` for diffs) into transcript rows; `reasoningText`
  for thinking rows. **Note:** `tool_execution_update` defined but never emitted.
- `detail.ts`: one renderer for arguments/diff/output — shared by the approval
  panel and expandable history rows.

## UI composition

`ui.ts` builds: header → transcript (ScrollView) → queue view → status
container → extension widgets (above) → editor → widgets (below) → footer.
Overlay stack (`showPanel`/`dismissPanel`) carries every picker and dialog;
`panelHeight()` keeps question panels inside short terminals.

Status states: working (spinner + message), retry (attempt/max + countdown, from
`llm/retry`), compaction (spinner + label, from `compaction/start|end`), idle
("Ready · N queued").

## Configuration

| File                                 | Owner                      |
| ------------------------------------ | -------------------------- |
| `~/.config/lazydsh/keybindings.json` | 25 actions, hot reload     |
| `~/.config/lazydsh/theme.json`       | selected theme / auto pair |
| `~/.config/lazydsh/themes/*.json`    | user themes (validated)    |
| `~/.config/lazydsh/settings.json`    | `confirmExit`              |
| `$DSH_HOME/lazydsh-model.json`       | model preference           |
| `$DSH_HOME/cache/lazydsh/tui.log`    | console capture            |

DSH's own configuration (credentials, permission presets, sandbox policy)
belongs to the profile: `$DSH_HOME/.credentials.yaml`, `settings`, env vars.

## Performance

Two-phase boot (< 500 ms to first frame, measured ~122 ms), per-component render
caching, visual truncation for large outputs, image transcoding cache in tool
rows, deferred plugin activation with 5 s per-plugin timeout.

## Security boundaries

The TUI never holds credentials: `authorization`/`credentials` services resolve
keys per request. Tool execution stays inside DSH's sandbox + approval policy;
the launcher only adds UI. Proxy: `installProxyFromEnvironment`.

## Extension points

- **Widgets**: `extensionWidgets.register({ id, name, component, position,
  priority, status? })` — the `status()` hook feeds the footer row.
- **Slash commands**: handled in `ui.ts` `editor.onSubmit`; unknown `/x` falls
  through to DSH's native command registry (profile patches may add more).
- **Themes**: drop JSON in `~/.config/lazydsh/themes/` (validated against the
  token schema) or pick it in `/settings` → Appearance → Theme.
- **Keybindings**: edit `~/.config/lazydsh/keybindings.json`; hot reload.

## Known gaps

See `TODO.md` REMAINING + `AUDIT.md` §4 for full list. Key gaps:

- **P0 Critical (1):** Login unification — CLI still uses terminal-login.ts/command-runner.ts.
- **P1 High (2):** `!!cmd` drops output (notice only); queue no visual indicator (basic "N queued" only).
- **P2 Medium (3):** BashExecutionComponent unused for tool calls; approval no "always allow"; model selector no test connection.
- **P3 Low (4):** History no search/filter; footer no cost breakdown; session selector no multi-delete; theme no creator UI.

Implemented (removed from list): boot progress indicator, history virtualization, fake OAuth options fixed, tool streaming wired, footer git watcher (FSWatcher), theme DA1 async, Ctrl+C simplified, auth silent retry fixed, nested panels global ESC, mermaid streaming enabled.

Full comparison: `GOAL.md` "Comparison with pi-coding-agent interactive mode".
