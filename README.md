# lazydsh

[![CI](https://github.com/nuskey8/lazydsh/actions/workflows/ci.yml/badge.svg)](https://github.com/nuskey8/lazydsh/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/lazydsh)](https://www.npmjs.com/package/lazydsh)

English | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

A lazier terminal UI for DeepSeek Harness.

![demo](assets/demo.png)

## Overview

lazydsh is a TUI powered by [DeepSeek Harness](https://deepseek.com/en/harness/) as its backend. It contains only the essential features for handling DeepSeek Harness in a TUI, making it lightweight compared to other DSH TUI clients such as [dsh-TUI](https://dshtui.com/en).

It is **not** a DSH plugin: lazydsh boots the DSH profile inside its own process, so it runs on plain Node without a full DSH installation and never couples to a host's version.

## Features

### Lightweight & Fast

- **Cold start ~122 ms** — the shell paints before the 101-row DSH profile finishes loading; only the 14 services the TUI needs are eager
- **60fps idle / 30fps streaming** — per-component render caching and incremental highlighting
- **< 100 MB memory** — event-sourced sessions, visual truncation for large outputs

### Standalone & provider-independent

DeepSeek plus every pi-ai provider (OpenAI, Anthropic, Google, OpenCode, …) out of the box; credentials stay in DSH's store, never in the TUI.

### Interactive mode

| Feature          | Status                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Layout           | ✅ Header / Transcript / Pending / Status / Widgets / Editor / Footer                                        |
| Footer           | ✅ Tokens, cache hit %, cost, context %, model + thinking, git branch, provider count, extension statuses    |
| Messages         | ✅ Markdown, live reasoning stream, thinking toggle, OSC 133 zones, stop reasons                             |
| Status           | ✅ Working / Retry (countdown) / Compaction / Idle — retry and compaction follow DSH session events          |
| Model selector   | ✅ Fuzzy search across every provider, scoped/all, current marker, Ctrl+S save default                       |
| Session selector | ✅ Tree view, `re:`/`"exact"` search, scope/sort/name/path toggles, archive/rename                           |
| Theme            | ✅ Token theming, DA1 terminal sync, auto light/dark pair, live reload, user themes, selection persists      |
| Keybindings      | ✅ 27 actions, hot reload, platform defaults                                                                 |
| Tool rows        | ✅ Arguments, diffs, and output in one expandable row (shared with the approval panel)                       |
| Alt-screen       | ✅ Transcript search (`Ctrl+Shift+F`), select-to-copy, URL click-through                                     |
| Login            | ✅ OAuth (device code) and API key flows                                                                     |
| Settings         | ✅ `/settings` with persisted confirm-on-exit                                                                |
| Misc             | ✅ Ctrl+G external editor, Ctrl+X copy, Ctrl+Z suspend, bug report, program status (OSC 7501), session share |

## Installation

Node.js 24.9.0 or higher.

```sh
npm install -g lazydsh
```

## Usage

```sh
lazydsh                     # interactive TUI
lazydsh ask [prompt]        # one noninteractive request (stdin allowed)
lazydsh resume [session-id] # continue a saved conversation
lazydsh login [provider]    # OAuth or API key
lazydsh logout [provider]   # remove saved credentials
lazydsh upgrade             # self-update
```

Flags: `--provider`, `--model`, `--effort`, `--permission`, `--cwd`, `--home`,
`--resume`, `--patch`, `--list`, `-v/--version`, `-h/--help`.

## Keybindings

Configurable in `~/.config/lazydsh/keybindings.json` (created on first run, hot-reloaded).

| Action             | Default                     | Description                                                         |
| ------------------ | --------------------------- | ------------------------------------------------------------------- |
| Interrupt / cancel | `Esc`                       | Cancel the running turn, close panels                               |
| Clear / exit       | `Ctrl+C`                    | Clear draft → interrupt turn → force-exit; idle exits               |
| Exit               | `Ctrl+D`                    | Exit when the editor is empty (asks first if confirm-on-exit is on) |
| Suspend            | `Ctrl+Z`                    | Suspend to the background; `fg` restores                            |
| Model selector     | `Ctrl+L`                    | Open the model picker                                               |
| Cycle model        | `Ctrl+P` / `Shift+Ctrl+P`   | Next / previous logged-in provider                                  |
| Save model default | `Ctrl+S` (in picker)        | Persist as the startup default                                      |
| Queue follow-up    | `Alt+Enter`                 | Queue the current draft                                             |
| Restore queued     | `Alt+Up`                    | Pull a queued message back into the editor                          |
| Expand tools       | `Ctrl+O`                    | Toggle tool-row expansion                                           |
| Thinking toggle    | `Ctrl+T`                    | Show/hide reasoning blocks                                          |
| Cycle thinking     | `Shift+Tab`                 | Cycle reasoning effort                                              |
| Save thinking      | `Ctrl+S` (in effort picker) | Persist the effort for the route                                    |
| External editor    | `Ctrl+G`                    | Open `$EDITOR` with the current text                                |
| Copy message       | `Ctrl+X`                    | Copy the last assistant message                                     |
| Paste image        | `Ctrl+V`                    | Paste from the clipboard                                            |
| Archive session    | `Ctrl+Backspace`            | Archive picker (empty editor)                                       |

Session picker: `↑/↓` move · `Enter` resume · `Esc` back · `Ctrl+D` archive ·
`Ctrl+R` rename · `Tab` scope · `Ctrl+S` sort · `Ctrl+N` named-only · `Ctrl+P` paths.

## Commands

| Command                                          | Description                                    |
| ------------------------------------------------ | ---------------------------------------------- |
| `/clear`                                         | Wipe the transcript and start a new session    |
| `/new`                                           | Start a new session, keep the transcript       |
| `/resume`                                        | Pick a session to continue                     |
| `/cd`                                            | Choose the working directory                   |
| `/permission [preset]`                           | View/select permission presets                 |
| `/model`                                         | Select provider and model                      |
| `/login [provider]` / `/logout [provider]`       | Credentials                                    |
| `/file <path> \| clear`                          | Attach a file/image or clear attachments       |
| `/effort [level]`                                | Reasoning effort picker (Ctrl+S saves default) |
| `/rename [title]`                                | Rename the session                             |
| `/fork`                                          | Fork from a completed turn                     |
| `/archive` `/restore` `/pin` `/unpin`            | Session management pickers                     |
| `/ps` `/stop`                                    | Background jobs                                |
| `/session` `/status`                             | Session id / model, usage, limits              |
| `/compact`                                       | Summarize history                              |
| `/plan [off\|message]`                           | Plan mode                                      |
| `/goal …`                                        | Session goals                                  |
| `/feedback <text>`                               | Send quality feedback                          |
| `/export [path.zip]`                             | Export sessions to ZIP                         |
| `/dsh <cmd>`                                     | Run a native DSH command                       |
| `/bug` `/share` `/changelog` `/settings` `/quit` | Utilities                                      |

Unknown `/commands` fall through to DSH's native registry (profile plugins can add more).

## Themes

Semantic tokens, live reload, and the selection persists in
`~/.config/lazydsh/theme.json`. User themes live in `~/.config/lazydsh/themes/`
and are validated on load.

- `/settings` → Appearance → Theme — picker with live preview
- The picker's **auto (follow terminal)** row persists a `<light>/<dark>` pair; the controller re-applies it on every terminal light/dark change (DA1)
- Built-ins: `lazydsh`, `dark`, `light`, plus `system` (follows the terminal)

## Tool rows

Each tool call renders one expandable row: the tool's arguments, produced diffs
(word-level), and its output preview — the same engine (`detail.ts`) drives the
approval panel, so what you approve is what you see. Click a row or press
`Ctrl+O` to expand.

## Status row

| State      | Indicator                                                                      |
| ---------- | ------------------------------------------------------------------------------ |
| Working    | Spinner + message (`Stopping` while cancelling)                                |
| Retry      | `Retrying (attempt/max) in Ns…` with a live countdown — from DSH's `llm/retry` |
| Compaction | `Compacting context…` / `Auto-compacting…` — from DSH's `compaction/*`         |
| Idle       | `Ready · N queued`                                                             |

## Extension widgets

Widgets register above or below the editor and may publish a one-line footer
status:

```typescript
widgetRegistry.register({
  id: "my-widget",
  position: "above-editor",
  priority: 10,
  render: (width) => ["Widget content"],
  status: () => "ready", // optional footer status
});
```

## Configuration files

| File                                   | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `~/.config/lazydsh/keybindings.json`   | Custom keybindings                                    |
| `~/.config/lazydsh/theme.json`         | Selected theme (`{"theme":"dark"}` or `"light/dark"`) |
| `~/.config/lazydsh/themes/<name>.json` | User themes                                           |
| `~/.config/lazydsh/settings.json`      | UI preferences (`confirmExit`)                        |
| `$DSH_HOME/lazydsh-model.json`         | Last provider/model/effort                            |
| `$DSH_HOME/cache/lazydsh/tui.log`      | Captured console output                               |

## OSC support

OSC 133 (semantic zones) for shell integration and OSC 7501 (program status:
idle/working/blocked/done/error). Works with zsh, fish, bash, WezTerm, Ghostty, iTerm2, Kitty, VS Code.

## Providers

| Provider                                                                                                                                                                                          | ID                              | Auth                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------ |
| DeepSeek                                                                                                                                                                                          | `deepseek-official`, `deepseek` | API key                  |
| OpenAI                                                                                                                                                                                            | `openai`                        | API key, OAuth           |
| OpenAI Codex                                                                                                                                                                                      | `openai-codex`                  | OAuth                    |
| Anthropic                                                                                                                                                                                         | `anthropic`                     | API key, OAuth           |
| GitHub Copilot                                                                                                                                                                                    | `github-copilot`                | OAuth, token             |
| Google                                                                                                                                                                                            | `google`                        | API key                  |
| Google Vertex AI                                                                                                                                                                                  | `google-vertex`                 | API key, GCP credentials |
| Amazon Bedrock                                                                                                                                                                                    | `amazon-bedrock`                | AWS credentials, bearer  |
| OpenCode Go / Zen                                                                                                                                                                                 | `opencode-go`, `opencode`       | API key                  |
| OpenRouter                                                                                                                                                                                        | `openrouter`                    | API key, OAuth           |
| Radius                                                                                                                                                                                            | `radius`                        | API key, OAuth           |
| xAI · Meta · Mistral · Moonshot AI · Z.AI · Qwen · Xiaomi · Kimi · Ant Ling · Baseten · Cerebras · Cloudflare · Fireworks · Groq · Hugging Face · MiniMax · NVIDIA · Together · Vercel AI Gateway | see `lazydsh --list`            | API key (some OAuth)     |

`lazydsh --list` prints the exact catalog.

## Architecture

```
src/
├── cli.ts, plugin.ts, types.ts      # wiring
├── interfaces.ts, runtime-events.ts # contracts
├── runtime/ (11)                    # DSH bridge + two-phase boot
├── interactive-mode/ (47)           # TUI
│   ├── components/ (32)
│   └── theme/ (8 + 3 JSON)
└── utils/ (7)                       # pure helpers
```

`interactive-mode/` may import the contracts, `utils/`, and `runtime/`; `runtime/`
never imports the TUI. Full map: `CAUTRUC.md`.

## Development

```bash
npm run start    # run the built CLI
npm run check    # format + lint + types
npm test         # 145 tests
npm run build    # bundle → dist/
```

Docs: `AGENTS.md` (patterns) · `ARCH.md` (architecture) · `CAUTRUC.md` (file map) ·
`TODO.md` (history + remaining work) · `DSH-BASE.md` (the DSH bundle).

## Known gaps

Bash mode (`!cmd`) is documented in the roadmap but not yet implemented, and a
few ported components await wiring decisions — see `TODO.md` REMAINING.

## License

[MIT](LICENSE)
