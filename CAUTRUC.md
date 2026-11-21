# CAUTRUC.md — lazydsh File Map (3 layers + contracts)

**Status: APPLIED** (§8.11). The restructure moved every source file into three
layers with two root contracts and one wiring plane. This file is the record of
the final structure plus the resolutions taken where the original plan
double-listed files.

## The rule

```
interactive-mode/  →  interfaces.ts, runtime-events.ts, utils/*, runtime/*
runtime/           →  interfaces.ts, runtime-events.ts, utils/*   (never interactive-mode/)
utils/*            →  nothing local
root (cli, plugin, types, contracts) → may reference both layers
```

## Root (5 files)

| File | Role |
| ---- | ---- |
| `cli.ts` | arg parsing, temp patch file, `ensureProfile` + `runProfile`, `--version`, `--list` |
| `plugin.ts` | app plugin: creates `Runtime` (or pending proxy), runs ask/resume/login/logout or the TUI, `afterFirstPaint` hook |
| `interfaces.ts` | contract: `Route`, `RuntimeOptions`, `Callbacks`, `RunResult`, `CredentialSource`, `ApprovalRequest`, `QuestionResult`, `ModelRuntime`, `AutocompleteItem` |
| `runtime-events.ts` | contract: `RuntimeEvent` union, `eventText`, `reasoningText`, `contentText`, `isAuthFailure` |
| `types.ts` | barrel re-export of the contracts |

## runtime/ (11 files) — DSH bridge + boot

| File | Role |
| ---- | ---- |
| `runtime.ts` | `Runtime` class: sessions, models, auth, tools, stats, events |
| `dsh-boot.ts` | profile composition, two-phase mount, shutdown/interrupt |
| `deferred.ts` | `RUNTIME_SERVICE_NAMES` (14 eager services), deferred row selection, activation |
| `plugin-patch.ts` | extra services beyond dsh-base (connection, upload, workspace, schedule, present, file references, …) |
| `telemetry-patch.ts` | OTel opt-out |
| `catalog.ts` | providers + models table, route validation, provider patch |
| `provider.ts` | provider id normalization |
| `native-commands.ts` | registers DSH-native commands (`/export`, `/effort`) |
| `preferences.ts` | `$DSH_HOME/lazydsh-model.json` |
| `pending-runtime.ts` | throwing proxy before the deferred plugins attach |
| `upgrade.ts` | self-upgrade (npm/pnpm/yarn/bun/vp) |

## interactive-mode/ (47 files + components/ + theme/)

| File | Role |
| ---- | ---- |
| `ui.ts` | orchestration: layout, commands, overlays, streaming, queue, keybindings |
| `presentation.ts` | editor, status panel, queue view, transcript, notifications |
| `tui-renderer.ts` | `createInteractiveTui` (search styling, URL open, select-to-copy) |
| `tools.ts`, `detail.ts`, `tool-presentation.ts`*, `tool-execution.ts`* | tool rows + detail engine (*unwired — TODO REMAINING) |
| `bash-execution.ts`* | bash card (*unwired — TODO REMAINING) |
| `history.ts` | session-log replay into rows |
| `approval.ts`, `question.ts`, `interrupt.ts` | approval/question panels, Ctrl+C state machine |
| `model-*.ts` | model selector, catalog adapter, cycle, search, refresh |
| `session-*.ts` | DSH-native session selector + search (two implementations — TODO REMAINING) |
| `picker.ts`, `autocomplete.ts` | search picker, @file / /command completion |
| `footer.ts`, `footer-data-provider.ts` | footer + git/provider/extension-status data |
| `keybindings.ts`, `keybinding-hints.ts` | config + hint text |
| `theme.ts`, `theme/` | facade + tokens, controller, system theme, schema, settings, 3 JSON themes |
| `settings-selector.ts`, `settings-store.ts` | settings panel + persisted prefs |
| `changelog.ts`, `show-changelog.ts`, `bug-report.ts`, `session-share.ts` | panels |
| `clipboard.ts`, `external-editor.ts`, `open-url.ts`, `program-status.ts`, `tui-console.ts` | OS integration |
| `terminal-login.ts`, `command-runner.ts` | CLI auth + ask/login/logout runners |
| `streaming.ts`, `stream-highlight.ts`, `highlight.ts`, `diff.ts`, `markdown-transform.ts` | rendering helpers |
| `stats.ts`, `limits.ts` (FE copies live in `utils/`) | footer/status formatting |

### components/ (32)

header · assistant-message · user-message · login-dialog · oauth-selector ·
auth-url · provider-brand · status-indicator · status-container · dynamic-border ·
bordered-loader* · visual-truncate · themed-text* · countdown-timer ·
model-selector · session-selector · session-selector-search · thinking-selector ·
theme-selector · settings-submenu* · show-images-selector* · trust-selector* ·
user-message-selector* · custom-editor* · custom-entry* · custom-message* ·
extension-editor* · extension-input* · extension-selector* ·
first-time-setup* · branch-summary-message* · compaction-summary-message* · index

\* = ported but not wired (TODO REMAINING)

### theme/ (8)

theme.ts (facade) · theme-tokens.ts (83 tokens) · theme-controller.ts (DA1,
auto-sync, live reload, preview) · theme-schema.ts (validation) ·
theme-settings.ts (persistence) · system-theme.ts · dark.json · light.json ·
lazydsh.json

## utils/ (7)

`ansi.ts` · `truncate.ts` · `format.ts` · `stats.ts` · `limits.ts` ·
`models-are-equal.ts` · `version.ts`

## Resolutions vs the original plan

| Plan said | Resolution |
| --------- | ---------- |
| `plugin.ts` in root **and** `runtime/` | Root (wiring entry) |
| `runtime-events.ts` in root **and** `runtime/` | Root (contract) |
| `history.ts` in both layers | `interactive-mode/` (renders rows) |
| `stats.ts`/`limits.ts` in FE while BE imports them | `utils/` |
| theme files flat in `interactive-mode/` | `interactive-mode/theme/` (name clash with the `theme.ts` facade) |
| `dsh-boot`/`deferred`/`plugin-patch`/`telemetry-patch` in FE | `runtime/` (no pi-tui; boot plane) |
| `command-runner.ts` in `runtime/` | `interactive-mode/` (drives TUI auth for CLI commands) |
| `@/` alias imports | relative imports (tsconfig NodeNext + the test resolve hook work with them) |
| delete `components/session-selector.ts` (748-line dead file) | deleted |
| merge the two `session-selector-search.ts` | **open** — TODO REMAINING |