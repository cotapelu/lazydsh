# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.18** · Suite **182/182 passing** (49 test files) · `npm run check` clean · `npm run build` clean · dist boots.

**Core complete.** The pi-coding-agent interactive-mode port is **functionally complete** — every advertised keybinding fires, every advertised panel opens, theme/settings persist, retry + compaction states are live, and the DSH bridge loads the full `@deepseek-ai/dsh-base` profile (101 plugin rows) with only the 14 services the TUI actually needs mounted eagerly. P0 login unification done (§8.26); 4 UX gaps remain (see §D) plus orphan files awaiting wiring (see §C).

**Layout** (three layers + root contracts):

```
src/
├── cli.ts plugin.ts               # wiring
├── interfaces.ts runtime-events.ts # contracts (types + events only)
├── runtime/ (13 files)            # DSH bridge + boot, no pi-tui imports
├── interactive-mode/ (47 + 31 components + 9 theme)  # the TUI
└── utils/ (7 files)               # pure helpers, no pi-tui, no dsh
```

Rule: `interactive-mode/` → imports contracts, `utils/`, `runtime/`; `runtime/` → imports contracts, `utils/` only; root files may reference both.

---

## Phase History

Phases 1–7 (Layout & Footer, Tool Cards, Selectors, Keybindings & Theme, Message Components, Polish, Docs & Verification) complete. Phase 8 (Upstream Parity & Follow-ups) complete through §8.27. See git log for details.

Key completed items: two-phase boot with deferred plugins, overlay stack, safe runtime access, ToolRow lifecycle with live streaming, incremental highlighting, Mermaid, theme system with DA1 auto-sync, status indicators, shutdown, bash mode, login unification (P0), approval "always allow" (P2), history virtualization, footer git watcher.

---

## REMAINING

### A. Bugs (functional issues)

None currently open (all 182 tests pass, `npm run check` clean). Remaining code-quality items in §B.

### B. Code smells / technical debt

1. **`ui.ts` decomposition** — in progress: auth cluster extracted to `auth-flow.ts`; next clusters: `pickModel`/`pickProviderModel`, streaming loop, session management, keybinding input handler. `ui.ts` ~2336 lines.
2. **`runtime.ts` `globalThis.fetch` monkey-patch** — `__ofmFetchWrapped` mutates global fetch for OFM Kilo; should be module-level or per-provider.
3. **`ctrl+s` duplicate bindings** — bound to `app.thinking.save`, `app.session.toggleSort`, `app.models.save`.
4. **`spawnSync("git", ...)` in footer-data-provider** — blocks event loop on every 5s poll; replace with async spawn.
5. **External editor command** — split on spaces without shell quoting (`external-editor.ts`).
6. **Timer leak** — `setTimeout` in `user-message-selector.ts` not cleared on unmount.
7. **Resource leaks** — `keybindings.dispose()` and `themeController.dispose()` not called in `finally`; `FooterDataProvider` has no `dispose()`.
8. **`runtime.history().catch(() => [])`** swallows errors silently.
9. **`ui.ts` `connect()` many parameters** — refactored to `ConnectOptions` object (done).

### C. Orphan files (ported, typechecked, no call site — need product decision)

Complete implementations ported from pi-coding-agent. Wire, don't delete.

1. `branch-summary-message.ts` — wire into `branch_summary` session events.
2. `trust-selector.ts` — wire into `/trust` or settings.
3. `user-message-selector.ts` — wire into `/fork`.
4. `custom-entry.ts`, `custom-message.ts`, `extension-editor.ts`, `extension-input.ts`, `extension-selector.ts` — wire when extension system implemented.
5. `first-time-setup.ts` — wire into startup.
6. `settings-submenu.ts`, `show-images-selector.ts` — wire into settings.
7. `bordered-loader.ts` — utility, wire when needed.

### D. Remaining UX gaps

| Priority | Flow                   | Problem                                 | Impact                              |
| -------- | ---------------------- | --------------------------------------- | ----------------------------------- |
| P2       | BashExecutionComponent | Only used for bash mode, not tool calls | Inconsistent tool rendering         |
| P2       | ModelSelector          | No "test connection" button             | Can't verify route before selecting |
| P3       | History                | No search/filter in transcript          | Hard to find old content            |
| P3       | Footer                 | No cost breakdown per model             | Unclear spending                    |
| P3       | SessionSelector        | No multi-delete                         | Tedious cleanup                     |
| P3       | Theme                  | No custom theme creator UI              | Hand-edit JSON                      |

### E. Missing features (gaps vs pi-coding-agent reference)

Session tree view, scoped models, skill invocation UI, config selector, extension system, additional commands (`/clone`, `/import`, `/reload`, `/debug`, `/hotkeys`, `/tree`, `/scoped`, `/trust`, `/skill:*`). Deferred to v0.3.0.

### F. Docs / parity

- README translations (`README.ja.md`, `README.zh-CN.md`) describe pre-refactor layout.
- Extension system API needs real design.

---

## Verification Checklist

- [x] Ctrl+C interrupts mid-turn; second press force-exits; idle exits; draft clears
- [x] `--version` prints the package version
- [x] `/new` keeps transcript; `/clear` wipes
- [x] Question panel fits 80×24 and below
- [x] Resumed sessions show reasoning rows and expandable tool details
- [x] Approval prompts show tool name, arguments, diff
- [x] Async pickers fill items only while open; error paths dismiss
- [x] Login dialogs dismiss on settle/abort
- [x] Every declared keybinding has a handler
- [x] Theme (name / auto pair / user themes) and UI settings persist
- [x] Retry + compaction states appear from DSH session events
- [x] Footer shows git branch, provider count, extension statuses
- [x] Suite 182/182; `check` clean; `build` clean; dist boots
- [x] Bash mode (`!` / `!!`) wired and working
- [x] `messageCount` shows actual count
- [x] `tool_execution_update` wired (live streaming)
- [x] Mermaid streaming enabled (verified by test)

**Suite: 182/182 passing** (49 test files).

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per UI on `@earendil-works/pi-tui`.

---

## Next Actions (priority order)

1. BashExecutionComponent for tools (P2#1)
2. Model selector test connection (P2#2)
3. Redesign LoginDialog Notice (progress, buttons, auto-close)
4. `ui.ts` decomposition continued
5. History search/filter (P3#3)
6. Footer cost breakdown (P3#4)
7. Session selector multi-delete (P3#5)
8. Theme creator UI (P3#6)

Then orphan file wiring (C items), then missing features (defer to v0.3.0).

---

## Bug-Fix Backlog (corrected, 2026-11-24)

See `AUDIT.md` §6 for full details.

### Critical

1. `src/runtime/runtime.ts:136-164` — global `fetch` monkey-patch (`__ofmFetchWrapped`). Move to module-level or per-provider.
2. `src/runtime/runtime.ts:992` — `authorization.cancel(key)` not awaited in `logout()`. Verify and add `await` if async.

### Medium

3. `src/interactive-mode/keybindings.ts` — `ctrl+s` bound to three actions. Reassign.
4. `src/interactive-mode/footer-data-provider.ts:73` — `spawnSync("git")` blocks event loop. Replace with async.
5. `src/interactive-mode/external-editor.ts:42` — editor command split without shell quoting. Fix quoting.
6. `src/interactive-mode/components/user-message-selector.ts:169` — untracked `setTimeout`. Clear on dispose.

### Low

7. `src/interactive-mode/ui.ts:1826` — `runtime.history().catch(() => [])` swallows errors. Log/surface.
8. `src/interactive-mode/keybindings.ts:264-268` — `dispose()` may `unwatchFile` never-watched path. Guard.

### Resource leaks

9. `ui.ts` finally: `keybindings.dispose()` not called (watcher stays active).
10. `ui.ts` finally: `themeController.dispose()` not called (file watcher stays active).
11. `FooterDataProvider`: no `dispose()` method (git watcher stays active).

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per UI on `@earendil-works/pi-tui`.
