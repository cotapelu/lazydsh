# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.11** · Suite **179/179 passing** (46 test files) · `npm run check` clean · `npm run build` clean · dist boots.

**Core complete.** The pi-coding-agent interactive-mode port is **functionally complete** — every advertised keybinding fires, every advertised panel opens, theme/settings persist, retry + compaction states are live, and the DSH bridge loads the full `@deepseek-ai/dsh-base` profile (101 plugin rows) with only the 14 services the TUI actually needs mounted eagerly. **P0 login unification done** (§8.26); **4 UX gaps remain** (see AUDIT.md §4) plus **13 orphan files** awaiting wiring (see §C below).

**Layout** (applied in §8.0 / CAUTRUC.md — three layers + root contracts):

```
src/
├── cli.ts plugin.ts types.ts          # wiring + barrel
├── interfaces.ts runtime-events.ts    # contracts (types + events only)
├── runtime/ (11 files)                # DSH bridge + boot, no pi-tui imports
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

_Corrections made in the §8.19 doc pass:_ `src/chat-viewport.ts` was later
superseded by the inline layout and deleted (§8.11); the "delete `tools.ts` /
`plugin-patch.ts`" notes in the original 1.2 were false — both files still ship
(`interactive-mode/tools.ts`, `runtime/plugin-patch.ts`).

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

3. **`ui.ts` decomposition** — 🔄 IN PROGRESS: auth cluster (`signIn`, `signOut`, provider options, logout) extracted to `auth-flow.ts` with an explicit `AuthHost` interface; duplicated oauth/api-key login branches merged into one `authenticateProvider`. `ui.ts` is still ~2322 lines; next clusters to extract: `pickModel`/`pickProviderModel`, streaming loop, session management, keybinding input handler.

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

### E. Docs / parity

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
- [x] Suite 150/150; `check` clean; `build` clean; dist boots
- [x] Bash mode (`!` / `!!`) wired and working
- [x] `messageCount` shows actual count (not 0)
- [x] `footer.ts` imports `homedir` from `node:os`
- [x] `getSessionPathKey` canonicalizes + case-insensitive on Windows
- [x] `ScopedModel` has `thinkingLevel` field

**UX Gaps (see AUDIT.md §4):**

Implemented (code exists):

- [x] P0: Login unification — CLI `login`/`logout` routed through `auth-flow.ts` via a terminal `AuthHost`
- [x] P1: `!!cmd` output in transcript (card renders it; only the model context differs)
- [x] P1: Queue visual indicator (gray rail + gray text, `test/presentation.test.ts`)
- [x] P0: Boot progress indicator during deferred plugin activation
- [x] P0: History virtualization (lazy render visible window)
- [x] P0: Login — fake OAuth options fixed (buildLoginProviderOptions queries authorization)
- [x] P0: Tool streaming (`tool_execution_update` wired)
- [x] P2: Approval "always allow" — session-scoped grants via `runtime/approvals.ts` (DSH has no persistent grant)
- [x] B#9: Mermaid streaming — `test/mermaid.test.ts` proves mode `streaming` renders live (docs were stale) — session-scoped grants via `runtime/approvals.ts` (DSH has no persistent grant)
- [x] P1: Footer git watcher (FSWatcher on .git/HEAD)
- [x] P1: Theme DA1 async (non-blocking first paint)
- [x] P1: Ctrl+C simplified (clear/interrupt/exit)
- [x] P1: Auth silent retry fixed (goingBack guard)
- [x] P2: Nested panels global ESC (dismissPanel(true) on ESC)
- [x] P2: Mermaid streaming enabled (mode "streaming")

Remaining (not implemented in code):

- [ ] P2: BashExecutionComponent for tool calls — only used for bash mode
- [ ] P2: Model selector test connection
- [ ] P3: History search/filter
- [ ] P3: Footer cost breakdown per model
- [ ] P3: Session selector multi-delete
- [ ] P3: Theme creator UI

**Suite: 150/150 passing** (42 test files).

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
