# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.219** · Suite **173/173 passing** (48 test files) · `npm run check` clean · `npm run build` clean · dist boots.

**Core complete.** The pi-coding-agent interactive-mode port is **functionally complete** — every advertised keybinding fires, every advertised panel opens, theme/settings persist, retry + compaction states are live, and the DSH bridge loads the full `@deepseek-ai/dsh-base` profile (101 plugin rows) with only the 14 services the TUI actually needs mounted eagerly. P0 login unification done (§8.26); UX gaps and code-quality items remain (see §REMAINING).

**Layout** (three layers + root contracts):

```
src/
├── cli.ts plugin.ts               # wiring
├── interfaces.ts runtime-events.ts # contracts (types + events only)
├── runtime/ (13 files)            # DSH bridge + boot, no pi-tui imports
├── interactive-mode/ (47 + 37 components + 1 theme)  # the TUI
└── utils/ (7 files)               # pure helpers, no pi-tui, no dsh
```

Rule: `interactive-mode/` → imports contracts, `utils/`, `runtime/`; `runtime/` → imports contracts, `utils/` only; root files may reference both.

---

## Phase History

Phases 1–7 (Layout & Footer, Tool Cards, Selectors, Keybindings & Theme, Message Components, Polish, Docs & Verification) complete. Phase 8 (Upstream Parity & Follow-ups) complete through §8.27. See git log for details.

Key completed items: two-phase boot with deferred plugins, overlay stack, safe runtime access, ToolRow lifecycle with live streaming, incremental highlighting, Mermaid, theme system with DA1 auto-sync, status indicators, shutdown, bash mode, login unification (P0), approval "always allow" (P2), history virtualization, footer git watcher.

---

## REMAINING (ordered by priority)

### P1 — Critical path (do first)

1. **Tách `ui.ts` god object** (~2765 dòng, `editor.onSubmit` ~790 dòng) — refactor before adding features. Clusters: pickModel/pickProviderModel, streaming loop, session management, keybinding input handler. (audit 3.5)
2. **Bash streaming output in turn live** — ~~`ToolLog.find()` chỉ trả `ToolRow`~~ **PARTIAL**: thêm `ToolLog.findAny()` + handler dùng findAny; bash branch `appendOutput` không còn dead code. Còn cần verify streaming thực sự hiển thị. (audit 3.10)
3. ~~**`connect()` catch block**~~ **FIXED** — bọc `await runtime.close()` trong try/catch riêng. (audit 3.11)
4. **`ofmOpencodeSessionIds` leak** — ~~clear entry khi session đóng/fork~~ **PARTIAL**: cap size 256 + clear khi vượt ngưỡng. Chưa clear per-session. (audit 3.3)

### P2 — UX / correctness

5. ~~**`OAuthSelectorComponent` animation perf**~~ **FIXED** — throttle `updateList()` 100ms thay vì mỗi frame. (audit 3.6)
6. **`session-selector.ts` width** — dùng `process.stdout.columns` thay vì render width thực tế → label bị cắt sai khi resize. (audit 3.7)
7. **`compressRequest` partial mutation** (token-saver) — payload mutate in-place khi filter throw; rollback hoặc không mutate. (audit 3.4)
8. ~~**`validateRoute`**~~ **FIXED** (comment clarified) — exact model validation thuộc dsh do --patch. (audit 4.4)
9. **Approval grants UI** — "Always allow" lưu per-Runtime, không có UI xóa grant. (audit 4.5)
10. **`runAfterFirstPaint` auto-retry** — hiện chỉ retry khi user gõ phím; thêm backoff/retry button. (audit 4.6)
11. **`pendingStartupConnection` orphan** — thêm timeout hoặc clear khi user action khác. (audit 4.7)
12. **`ofm-provider/index.ts` god function** (~514 dòng) — tách handler theo nhóm lệnh. (audit 4.8)
13. **`FREE_LANE_TOOL_ALIASES` hardcode** — lấy alias từ registry/config DSH thay vì hardcode version. (audit 4.9)

### P3 — Orphan files (cần product decision, wire don't delete)

Extension system (deferred v0.3.0):

- `custom-entry.ts`, `custom-message.ts`, `extension-editor.ts`, `extension-input.ts`, `extension-selector.ts`

Chưa wire (không cả barrel export):

- `thinking-selector.ts`, `trim-blanks.ts`

Chưa wire (chỉ barrel export / stub):

- `config-selector.ts`, `custom-editor.ts`, `skill-invocation-message.ts`, `tree-selector.ts`, `bordered-loader.ts`

Utility chỉ dùng bởi orphan:

- `countdown-timer.ts`

### P4 — UX gaps / missing features

- Theme creator UI (P3#6) — deferred (JSON editing).
- `/import` (placeholder — cần JSONL file picker), `/reload` (placeholder — cần DSH extension system).
- `/skill:*` — deferred.
- Settings items chưa port (steering mode, follow-up mode, transport, session share, HTTP idle timeout, cache warming, hide thinking, v.v.) — deferred v0.3.0.
- Cosmetic components (armin, easter-egg-3d, pi-logo, earendil-announcement) — optional.

### P5 — Docs / parity

- README translations (`README.ja.md`, `README.zh-CN.md`) mô tả layout cũ.
- Extension system API cần design thực sự.

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
- [x] Suite 173/173; `check` clean; `build` clean; dist boots
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
- [x] BashExecutionComponent for tool calls (PARTIAL — streaming gap P1#2)
- [x] Model selector test connection (Ctrl+T)
- [x] History search/filter via alt-screen
- [x] Footer cost breakdown per model
- [x] Session selector multi-delete (Shift+Ctrl+D + Space)

**Suite: 173/173 passing** (48 test files).

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per UI on `@earendil-works/pi-tui`.

---

## Next Actions (priority order)

1. ⏳ Tách `ui.ts` (P1#1)
2. ⏳ Bash streaming output (P1#2)
3. ⏳ `connect()` catch block (P1#3)
4. ⏳ `ofmOpencodeSessionIds` leak (P1#4)
5. ⏳ Remaining P2/P3/P4/P5 items

---

## Bug-Fix Backlog (corrected, 2026-11-25)

See `AUDIT.md` §6 for full details.

### Critical

~~1. `src/runtime/runtime.ts:136-164` — global `fetch` monkey-patch (`__ofmFetchWrapped`). Move to module-level or per-provider.~~ **FIXED**
~~2. `src/runtime/runtime.ts:992` — `authorization.cancel(key)` not awaited in `logout()`. Verify and add `await` if async.~~ **FIXED** (returns void)

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
