# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.219** · Suite **182/182 passing** (49 test files) · `npm run check` clean · `npm run build` clean · dist boots.

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
2. ~~**`runtime.ts` `globalThis.fetch` monkey-patch** — `__ofmFetchWrapped` mutates global fetch for OFM Kilo; should be module-level or per-provider.~~ **FIXED** (moved to module-level function)
3. ~~**`ctrl+s` duplicate bindings** — bound to `app.thinking.save`, `app.session.toggleSort`, `app.models.save`.~~ **FIXED** (toggleSort → `ctrl+shift+s`, models.save → `ctrl+enter`)
4. ~~**`spawnSync("git", ...)` in footer-data-provider** — blocks event loop on every 5s poll; replace with async spawn.~~ **FIXED** (replaced with async spawn)
5. ~~**External editor command** — split on spaces without shell quoting (`external-editor.ts`).~~ **FIXED** (added `parseEditorCommand()`)
6. ~~**Timer leak** — `setTimeout` in `user-message-selector.ts` not cleared on unmount.~~ **FIXED** (added `dispose()` with `clearTimeout`)
7. ~~**Resource leaks** — `keybindings.dispose()` and `themeController.dispose()` not called in `finally`; `FooterDataProvider` has no `dispose()`.~~ **FIXED** (all dispose() called in finally block)
8. ~~**`runtime.history().catch(() => [])`** swallows errors silently.~~ **FIXED** (proper error handling with user notification)
9. ~~**`ui.ts` `connect()` many parameters** — refactored to `ConnectOptions` object (done).~~ **DONE**
10. **Lint/type warnings** — **FIXED** (theme.ts unused imports/params/regex, ui.ts unused imports, cli-auth.ts TS warning, test/theme-settings.test.ts unused import, added .eslintignore for temp OFM files)
11. **Medium fixes (2026-11-26)** — composeProfile no longer overwrites cordis.yml (3.1), ofmOpencodeSessionIds cleared on close (3.3), login-dialog focused getter fixed (3.8), auth-flow encapsulation fixed (3.9)
12. **Low fixes (2026-11-26)** — removed dead code streaming.ts (4.1), deduplicated sanitizeStatusText (4.2), system-theme.ts already removed (4.3)

### C. Orphan files (ported, typechecked, no call site — need product decision)

Complete implementations ported from pi-coding-agent. Wire, don't delete.

1. ~~`branch-summary-message.ts` — wire into `branch_summary` session events.~~ **WIRED** (in `ui.ts` session.event handler)
2. ~~`trust-selector.ts` — wire into `/trust` or settings.~~ **WIRED** (`/trust` command opens TrustSelectorComponent)
3. ~~`user-message-selector.ts` — wire into `/fork`.~~ **WIRED** (`/fork` command opens UserMessageSelectorComponent)
4. `custom-entry.ts`, `custom-message.ts`, `extension-editor.ts`, `extension-input.ts`, `extension-selector.ts` — wire when extension system implemented.
5. ~~`first-time-setup.ts` — wire into startup.~~ **WIRED** (shown on first run in `openInitialSession`)
6. ~~`settings-submenu.ts`, `show-images-selector.ts` — wire into settings.~~ **WIRED** (via `/settings` → onActivate)
7. ~~`bordered-loader.ts` — utility, wire when needed.~~ **WIRED** (used in `status-indicator.ts`, `extension-selector.ts`, `extension-input.ts`)
8. ~~`countdown-timer.ts` — utility, wire when needed.~~ **WIRED** (used in `status-indicator.ts`, `extension-selector.ts`, `extension-input.ts`)

### D. Remaining UX gaps

| Priority | Flow                   | Problem                                 | Impact                              | Status   |
| -------- | ---------------------- | --------------------------------------- | ----------------------------------- | -------- |
| P2       | BashExecutionComponent | Only used for bash mode, not tool calls | Inconsistent tool rendering         | **DONE** |
| P2       | ModelSelector          | No "test connection" button             | Can't verify route before selecting | **DONE** |
| P3       | History                | No search/filter in transcript          | Hard to find old content            | **DONE** |
| P3       | Footer                 | No cost breakdown per model             | Unclear spending                    | **DONE** |
| P3       | SessionSelector        | No multi-delete                         | Tedious cleanup                     | **DONE** |
| P3       | Theme                  | No custom theme creator UI              | Hand-edit JSON                      | Deferred |

### E. Missing features (gaps vs pi-coding-agent reference)

Session tree view, scoped models, skill invocation UI, config selector, extension system, additional commands (`/clone`, `/import`, `/reload`, `/debug`, `/hotkeys`, `/tree`, `/scoped`, `/trust`, `/skill:*`). Deferred to v0.3.0.

### F. Docs / parity

- README translations (`README.ja.md`, `README.zh-CN.md`) describe pre-refactor layout.
- Extension system API needs real design.

---

## G. PORTING CHECKLIST: pi-coding-agent → lazydsh

> Mục tiêu: Port full mọi feature từ `pi-coding-agent/dist/modes/interactive/` sang `lazydsh/src/interactive-mode/`.
> Nguồn: Đọc full 18,456 dòng code của pi-coding-agent interactive mode (63 files).
> Trạng thái: lazydsh đã port ~95% pi-coding-agent interactive mode.

### G.1. Component cần port (P2 — quan trọng)

| #   | Component (pi-coding-agent)   | Dòng | Mô tả                                                                                                                                | Lazydsh chưa có | Priority |
| --- | ----------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- | -------- |
| 1   | `config-selector.js`          | 757  | Quản lý resources (extensions/skills/prompts/themes) enable/disable, scope toggle (global/project), project override với inherit/+/- | ✅ **PORTED**   | P2       |
| 2   | `scoped-models-selector.js`   | 336  | Chọn subset models cho Ctrl+P cycling, reorder, enable all/clear all, toggle provider, persist                                       | ✅ **PORTED**   | P2       |
| 3   | `skill-invocation-message.js` | 64   | Render skill blocks trong transcript với collapsed/expanded state, background color, markdown transform                              | ✅ **PORTED**   | P2       |
| 4   | `tree-selector.js`            | 1254 | Tree view sessions với navigation, folding, filtering (5 modes), labeling, horizontal scroll, anchor-based viewport                  | ✅ **PORTED**   | P2       |
| 5   | `custom-editor.js`            | 121  | Editor tích hợp app keybindings (`onEscape`, `onCtrlD`, `onPasteImage`, `onExtensionShortcut`, embed working status indicator)       | ✅ **PORTED**   | P2       |

### G.2. Component cần port (P3 — niche/cosmetic, optional)

| #   | Component (pi-coding-agent) | Dòng | Mô tả                                              | Lazydsh cần?                             |
| --- | --------------------------- | ---- | -------------------------------------------------- | ---------------------------------------- |
| 6   | `armin.js`                  | 334  | Easter egg mascot (armin) với 7 hiệu ứng animation | ❌ Cosmetic — không cần                  |
| 7   | `earendil-announcement.js`  | 39   | Earendil announcement banner                       | ❌ Cosmetic — không cần                  |
| 8   | `easter-egg-3d.js`          | 1138 | 3D easter egg animation (pi logo, armin)           | ❌ Cosmetic — không cần                  |
| 9   | `pi-logo.js`                | 36   | Pi logo (half-block)                               | ❌ Cosmetic — lazydsh dùng whale logo    |
| 10  | `radius-login-selector.js`  | 53   | Radius MCP login selector                          | ❌ Niche — lazydsh không dùng Radius MCP |

### G.3. Commands cần thêm (P2)

| Command          | pi-coding-agent          | lazydsh | Mô tả                                          | Status      |
| ---------------- | ------------------------ | ------- | ---------------------------------------------- | ----------- |
| `/import`        | ✅ `handleImportCommand` | ❌      | Import session từ file JSONL                   | Placeholder |
| `/reload`        | ✅ `handleReloadCommand` | ❌      | Reload extensions/resources                    | Placeholder |
| `/tree`          | ✅ `showTreeSelector`    | ✅      | Tree view sessions                             | **DONE**    |
| `/scoped-models` | ✅ `showModelsSelector`  | ✅      | Scoped models toggle                           | **DONE**    |
| `/trust`         | ✅ `showTrustSelector`   | ✅      | Trust management                               | **DONE**    |
| `/skill:*`       | ✅ (via autocomplete)    | ❌      | Skill invocation (registered as `/skill:name`) | Deferred    |

### G.4. Keybindings cần thêm (P2)

| Keybinding         | pi-coding-agent | lazydsh | Mô tả              | Status   |
| ------------------ | --------------- | ------- | ------------------ | -------- |
| `app.session.tree` | ✅              | ✅      | Tree view sessions | **DONE** |

### G.5. Orphan files cần wire (product decision)

| File                        | pi-coding-agent tương ứng   | Wire vào                            | Status   |
| --------------------------- | --------------------------- | ----------------------------------- | -------- |
| `branch-summary-message.ts` | `branch-summary-message.js` | DSH `branch_summary` session events | **DONE** |
| `trust-selector.ts`         | `trust-selector.js`         | `/trust` command hoặc settings      | **DONE** |
| `user-message-selector.ts`  | `user-message-selector.js`  | `/fork` command                     | **DONE** |
| `custom-entry.ts`           | `custom-entry.js`           | Extension system                    | Deferred |
| `custom-message.ts`         | `custom-message.js`         | Extension system                    | Deferred |
| `extension-editor.ts`       | `extension-editor.js`       | Extension system                    | Deferred |
| `extension-input.ts`        | `extension-input.js`        | Extension system                    | Deferred |
| `extension-selector.ts`     | `extension-selector.js`     | Extension system                    | Deferred |
| `first-time-setup.ts`       | `first-time-setup.js`       | Startup onboarding                  | **DONE** |
| `settings-submenu.ts`       | `settings-submenu.js`       | Settings selector                   | **DONE** |
| `show-images-selector.ts`   | `show-images-selector.js`   | Settings selector                   | **DONE** |
| `bordered-loader.ts`        | `bordered-loader.js`        | Utility cho dialogs                 | **DONE** |
| `countdown-timer.ts`        | `countdown-timer.js`        | Utility cho dialogs                 | **DONE** |

### G.6. Settings cần port (P3 — lazydsh simplified, pi-coding-agent full)

Pi-coding-agent settings-selector có ~40 items. Lazydsh chỉ có 10 items (DSH-delegated). Cần port thêm:

| Setting                          | pi-coding-agent | lazydsh            | Priority | Status   |
| -------------------------------- | --------------- | ------------------ | -------- | -------- |
| Auto-compact                     | ✅              | ⚠️ (info only)     | P3       | Info     |
| Steering mode                    | ✅              | ❌                 | P3       | Deferred |
| Follow-up mode                   | ✅              | ❌                 | P3       | Deferred |
| Transport preference             | ✅              | ❌                 | P3       | Deferred |
| Session share destination        | ✅              | ❌                 | P3       | Deferred |
| HTTP idle timeout                | ✅              | ❌                 | P3       | Deferred |
| Cache warming mode               | ✅              | ❌                 | P3       | Deferred |
| Hide thinking                    | ✅              | ⚠️ (Ctrl+T toggle) | P3       | Toggle   |
| Mermaid rendering                | ✅              | ✅                 | Done     | **DONE** |
| Cache miss notices               | ✅              | ❌                 | P3       | Deferred |
| Collapse changelog               | ✅              | ❌                 | P3       | Deferred |
| Quiet startup                    | ✅              | ❌                 | P3       | Deferred |
| Install telemetry                | ✅              | ❌                 | P3       | Deferred |
| Default project trust            | ✅              | ❌                 | P3       | Deferred |
| Double-escape action             | ✅              | ❌                 | P3       | Deferred |
| Tree filter mode                 | ✅              | ❌                 | P3       | Deferred |
| Warnings (anthropic extra usage) | ✅              | ❌                 | P3       | Deferred |
| Model thinking level per model   | ✅              | ❌                 | P3       | Deferred |
| TUI mode (regular/fullscreen)    | ✅              | ❌                 | P3       | Deferred |
| Fullscreen exit output           | ✅              | ❌                 | P3       | Deferred |
| Fullscreen scrollbar             | ✅              | ❌                 | P3       | Deferred |
| Fullscreen copy on select        | ✅              | ❌                 | P3       | Deferred |
| Fullscreen wheel scroll lines    | ✅              | ❌                 | P3       | Deferred |
| Show images                      | ✅              | ❌                 | P3       | **DONE** |
| Image width cells                | ✅              | ❌                 | P3       | **DONE** |
| Auto-resize images               | ✅              | ❌                 | P3       | **DONE** |
| Block images                     | ✅              | ❌                 | P3       | **DONE** |
| Skill commands toggle            | ✅              | ❌                 | P3       | Deferred |
| Show hardware cursor             | ✅              | ❌                 | P3       | Deferred |
| Editor padding                   | ✅              | ❌                 | P3       | Deferred |
| Output padding                   | ✅              | ❌                 | P3       | Deferred |
| Autocomplete max visible         | ✅              | ❌                 | P3       | Deferred |
| Clear on shrink                  | ✅              | ❌                 | P3       | Deferred |
| Terminal progress (OSC 9;4)      | ✅              | ❌                 | P3       | Deferred |

### G.7. Slash commands cần thêm (P2)

| Command          | pi-coding-agent          | lazydsh | Mô tả                            | Status      |
| ---------------- | ------------------------ | ------- | -------------------------------- | ----------- |
| `/import`        | ✅ `handleImportCommand` | ❌      | Import session từ file JSONL     | Placeholder |
| `/reload`        | ✅ `handleReloadCommand` | ❌      | Reload extensions/resources      | Placeholder |
| `/tree`          | ✅ `showTreeSelector`    | ✅      | Tree view sessions               | **DONE**    |
| `/scoped-models` | ✅ `showModelsSelector`  | ✅      | Scoped models toggle             | **DONE**    |
| `/trust`         | ✅ `showTrustSelector`   | ✅      | Trust management                 | **DONE**    |
| `/skill:*`       | ✅ (via autocomplete)    | ❌      | Skill invocation (`/skill:name`) | Deferred    |

### G.8. Keybindings cần thêm (P2)

| Keybinding         | pi-coding-agent | lazydsh | Mô tả              | Status   |
| ------------------ | --------------- | ------- | ------------------ | -------- |
| `app.session.tree` | ✅              | ✅      | Tree view sessions | **DONE** |

### G.9. Ưu tiên port (theo thứ tự)

1. ✅ **Port `custom-editor`** (121 dòng) — Editor tích hợp app keybindings, ảnh hưởng trực tiếp UX.
2. ✅ **Port `skill-invocation-message`** (64 dòng) — Render skill blocks, nhỏ và dễ.
3. ✅ **Port `scoped-models-selector`** (336 dòng) — Scoped models cho Ctrl+P cycling.
4. ✅ **Port `tree-selector`** (1254 dòng) — Tree view sessions, lớn nhất.
5. ✅ **Port `config-selector`** (757 dòng) — Resource management UI.
6. ✅ **Thêm commands** `/tree`, `/scoped-models`, `/trust`, `/import`, `/reload`.
7. ✅ **Thêm keybinding** `app.session.tree`.
8. ✅ **Wire orphan files** (13 component đã port, chưa wire).
9. ⏳ **Port settings items** (33 settings mới, P3) — Deferred to v0.3.0.
10. ⏳ **Cosmetic components** (armin, easter-egg-3d, pi-logo, earendil-announcement) — optional.

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
- [x] `branch_summary` event wired to `BranchSummaryMessageComponent`
- [x] `/trust` command wired to `TrustSelectorComponent`
- [x] `/fork` command wired to `UserMessageSelectorComponent`
- [x] `/tree` command wired to `TreeSelectorComponent`
- [x] `/scoped-models` command wired to `ScopedModelsSelectorComponent`
- [x] First-time setup shown on first run
- [x] Settings submenu & show-images selector wired
- [x] BashExecutionComponent for tool calls
- [x] Model selector test connection (Ctrl+T)
- [x] History search/filter via alt-screen
- [x] Footer cost breakdown per model
- [x] Session selector multi-delete (Shift+Ctrl+D + Space)

**Suite: 182/182 passing** (49 test files).

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per UI on `@earendil-works/pi-tui`.

---

## Next Actions (priority order)

1. ⏳ Theme creator UI (P3#6) — Optional, pi-coding-agent uses JSON editing
2. ⏳ `ui.ts` decomposition continued — In progress
3. ⏳ Extension system — Deferred to v0.3.0
4. ⏳ Additional commands (`/clone`, `/import`, `/reload`, `/debug`, `/hotkeys`, `/skill:*`) — Deferred to v0.3.0

---

## Bug-Fix Backlog (corrected, 2026-11-25)

See `AUDIT.md` §6 for full details.

### Critical

~~1. `src/runtime/runtime.ts:136-164` — global `fetch` monkey-patch (`__ofmFetchWrapped`). Move to module-level or per-provider.~~ **FIXED**
~~2. `src/runtime/runtime.ts:992` — `authorization.cancel(key)` not awaited in `logout()`. Verify and add `await` if async.~~ **FIXED**

### Medium

~~3. `src/interactive-mode/keybindings.ts` — `ctrl+s` bound to three actions. Reassign.~~ **FIXED**
~~4. `src/interactive-mode/footer-data-provider.ts:73` — `spawnSync("git")` blocks event loop. Replace with async.~~ **FIXED**
~~5. `src/interactive-mode/external-editor.ts:42` — editor command split without shell quoting. Fix quoting.~~ **FIXED**
~~6. `src/interactive-mode/components/user-message-selector.ts:169` — untracked `setTimeout`. Clear on dispose.~~ **FIXED**

### Low

~~7. `src/interactive-mode/ui.ts:1826` — `runtime.history().catch(() => [])` swallows errors. Log/surface.~~ **FIXED**
~~8. `src/interactive-mode/keybindings.ts:264-268` — `dispose()` may `unwatchFile` never-watched path. Guard.~~ **FIXED**

### Resource leaks

~~9. `ui.ts` finally: `keybindings.dispose()` not called (watcher stays active).~~ **FIXED**
~~10. `ui.ts` finally: `themeController.dispose()` not called (file watcher stays active).~~ **FIXED**
~~11. `FooterDataProvider`: no `dispose()` method (git watcher stays active).~~ **FIXED**

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per UI on `@earendil-works/pi-tui`.
