# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.17** · Suite **182/182 passing** (49 test files) · `npm run check` clean · `npm run build` clean · dist boots.

**Core complete.** The pi-coding-agent interactive-mode port is **functionally complete** — every advertised keybinding fires, every advertised panel opens, theme/settings persist, retry + compaction states are live, and the DSH bridge loads the full `@deepseek-ai/dsh-base` profile (101 plugin rows) with only the 14 services the TUI actually needs mounted eagerly. **P0 login unification done** (§8.26); **4 UX gaps remain** (see §D below) plus **13 orphan files** awaiting wiring (see §C below).

**Layout** (applied in §8.0 / CAUTRUC.md — three layers + root contracts):

```
src/
├── cli.ts plugin.ts types.ts          # wiring + barrel
├── interfaces.ts runtime-events.ts    # contracts (types + events only)
├── runtime/ (14 files)                # DSH bridge + boot, no pi-tui imports
├── interactive-mode/ (84 files)        # the TUI
│   ├── components/ (31 files)
│   └── theme/ (6 files + 3 JSON)
└── utils/ (7 files)                   # pure helpers, no pi-tui, no dsh
```

Rule: `interactive-mode/` → imports contracts, `utils/`, `runtime/`; `runtime/` → imports contracts, `utils/` only; root files may reference both.

---

## Phase History

### Phase 1 — Layout & Footer ✅

Chat layout (header → transcript → pending → status → widgets → editor → footer),
footer data provider (git branch, provider count, cwd), footer component
(tokens ↑↓/R/W, cache hit %, cost, context %, model + thinking, routed model,
responsive truncation), full `ui.ts` rewrite, `diff` dependency.

### Phase 2 — Tool Cards ✅

`detail.ts` detail engine (arguments / diff / output), `ToolRow` history rows with
mouse expansion, approval panel with operation preview. The row path renders through
`tools.ts`/`detail.ts`.

### Phase 3 — Selectors ✅

Model selector (fuzzy, scoped/all, current marker, default badge, Ctrl+S save),
session selector (DSH-native: tree view, search with `re:`/`"exact"`, scope/sort/
name/path toggles, archive/rename), search utilities.

### Phase 4 — Keybindings & Theme ✅

25 configurable actions with platform defaults, hot reload, legacy migration,
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

| §    | Item                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.0  | Housekeeping (debug writer removed)                                                                                                                                                                                                               |
| 8.1  | `-v/--version`, complete `runtime.cancel()`                                                                                                                                                                                                       |
| 8.2  | Ctrl+C state machine (`interrupt.ts`): clear / interrupt / force-exit / exit                                                                                                                                                                      |
| 8.3  | `/new` keeps transcript, `/clear` wipes                                                                                                                                                                                                           |
| 8.4  | QuestionPanel height budget for short terminals                                                                                                                                                                                                   |
| 8.5  | History shows reasoning rows (lifecycle by `attemptId`)                                                                                                                                                                                           |
| 8.6  | Tool meta plumbing end-to-end                                                                                                                                                                                                                     |
| 8.7  | `detail.ts` — one detail engine for approval + history                                                                                                                                                                                            |
| 8.8  | Deps `0.2.2-rc.4` (all 36 packages, old sessions still resume)                                                                                                                                                                                    |
| 8.9  | Overlay lifecycle: `/model` two-level picker, inverted `selecting` guards, login-dialog dismiss, real header version                                                                                                                              |
| 8.10 | Theme selector + thinking selector wired into `/settings` and `/effort`                                                                                                                                                                           |
| 8.11 | 3-layer restructure (CAUTRUC.md), `theme-schema` validation real, `tui-renderer` wired, dead files deleted                                                                                                                                        |
| 8.12 | `ModelSelectorComponent` wired (`model-catalog-runtime.ts` adapter)                                                                                                                                                                               |
| 8.13 | Auto light/dark pair setting in the theme picker                                                                                                                                                                                                  |
| 8.14 | All 25 keybindings audited and handled (6 advertised-but-dead keys wired; Ctrl+Z suspend; model cycling)                                                                                                                                          |
| 8.15 | Theme setting persists to `~/.config/lazydsh/theme.json`                                                                                                                                                                                          |
| 8.16 | Confirm-on-exit real + persisted; cosmetic toggles became honest info rows                                                                                                                                                                        |
| 8.17 | Retry/compaction status rows wired to DSH session events                                                                                                                                                                                          |
| 8.18 | Footer extension-status row live (`ExtensionWidget.status()`), dead provider params removed                                                                                                                                                       |
| 8.19 | Documentation pass: every claim re-verified against code (this file, README, AGENTS, ARCH, GOAL, CAUTRUC)                                                                                                                                         |
| 8.20 | Bash mode (`!` / `!!`): `Runtime.shell()` via DSH's executor + pure parser + card + next-prompt context                                                                                                                                           |
| 8.21 | Fixed `messageCount: 0` bug — now counts user messages from session events                                                                                                                                                                        |
| 8.22 | Fixed `footer.ts` inline `homedir()` — now imports from `node:os`                                                                                                                                                                                 |
| 8.23 | Fixed `getSessionPathKey` — now canonicalizes + case-insensitive on Windows                                                                                                                                                                       |
| 8.24 | Fixed `ScopedModel` missing `thinkingLevel` — added optional field                                                                                                                                                                                |
| 8.25 | Mermaid streaming ✅ (verified by `test/mermaid.test.ts`: mode `streaming` renders live) — `createMermaidMarkdownTransformer` exists but **disabled during streaming** (raw markdown shown until completion)                                      |
| 8.26 | **Unified login (P0)** — `lazydsh login`/`logout` now run through the TUI's `auth-flow.ts` flows via a terminal `AuthHost` (`cli-auth.ts`); `terminal-login.ts` deleted; end-to-end verified against a real profile (credential stored → removed) |
| 8.27 | **Approval "always allow" (P2)** — the panel gained a session-scoped grant; `runtime/approvals.ts` remembers the tool name and answers later requests with `allowed-once` (DSH's approval seam has no persistent grant)                           |

### 8.26 Login unification (P0) ✅

- [x] `authenticateProvider` exported from `auth-flow.ts` — one auth path for both entry points.
- [x] `cli-auth.ts`: terminal `AuthHost` (stdout notices, stdin prompts — numbered select, masked secret) + `cliLogin`/`cliLogout`; the provider picker lists every provider for login and only stored credentials for logout.
- [x] `command-runner.ts` delegates `login`/`logout` to those flows; `terminal-login.ts` deleted (its `openAuthUrl` test moved to `test/open-url.test.ts`).
- [x] Tests: `test/cli-auth.test.ts` (choice resolution, masked secret, backspace, Ctrl+C, control-sequence stripping, EOF) and `test/cli-command.test.ts` (wiring: success, declined, non-TTY guard, picker, remaining env refs) — suite now 171/171.
- [x] End-to-end verified with a real profile boot: `login opencode-go` → credential stored → `logout opencode-go` → credential removed.

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

### 8.21–8.24 Bug fixes & code smell fixes ✅

- [x] `messageCount: 0` → now reads session events and counts `user/message` events
- [x] `footer.ts` inline `homedir()` → imported from `node:os`
- [x] `getSessionPathKey` → canonicalizes via `realpathSync` + case-insensitive on Windows
- [x] `ScopedModel` interface → added `thinkingLevel?: string`

---

## REMAINING

### A. Bugs (functional issues)

1. **`safeSessionName` dead code** — ✅ REMOVED (no `getSessionName()` on DSH's sessionManager).

### B. Code smells / technical debt

2. **`session-selector.ts` `widthForLabel` hoisting** — ✅ FIXED (defined above first use).

3. **`ui.ts` decomposition** — 🔄 IN PROGRESS: auth cluster (`signIn`, `signOut`, provider options, logout) extracted to `auth-flow.ts` with an explicit `AuthHost` interface; duplicated oauth/api-key login branches merged into one `authenticateProvider`. `ui.ts` is still ~2325 lines; next clusters to extract: `pickModel`/`pickProviderModel`, streaming loop, session management, keybinding input handler.

4. **`ui.ts` `connect()` many parameters** — ✅ FIXED: options object (`ConnectOptions`: sessionId, notifyModel, startup, directory, keepTranscript); param renamed `connection` to avoid shadowing the outer `options`.

5. **`ui.ts` `ask()` / `select()` potential race condition** — ✅ FIXED: `ask()` now queues (`askQueue` + `drainAskQueue`); a question that arrives while another is open waits for it to settle instead of rejecting. Runtime callbacks (`onAuth`/`onApproval`/`onUserQuestion`) keep their fail-fast guard — DSH serializes its own prompts.

6. **`runtime/runtime.ts` `sessionManager` getter fallback** — ✅ FIXED: explicit `undefined` checks with a logger warning, throws when neither service exists.

7. **`settings-selector.ts` simplified** — Mostly by design: context policy, sandbox, transport, and cache warming are DSH-owned, and those rows say so instead of pretending to toggle them. Added the one setting lazydsh genuinely owns beyond `confirmExit`: **Mermaid diagrams** (`off` / `final` / `streaming`), persisted in `UiSettings.mermaidMode` and read live by the markdown transformer. Remaining rows stay as documented DSH delegations.

8. **`components/session-selector-search.ts` simplified search** — ✅ FIXED: tiered fuzzy search (TIER_NAME / TIER_TEXT / TIER_FUZZY), regex mode and phrase matching merged into the component version.

9. ~~Mermaid streaming partial~~ ✅ VERIFIED — `createMermaidMarkdownTransformer` exists but is **disabled during streaming** (raw markdown shown until completion). `test/mermaid.test.ts` proves mode `streaming` renders the diagram live (the guard only skips rendering in `final`/`off` modes).

---

### C. Orphan files (ported, typechecked, no call site — need product decision)

These files are **complete implementations** ported from pi-coding-agent. They are NOT dead code — they represent features that DSH provides and the TUI needs to display. They should be **wired, not deleted**.

#### C1. Need wiring (DSH provides the feature, TUI needs to display it)

1. **`branch-summary-message.ts` (105 lines)** — Renders branch summary messages.
   - DSH provides `branch_summary` events. lazydsh **does not** render branch summaries currently.
   - **Action:** Wire into transcript rendering (handle `branch_summary` session event in `ui.ts`).

2. **`compaction-summary-message.ts` (107 lines)** — ✅ WIRED
   - Wired into `compaction/summary` session events in `ui.ts` (renders summary text + tokensBefore).

3. **`trust-selector.ts` (151 lines)** — Project trust decision UI.
   - DSH has `ProjectTrustStore` and trust management. lazydsh has no trust UI.
   - **Action:** Wire into `/trust` command or settings.

4. **`user-message-selector.ts` (176 lines)** — Fork from message selector.
   - DSH supports fork from message. lazydsh has `/fork` but uses `forkPoints()` + `select()` instead of this component.
   - **Action:** Wire into `/fork` command.

5. **`custom-entry.ts` (85 lines)** — Renders custom session entries from extensions.
   - DSH provides custom entries via extension system.
   - **Action:** Wire when extension system is implemented.

6. **`custom-message.ts` (152 lines)** — Renders custom messages from extensions.
   - DSH provides custom messages via extension system.
   - **Action:** Wire when extension system is implemented.

7. **`extension-editor.ts` (136 lines)** — Multi-line editor for extensions.
   - DSH extension system needs this.
   - **Action:** Wire when extension system is implemented.

8. **`extension-input.ts` (101 lines)** — Text input for extensions.
   - DSH extension system needs this.
   - **Action:** Wire when extension system is implemented.

9. **`extension-selector.ts` (131 lines)** — Generic selector for extensions.
   - DSH extension system needs this.
   - **Action:** Wire when extension system is implemented.

10. **`first-time-setup.ts` (155 lines)** — First-time setup dialog (theme + analytics).
    - DSH onboarding. lazydsh has no first-time setup.
    - **Action:** Wire into startup flow.

11. **`settings-submenu.ts` (251 lines)** — SelectSubmenu, SteppedSubmenu for complex settings.
    - DSH settings with submenus. lazydsh settings selector is simplified.
    - **Action:** Wire into settings selector.

12. **`show-images-selector.ts` (55 lines)** — Show images yes/no selector.
    - DSH settings. lazydsh settings selector is simplified.
    - **Action:** Wire into settings selector.

13. **`bordered-loader.ts` (50 lines)** — Loader with borders for extension UI.
    - Utility component. Used by bug-report in reference.
    - **Action:** Wire when needed.

14. **`countdown-timer.ts` (41 lines)** — Countdown timer for dialogs.
    - Utility component. Used by extension-input and RetryStatusIndicator.
    - **Action:** Already used by `RetryStatusIndicator`; keep available for other dialogs.

#### C2. Quality improvements (merge or wire)

15. **`session-selector-search.ts` top-level (330 lines)** — ✅ DELETED: content merged into `components/session-selector-search.ts`; keeping both would duplicate the search engine.

---

### D. Remaining UX gaps (aligned with AUDIT.md §4 priorities)

Implemented (code exists) — removed from remaining list:

- P0#0 Login unification — CLI `login`/`logout` routed through `auth-flow.ts` via a terminal `AuthHost` (§8.26) ✓
- P0#1 Boot progress indicator during deferred plugin activation ✓
- P0#2 History virtualization (max 500 rows) ✓
- P0#3 (partial) Fake OAuth options fixed (buildLoginProviderOptions queries authorization) ✓
- P0#4 Tool streaming (`tool_execution_update` wired) ✓
- P1#5 Footer git watcher (FSWatcher on .git/HEAD) ✓
- P1#6 Theme DA1 async (non-blocking first paint) ✓
- P1#7 Ctrl+C simplified (clear/interrupt/exit) ✓
- P1#9 `!!cmd` output stays in the transcript (the card always renders it; only the model context differs) ✓
- P1#10 Queue visual indicator (gray rail + gray text for queued rows) ✓
- P1#11 Auth silent retry fixed (goingBack guard) ✓
- P2#11 Nested panels global ESC (dismissPanel(true) on ESC) ✓
- P2#12 Mermaid streaming enabled (mode "streaming", verified) ✓
- P2#5 Approval "always allow" — session-scoped grants via `runtime/approvals.ts` ✓

Still remaining (not implemented in code):

| Priority | #   | Flow                   | Problem                                     | Impact                              |
| -------- | --- | ---------------------- | ------------------------------------------- | ----------------------------------- |
| P2       | 1   | BashExecutionComponent | Only used for bash mode, not for tool calls | Inconsistent tool rendering         |
| P2       | 2   | ModelSelector          | No "test connection" button                 | Can't verify route before selecting |
| P3       | 3   | History                | No search/filter in transcript              | Hard to find old content            |
| P3       | 4   | Footer                 | No cost breakdown per model                 | Unclear spending                    |
| P3       | 5   | SessionSelector        | No "delete multiple"                        | Tedious session cleanup             |
| P3       | 6   | Theme                  | No custom theme creator UI                  | Users must hand-edit JSON           |

### E. Missing features (gaps vs pi-coding-agent reference)

16. **Session tree view** — Navigation, folding, filtering, labeling, copying, branch summarization.
17. **Scoped models** — Toggle models for Ctrl+P, enable/disable all, reorder, persist.
18. **Skill invocation UI** — Render skill blocks with expand/collapse.
19. **Config selector** — Resource management: enable/disable extensions/skills/prompts/themes.
20. **Radius MCP** — Radius MCP integration with animated shimmer.
21. **Easter eggs / mascot** — `armin.js`, `easter-egg-3d.js`, `earendil-announcement.js` (cosmetic).
22. **Pi logo** — Half-block logo with Apple Terminal fallback.
23. **Custom editor component** — Extends Editor with app keybindings.
24. **Extension system** — Full extension API (custom editors, widgets, dialogs, shortcuts, commands, tools, resources, RPC, MCP). See `docs/EXTENSION_API_DESIGN.md` for draft design.
25. **Commands missing** — `/clone`, `/import`, `/reload`, `/debug`, `/hotkeys`, `/tree`, `/scoped`, `/trust`, `/skill:*`.

---

### F. Docs / parity

26. **README translations outdated** — `README.ja.md`, `README.zh-CN.md` describe pre-refactor layout.
    - **Action:** Refresh when next touched.

27. **Extension system API** — Needs real API design, beyond "lazy" TUI.
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
- [x] Suite 182/182; `check` clean; `build` clean; dist boots
- [x] Bash mode (`!` / `!!`) wired and working
- [x] `messageCount` shows actual count (not 0)
- [x] `footer.ts` imports `homedir` from `node:os`
- [x] `getSessionPathKey` canonicalizes + case-insensitive on Windows
- [x] `ScopedModel` has `thinkingLevel` field
- [x] `tool_execution_update` wired (live streaming args/result into ToolRow)
- [x] Mermaid streaming enabled (mode "streaming", verified by test)

**Suite: 182/182 passing** (49 test files).

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per
UI on `@earendil-works/pi-tui`.

---

## Next Actions (priority order per AUDIT.md §6)

1. **BashExecutionComponent for tools** (P2#1) — use the rich renderer for tool calls instead of plain ToolRow.
2. **Model selector test connection** (P2#2) — add "test connection" button/flow to ModelSelectorComponent.
3. **Redesign LoginDialog Notice** (P0 follow-up) — add progress, buttons, auto-close to the OAuth notice kind.
4. **`ui.ts` decomposition continued** (B#3) — extract `pickModel`/`pickProviderModel` cluster, streaming loop, session management, keybinding input handler into separate modules.
5. **History search/filter** (P3#3) — add search/filter to transcript.
6. **Footer cost breakdown** (P3#4) — per-model cost breakdown.
7. **Session selector multi-delete** (P3#5) — multi-delete support.
8. **Theme creator UI** (P3#6) — UI for creating custom themes.

Then orphan file wiring (C1 items 1, 3, 4), then missing features vs reference (defer to v0.3.0).

---

## Bug-Fix Backlog (full line-by-line source scan, 2026-11-24)

Identified by reading every line of every `.ts` file in `src/` and `test/` (~44,000
lines). Each item has `file:line` citation. Ordered by severity. See `AUDIT.md` §6 for
full details.

### 🔴 Critical (must fix before release)

1. **`src/types.ts` — dead duplicate of `interfaces.ts`** (never imported anywhere in `src/` or `test/`). **Action:** Remove `src/types.ts` and update any external references to import from `interfaces.ts`.

2. **`src/runtime/runtime.ts:136-164` — `Runtime` constructor monkey-patches `globalThis.fetch` globally** with flag `__ofmFetchWrapped`. Every subsequent `fetch` in the process is affected; multiple `Runtime` instances cannot re-wrap. **Action:** Move the fetch wrapper into a dedicated module-level function called once at boot, or scope it per-runtime via a custom fetch passed to providers instead of mutating the global.

3. **`src/providers/ofm-provider/index.ts:134-143` — debug `appendFileSync("/tmp/ofm-debug.log", ...)` on every `session_start` / `before_agent_start`**, including `event.systemPrompt.length`. Blocks the event loop, leaks prompt-size info, has no on/off switch. **Action:** Delete the three `fs.appendFileSync` blocks entirely (they are leftover debug code).

4. **`tsconfig.json:14` + `vite.config.ts:13` — `src/providers/**` excluded from type-check and lint.** ~4,000 lines of ofm-provider code ship unverified. **Action:** Remove `"src/providers/**"` from `tsconfig.json` `exclude` and `vite.config.ts` `lint.ignorePatterns`; fix any resulting type errors.

5. **`src/runtime/runtime.ts:992` — possibly missing `await` on `this.ctx.authorization.cancel(key)`** in `logout()`. The line has no `await`, while sibling calls (`ctx.credentials.unset`, `ctx.credentials.deleteRecord`) are awaited. **Action:** Verify whether `authorization.cancel()` returns a Promise; if so, add `await`. If it is synchronous, no change needed.

### 🟡 Medium (should fix)

6. **Hardcoded ANSI escape codes** (violates "no hardcoded colors — theme tokens only" rule in AGENTS.md). Replace each `\x1b[...m` with `theme.fg(token, text)`:
   - `src/interactive-mode/ui.ts:87` — `bold = (text) => \`\x1b[1m${text}\x1b[0m\``
   - `src/interactive-mode/highlight.ts:154` — `\x1b[38;2;155;175;255m` (string color)
   - `src/interactive-mode/presentation.ts:61` — `\x1b[38;2;160;166;172m` (gray)
   - `src/interactive-mode/presentation.ts:70` — `\x1b[38;2;60;63;68m`
   - `src/interactive-mode/presentation.ts:153` — `\x1b[38;2;77;107;254m` (accent)
   - `src/interactive-mode/components/custom-message.ts:120` — `\x1b[1m[...]\x1b[22m`
   - `src/interactive-mode/components/branch-summary-message.ts:63` — `\x1b[1m[branch]\x1b[22m`
   - `src/interactive-mode/components/compaction-summary-message.ts:65` — `\x1b[1m[compaction]\x1b[22m`

7. **`src/interactive-mode/keybindings.ts` — duplicate key bindings.** `ctrl+p` bound to both `app.model.cycleForward` and `app.session.togglePath`; `ctrl+s` bound to both `app.thinking.save` and `app.session.toggleSort`. **Action:** Reassign one binding in each conflicting pair.

8. **`src/interactive-mode/footer-data-provider.ts:73` — `spawnSync("git", ...)` blocks the event loop** on every footer render (5s poll). **Action:** Replace with async `spawn` or move git branch detection off the render path.

9. **`src/interactive-mode/external-editor.ts:42` — editor command split on spaces without shell quoting.** Breaks on `$EDITOR="vim -c 'set syntax=markdown'"`. **Action:** Use `shell: true` or a proper shell-quote parser.

10. **`src/interactive-mode/components/user-message-selector.ts:169` — `setTimeout(() => onCancel(), 100)` timer ID not stored.** If the component unmounts before 100ms, `onCancel` may still fire. **Action:** Store timer ID and `clearTimeout` in `dispose()`.

### 🟢 Low (nice to have)

11. **`src/interactive-mode/ui.ts:1826` — `runtime.history().catch(() => [])` swallows errors silently.** **Action:** Log the error (or surface it) instead of silently returning `[]`.

12. **`src/interactive-mode/keybindings.ts:264-268` — `dispose()` may call `unwatchFile` on a path never watched** if `watchFile` threw. **Action:** Guard with a flag tracking whether watch actually started.

13. **`src/providers/models/index.ts:20` — Vietnamese comments in an English codebase** (e.g. `// ← ĐÚNG TÊN`). **Action:** Translate or remove.

14. **`vite.config.ts:11` — provider tests (`src/providers/ofm-provider/test/*`) excluded from `npm test`** (only `test/**/*.test.ts` is included). **Action:** Add `src/providers/**/*.test.ts` to `test.include`.

### Resource leaks (not previously documented)

15. **`src/interactive-mode/ui.ts` — `keybindings.startWatching()` called but `keybindings.dispose()` never called** in the `finally` block (line ~1855). The `watchFile` watcher stays active after TUI closes. **Action:** Add `keybindings.dispose()` to `finally`.

16. **`src/interactive-mode/ui.ts` — `themeController.disableAutoSync()` called but `themeController.dispose()` not called** (line ~2316). The file watcher (`watch(customThemesDir)`) stays active. **Action:** Add `themeController.dispose()` to `finally`.

17. **`src/interactive-mode/footer-data-provider.ts` — `FooterDataProvider` has `branchWatcher` (FSWatcher) but no `dispose()` method.** The git watcher stays active after TUI closes. **Action:** Add `dispose()` method and call it in `ui.ts` `finally`.

### Documentation sync needed

18. **`CAUTRUC.md:25`** — lists `types.ts` as "barrel re-export" but it is dead code. **Action:** Update description or remove file.

19. **`AGENTS.md:32`** — `ui.ts` (~2338 lines) vs actual 2325. **Action:** Update line count.

20. **`AGENTS.md:110`** — test count "150/42" vs actual 182/49. **Action:** Update counts.

21. **`AGENTS.md:158`** — "Remaining" list includes items already implemented (login unification, !!cmd output, queue indicator, bash execution for tools, approval always-allow, history virtualization, boot progress, fake OAuth fix, tool streaming, footer git watcher, DA1 async, Ctrl+C simplify, global ESC, mermaid streaming). **Action:** Sync with TODO.md/AUDIT.md.

22. **`README.md:75-96`** — keybindings table lists 27 actions vs actual 25 `app.*` bindings. **Action:** Update count.

23. **`GOAL.md:130`** — `ui.ts` 2178 lines (stale). **Action:** Update or remove.

24. **`AUDIT.md` body** — several items listed as "Remaining/not implemented" are already implemented per §8.26-§8.27. **Action:** Reconcile the two documents.

### Verified correct in AUDIT.md (no changes needed)

- Architecture overview, 3-layer contract rule, two-phase boot sequence, data flow, overlay stack management, safe runtime access (`safeRead`), ToolRow lifecycle, incremental highlighting, streaming (via `AssistantMessageComponent`, not `StreamingMarkdown`), Mermaid transformer, theme system, status indicators, shutdown sequence, extension points, bash mode, clipboard/external editor, autocomplete, history replay, footer, settings, and all 8 system-level loops match the source exactly.
- `tool_execution_update` is defined AND emitted (`runtime.ts:1209-1215`) AND consumed (`ui.ts:1709-1723`) — the old AUDIT.md note claiming "never emitted" was incorrect and has been corrected.

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
- [x] Suite 182/182; `check` clean; `build` clean; dist boots
- [x] Bash mode (`!` / `!!`) wired and working
- [x] `messageCount` shows actual count (not 0)
- [x] `footer.ts` imports `homedir` from `node:os`
- [x] `getSessionPathKey` canonicalizes + case-insensitive on Windows
- [x] `ScopedModel` has `thinkingLevel` field
- [x] `tool_execution_update` wired (live streaming args/result into ToolRow)
- [x] Mermaid streaming enabled (mode "streaming", verified by test)

**Suite: 182/182 passing** (49 test files).

---

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per
UI on `@earendil-works/pi-tui`.

---

## Next Actions (priority order per AUDIT.md §6)

1. **BashExecutionComponent for tools** (P2#1) — use the rich renderer for tool calls instead of plain ToolRow.
2. **Model selector test connection** (P2#2) — add "test connection" button/flow to ModelSelectorComponent.
3. **Redesign LoginDialog Notice** (P0 follow-up) — add progress, buttons, auto-close to the OAuth notice kind.
4. **`ui.ts` decomposition continued** (B#3) — extract `pickModel`/`pickProviderModel` cluster, streaming loop, session management, keybinding input handler into separate modules.
5. **History search/filter** (P3#3) — add search/filter to transcript.
6. **Footer cost breakdown** (P3#4) — per-model cost breakdown.
7. **Session selector multi-delete** (P3#5) — multi-delete support.
8. **Theme creator UI** (P3#6) — UI for creating custom themes.

Then orphan file wiring (C1 items 1, 3, 4), then missing features vs reference (defer to v0.3.0).