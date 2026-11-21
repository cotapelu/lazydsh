# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.3** · Suite **150/150 passing** (41 test files) · `npm run check` clean · `npm run build` clean · dist boots.

The pi-coding-agent interactive-mode port is **feature-complete and wired**: every
advertised keybinding fires, every advertised panel opens, theme/settings persist,
retry + compaction states are live, and the DSH bridge loads the full
`@deepseek-ai/dsh-base` profile (101 plugin rows — see `DSH-BASE.md`) with only the
14 services the TUI actually needs mounted eagerly.

**Layout** (applied in §8.0 / CAUTRUC.md — three layers + root contracts):

```
src/
├── cli.ts plugin.ts types.ts          # wiring + barrel
├── interfaces.ts runtime-events.ts    # contracts (types + events only)
├── runtime/ (11 files)                # DSH bridge + boot, no pi-tui imports
├── interactive-mode/ (89 files)        # the TUI
│   ├── components/ (32 files)
│   └── theme/ (8 files + 3 JSON)
└── utils/ (7 files)                   # pure helpers, no pi-tui, no dsh
```

Rule: `interactive-mode/` → imports contracts, `utils/`, `runtime/`; `runtime/` →
imports contracts, `utils/` only; root files may reference both.

---

## Phase History

### Phase 1 — Layout & Footer ✅

Chat layout (header → transcript → pending → status → widgets → editor → footer),
footer data provider (git branch, provider count, cwd), footer component
(tokens ↑↓/R/W, cache hit %, cost, context %, model + thinking, routed model,
responsive truncation), full `ui.ts` rewrite, `diff` dependency.

_Corrections made in the §8.19 doc pass:_ `src/chat-viewport.ts` was later
superseded by the inline layout and deleted (§8.11); the "delete `tools.ts` /
`plugin-patch.ts`" notes in the original 1.2 were false — both files still ship
(`interactive-mode/tools.ts`, `runtime/plugin-patch.ts`).

### Phase 2 — Tool Cards ✅

`detail.ts` detail engine (arguments / diff / output), `ToolRow` history rows with
mouse expansion, approval panel with operation preview, `tool-presentation.ts`
bridge for DSH's render intents. _Note: the row path now renders through
`tools.ts`/`detail.ts`; see REMAINING for the unwired `tool-execution.ts`._

### Phase 3 — Selectors ✅

Model selector (fuzzy, scoped/all, current marker, default badge, Ctrl+S save),
session selector (DSH-native: tree view, search with `re:`/`"exact"`, scope/sort/
name/path toggles, archive/rename), search utilities.

### Phase 4 — Keybindings & Theme ✅

27 configurable actions with platform defaults, hot reload, legacy migration,
hint text everywhere. Theme system: tokens, DA1 terminal query, system light/dark
auto-sync, live reload, validated user themes, persisted selection.

### Phase 5 — Message Components ✅

Assistant/user message components: markdown, thinking blocks (toggle + live
streaming of real reasoning), OSC 133 zones, stop reasons, streaming updates.

### Phase 6 — Polish ✅

Status indicators (working/retry/compaction/idle — compaction/retry wired in
§8.17), header (logo, version from package.json, key hints, changelog), login
dialog (OAuth notice + device code, secret, select), external editor (Ctrl+G),
copy (Ctrl+X), thinking selector (§8.10), bug report, OSC 7501 program status,
session share, changelog, settings panel, extension widget registry.

### Phase 7 — Docs & Verification ✅

README/architecture docs, performance audit (~122 ms cold start), integration
verification.

### Phase 8 — Upstream Parity & Follow-ups ✅

| §    | Item                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| 8.0  | Housekeeping (debug writer removed)                                                                                  |
| 8.1  | `-v/--version`, complete `runtime.cancel()`                                                                          |
| 8.2  | Ctrl+C state machine (`interrupt.ts`): clear / interrupt / force-exit / exit                                         |
| 8.3  | `/new` keeps transcript, `/clear` wipes                                                                              |
| 8.4  | QuestionPanel height budget for short terminals                                                                      |
| 8.5  | History shows reasoning rows (lifecycle by `attemptId`)                                                              |
| 8.6  | Tool meta plumbing end-to-end                                                                                        |
| 8.7  | `detail.ts` — one detail engine for approval + history                                                               |
| 8.8  | Deps `0.2.2-rc.4` (all 36 packages, old sessions still resume)                                                       |
| 8.9  | Overlay lifecycle: `/model` two-level picker, inverted `selecting` guards, login-dialog dismiss, real header version |
| 8.10 | Theme selector + thinking selector wired into `/settings` and `/effort`                                              |
| 8.11 | 3-layer restructure (CAUTRUC.md), `theme-schema` validation real, `tui-renderer` wired, dead files deleted           |
| 8.12 | `ModelSelectorComponent` wired (`model-catalog-runtime.ts` adapter)                                                  |
| 8.13 | Auto light/dark pair setting in the theme picker                                                                     |
| 8.14 | All 27 keybindings audited and handled (6 advertised-but-dead keys wired; Ctrl+Z suspend; model cycling)             |
| 8.15 | Theme setting persists to `~/.config/lazydsh/theme.json`                                                             |
| 8.16 | Confirm-on-exit real + persisted; cosmetic toggles became honest info rows                                           |
| 8.17 | Retry/compaction status rows wired to DSH session events                                                             |
| 8.18 | Footer extension-status row live (`ExtensionWidget.status()`), dead provider params removed                          |
| 8.19 | Documentation pass: every claim re-verified against code (this file, README, AGENTS, ARCH, GOAL, CAUTRUC)            |
| 8.20 | Bash mode (`!` / `!!`): `Runtime.shell()` via DSH's executor + pure parser + card + next-prompt context              |

### 8.20 Bash mode ✅

- [x] `Runtime.shell(command, {timeoutMs, signal})` runs through DSH's shell
      executor via `ctx.get("shell")` — the launcher never injects `shell` (only the
      agent's bash tool consumes it), so the unchecked accessor reads undefined
      before the tool set mounts. Verified with a real profile boot: exit code,
      captured stdout, `timedOut`/`aborted` facts.
- [x] `bash-mode.ts` (pure, tested): `parseBashMode` (`!` = in-context,
      `!!` = excluded, leading whitespace trimmed, only a line-leading bang counts)
      and `bashContextBlock` (command + exit + output folded into the next prompt).
- [x] `ui.ts`: bash lines bypass the turn/queue guards (they run locally, even
      mid-turn), render `BashExecutionComponent` (ANSI-stripped, exit pill, spill
      path on truncation), accumulate `bashContext` for the next prompt, and reset
      it on `/clear` + `/new`.
- [x] Tests: `test/bash-mode.test.ts` — suite now 150/150.

---

## REMAINING

### A. Bugs (functional issues)

1. **`messageCount: 0` in `runtime.ts` `sessions()`** — Session selector shows "0 msg" for all sessions.
   - **File:** `runtime/runtime.ts`, function `sessions()`
   - **Fix:** Implement actual message counting from session records.
   - **Severity:** Medium — visible to users in session selector.

2. **`safeSessionName` always returns undefined** — `runtime.sessionManager` has no `getSessionName()` method.
   - **File:** `interactive-mode/ui.ts` (line 129), `runtime/runtime.ts` (line 186)
   - **Fix:** Remove dead code or implement `getSessionName()` on sessionManager.
   - **Severity:** Low — no user-visible impact.

3. **`components/session-selector-search.ts` `getSessionPathKey` no canonicalization** — Doesn't follow symlinks or handle case-insensitivity on Windows.
   - **File:** `interactive-mode/components/session-selector-search.ts`
   - **Fix:** Implement `canonicalizePath` and case-insensitive comparison like reference.
   - **Severity:** Low — only affects Windows users with symlinks.

### B. Code smells / technical debt

4. **`footer.ts` inline `homedir()` function** — Should import from `node:os`.
   - **File:** `interactive-mode/footer.ts` (bottom of file)
   - **Fix:** `import { homedir } from "node:os"` and remove local function.
   - **Severity:** Low.

5. **`theme/theme.ts` uses deprecated `stripVTControlCharacters` from `node:util`** — Deprecated in Node 22+.
   - **File:** `interactive-mode/theme/theme.ts`
   - **Fix:** Import from `@earendil-works/pi-tui` instead.
   - **Severity:** Low.

6. **`session-selector.ts` `widthForLabel` hoisting** — Function defined 200 lines after first use.
   - **File:** `interactive-mode/session-selector.ts`
   - **Fix:** Move function definition to top of file.
   - **Severity:** Low.

7. **`ui.ts` 2211 lines — single function** — Could benefit from further decomposition.
   - **File:** `interactive-mode/ui.ts`
   - **Fix:** Extract `signIn()`, `signOut()`, `pickModel()` into separate files.
   - **Severity:** Low — maintainability.

8. **`ui.ts` `connect()` many parameters** — 6+ positional params.
   - **File:** `interactive-mode/ui.ts`
   - **Fix:** Refactor to use options object.
   - **Severity:** Low.

9. **`ui.ts` `ask()` / `select()` potential race condition** — No queueing; concurrent calls reject.
   - **File:** `interactive-mode/ui.ts`
   - **Fix:** Add queueing or document the contract.
   - **Severity:** Low.

10. **`runtime/runtime.ts` `sessionManager` getter fallback** — `ctx.get("sessionManager") ?? ctx.get("sessionPersistence")` might mask missing service.
    - **File:** `runtime/runtime.ts`
    - **Fix:** Use explicit check with warning.
    - **Severity:** Low.

11. **`model-selector.ts` `ScopedModel` missing `thinkingLevel`** — Reference has per-model thinking level.
    - **File:** `interactive-mode/model-selector.ts`
    - **Fix:** Add `thinkingLevel?: string` to `ScopedModel` interface.
    - **Severity:** Low.

12. **`settings-selector.ts` simplified** — Only 10 settings items vs reference's 40+.
    - **File:** `interactive-mode/settings-selector.ts`
    - **Fix:** Add missing settings (transport, cache warming, mermaid rendering, etc.) or document as DSH-delegated.
    - **Severity:** Medium — users miss settings.

13. **`components/session-selector-search.ts` simplified** — Loses tiered fuzzy search (TIER_NAME, TIER_TEXT, TIER_FUZZY), regex mode, phrase matching.
    - **File:** `interactive-mode/components/session-selector-search.ts`
    - **Fix:** Merge tiered search from top-level `session-selector-search.ts` (330 lines, currently orphan).
    - **Severity:** Medium — search quality degraded.

14. **`tool-execution.ts` `formatToolCallWithArgs` simplified** — Different from reference's `render-utils`.
    - **File:** `interactive-mode/tool-execution.ts`
    - **Fix:** Align with reference's implementation.
    - **Severity:** Low (file is orphan).

### C. Orphan files (dead code — typecheck pass, no call sites)

15. **`tool-execution.ts` (438 lines)** — orphan. Live transcript uses `tools.ts`/`detail.ts`.
    - **Action:** Wire or delete. Keep one renderer for tool activity.

16. **`tool-presentation.ts` (432 lines)** — orphan. Bridge for DSH render intents not used.
    - **Action:** Wire or delete. DSH render intents superseded by `detail.ts` + tool meta.

17. **`session-selector-search.ts` top-level (330 lines)** — orphan. Tiered fuzzy search not used.
    - **Action:** Merge into component version or delete.

18. **Orphan components (12+)** — ported, typechecked, no call site:
    - `custom-editor`, `custom-entry`, `custom-message`
    - `extension-editor`, `extension-input`, `extension-selector`
    - `first-time-setup`, `settings-submenu`, `show-images-selector`
    - `trust-selector`, `user-message-selector`
    - `branch-summary-message`, `compaction-summary-message`
    - `bordered-loader`, `themed-text` (unwired by design), `countdown-timer`
    - `components/index.ts` (barrel)
    - **Action:** Wire or delete per component. None blocks shipping.

### D. Missing features (gaps vs reference)

19. **Mermaid rendering** — `mermaid.js` (Unicode diagrams, settings mode off/final/streaming).
    - **Action:** Implement `createMermaidMarkdownTransformer` equivalent.

20. **Session tree view** — `tree-selector.js` (1246 lines, navigation, folding, filtering, labeling, copying, branch summarization).
    - **Action:** Implement tree selector component.

21. **Scoped models** — `scoped-models-selector.js` (toggle models for Ctrl+P, enable/disable all, reorder, persist).
    - **Action:** Implement scoped models selector.

22. **Skill invocation UI** — `skill-invocation-message.js` (render skill blocks with expand/collapse).
    - **Action:** Implement skill invocation message component.

23. **Config selector** — `config-selector.js` (resource management: enable/disable extensions/skills/prompts/themes, project overrides).
    - **Action:** Implement config selector.

24. **Radius MCP** — `radius-login-selector.js` (Radius MCP integration with animated shimmer).
    - **Action:** Implement Radius login selector (niche).

25. **Easter eggs / mascot** — `armin.js`, `easter-egg-3d.js`, `earendil-announcement.js` (cosmetic).
    - **Action:** Implement or skip (cosmetic).

26. **Pi logo** — `pi-logo.js` (half-block logo with Apple Terminal fallback).
    - **Action:** Implement or keep provider-brand (cosmetic).

27. **Custom editor component** — `custom-editor.js` (extends Editor with app keybindings).
    - **Action:** Implement or keep PromptEditor approach.

28. **Extension system** — Full extension API (custom editors, widgets, dialogs, shortcuts, commands, tools, resources, RPC, MCP).
    - **Action:** Design real extension API (intentionally out of scope).

29. **Commands missing** — `/clone`, `/import`, `/reload`, `/debug`, `/hotkeys`, `/tree`, `/scoped`, `/trust`, `/skill:*`.
    - **Action:** Implement each command.

### E. Docs / parity

30. **README translations outdated** — `README.ja.md`, `README.zh-CN.md` describe pre-refactor layout.
    - **Action:** Refresh when next touched.

31. **Extension system API** — Needs real API design, beyond "lazy" TUI.
    - **Action:** Design and implement extension API.

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
- [x] Every declared keybinding has a handler (pi-tui owns `tui.altScreen.*`)
- [x] Theme (name / auto pair / user themes) and UI settings persist
- [x] Retry + compaction states appear from DSH session events
- [x] Footer shows git branch, provider count, extension statuses
- [x] Suite 150/150; `check` clean; `build` clean; dist boots
- [x] Bash mode (`!` / `!!`) wired and working

**Suite: 150/150 passing** (51/95 at the start of Phase 8).

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per
`DSH-BASE.md`; UI on `@earendil-works/pi-tui`.

## Next Actions (priority order)

1. **Fix `messageCount: 0`** — implement actual message counting in `runtime.ts` (functional bug).
2. **Update TODO.md** — bash mode is wired (§8.20), not broken.
3. **Clean up orphan files** — delete or wire `tool-execution.ts`, `tool-presentation.ts`, `session-selector-search.ts` (top-level), and 12 orphan components.
4. **Fix code smells** — inline `homedir()`, deprecated `stripVTControlCharacters`, `widthForLabel` hoisting, `ScopedModel` missing `thinkingLevel`, `getSessionPathKey` no canonicalization.
5. **Fix `settings-selector.ts`** — add missing settings or document as DSH-delegated.
6. **Merge tiered search** — into `components/session-selector-search.ts`.
7. **Implement missing features** (mermaid, tree view, scoped models, skill invocation, config selector, radius, easter eggs, pi logo, custom editor, extension system, 9 commands) — defer to v0.3.0.
8. **Refresh README translations** — when next touched.
9. **Design extension API** — needs real API design (intentionally out of scope).