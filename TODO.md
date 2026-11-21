# TODO.md — lazydsh Interactive Mode

## Current State

**Version 0.2.3** · Suite **145/145 passing** (40 test files) · `npm run check` clean · `npm run build` clean · dist boots.

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
├── interactive-mode/ (47 files)       # the TUI
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

| §   | Item |
| --- | ---- |
| 8.0 | Housekeeping (debug writer removed) |
| 8.1 | `-v/--version`, complete `runtime.cancel()` |
| 8.2 | Ctrl+C state machine (`interrupt.ts`): clear / interrupt / force-exit / exit |
| 8.3 | `/new` keeps transcript, `/clear` wipes |
| 8.4 | QuestionPanel height budget for short terminals |
| 8.5 | History shows reasoning rows (lifecycle by `attemptId`) |
| 8.6 | Tool meta plumbing end-to-end |
| 8.7 | `detail.ts` — one detail engine for approval + history |
| 8.8 | Deps `0.2.2-rc.4` (all 36 packages, old sessions still resume) |
| 8.9 | Overlay lifecycle: `/model` two-level picker, inverted `selecting` guards, login-dialog dismiss, real header version |
| 8.10 | Theme selector + thinking selector wired into `/settings` and `/effort` |
| 8.11 | 3-layer restructure (CAUTRUC.md), `theme-schema` validation real, `tui-renderer` wired, dead files deleted |
| 8.12 | `ModelSelectorComponent` wired (`model-catalog-runtime.ts` adapter) |
| 8.13 | Auto light/dark pair setting in the theme picker |
| 8.14 | All 27 keybindings audited and handled (6 advertised-but-dead keys wired; Ctrl+Z suspend; model cycling) |
| 8.15 | Theme setting persists to `~/.config/lazydsh/theme.json` |
| 8.16 | Confirm-on-exit real + persisted; cosmetic toggles became honest info rows |
| 8.17 | Retry/compaction status rows wired to DSH session events |
| 8.18 | Footer extension-status row live (`ExtensionWidget.status()`), dead provider params removed |
| 8.19 | Documentation pass: every claim re-verified against code (this file, README, AGENTS, ARCH, GOAL, CAUTRUC) |

---

## REMAINING

### Code — real gaps found by the §8.19 claim audit

1. **Bash mode (`!` prefix) is not implemented.** README documents it and
   `interactive-mode/bash-execution.ts` (210 lines, streaming + ANSI strip + exit
   pill + truncation warning) is fully ported but **unwired** — no `!` handling
   exists in `ui.ts`, so `!cmd` is currently sent to the model as prompt text.
   Wiring needs a TUI-side tool execution path (DSH tool definitions expose
   `execute(args, ctx)` but need a run context) — design decision, ~1 day.
2. **`tool-execution.ts` (438 lines) is unwired.** The live transcript renders
   tool activity through `tools.ts`/`detail.ts` rows instead. README's "Tool
   Cards ✅ live streaming, images, expandable" describes the orphan component,
   not the shipped row renderer — keep one, wire or delete the other.
3. **`tool-presentation.ts` (432 lines) is unwired.** Its `presentCall`/
   `presentResult` bridge is not used by any live path; the DSH render intents it
   maps are superseded by `detail.ts` + tool meta.
4. **Duplicate session search.** `interactive-mode/session-selector-search.ts`
   (330 lines, tiered fuzzy with message text) and
   `components/session-selector-search.ts` (190 lines, the one actually used)
   are two implementations of one job — the CAUTRUC merge item. Merge the tiered
   search into the DSH-native selector, or delete the unused one.
5. **Orphan component library** (ported, typechecked, no call site):
   `custom-editor`, `custom-entry`, `custom-message`, `extension-editor`,
   `extension-input`, `extension-selector`, `first-time-setup`,
   `settings-submenu`, `show-images-selector`, `trust-selector`,
   `user-message-selector`, `branch-summary-message`, `compaction-summary-message`,
   `bordered-loader`, `themed-text` (unwired by design — `TUI.invalidate()`
   cascades), `components/index.ts` (barrel). Each needs a product decision
   (wire / delete), none blocks shipping.

### Docs / parity — intentionally out of scope

- `interactive-mode.ts` as a separate orchestration class: resolved — `ui.ts` **is**
  the orchestration (CAUTRUC.md "Layering").
- Extension system proper (custom editors/entries/messages): needs a real API
  design, beyond a "lazy" TUI.
- README translations (`README.ja.md`, `README.zh-CN.md`) still describe the
  pre-refactor layout and features; refresh when next touched.

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
- [x] Suite 145/145; `check` clean; `build` clean; dist boots

**Suite: 145/145 passing** (51/95 at the start of Phase 8).

## Dependencies

`diff`, `highlight.js`, `open`, `typebox`, `zod` (direct); DSH packages per
`DSH-BASE.md`; UI on `@earendil-works/pi-tui`.

## Next Actions (priority order)

1. Decide bash mode: wire `bash-execution.ts` via a TUI tool-execution path, or
   remove the README claim and the file.
2. Resolve the `tool-execution.ts` / `tool-presentation.ts` vs `tools.ts`+
   `detail.ts` duplication (one renderer for tool activity).
3. Merge or delete the duplicate session-search implementation.
4. Per-component decisions on the orphan library (extensions API or delete).