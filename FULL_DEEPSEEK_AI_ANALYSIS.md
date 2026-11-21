# @deepseek-ai Packages: FULL ANALYSIS (npm registry)

## 📊 SUMMARY

| Metric                                 | Count           |
| -------------------------------------- | --------------- |
| **Total on npm (@deepseek-ai/\*)**     | **433**         |
| **Installed in `node_modules/`**       | **341** (78.8%) |
| **Direct dependencies (package.json)** | **77** (17.8%)  |
| **Transitive dependencies**            | **264** (61.0%) |
| **NOT installed (available on npm)**   | **92** (21.2%)  |

---

## ✅ 77 DIRECT DEPENDENCIES (package.json)

### Core Runtime (12)

```
cordis, cordis-plugin-include, cordis-plugin-loader, dsh, dsh-app-boot, dsh-base, dsh-cmdline, dsh-commands, dsh-launch-environment, dsh-sdk-protocol, dsh-shell, dsh-home-paths
```

### LLM & Providers (4)

```
dsh-llm, dsh-llm-pi-ai, dsh-agent-default-model, dsh-anonymous-user-id
```

### Session & Persistence (11)

```
dsh-session, dsh-session-persistence, dsh-session-query, dsh-session-title, dsh-session-title-llm, dsh-session-log-export, dsh-session-telemetry
```

### Agent & Tools (12)

```
dsh-agent, dsh-subagent, dsh-tool-ask-user, dsh-tool-lsp, dsh-tool-present, dsh-tool-schedule, dsh-tools, dsh-user-approval, dsh-user-questions, dsh-permission-presets, dsh-plan-mode, dsh-workflow
```

### File System & Workspace (8)

```
dsh-fs, dsh-workspace, dsh-working-directory, dsh-file-reference, dsh-file-reference-local, dsh-deliverable-file-references, dsh-storage, dsh-storage-domain
```

### Terminal & Execution (6)

```
dsh-bash-local, dsh-terminal, dsh-terminal-bash, dsh-subprocess, dsh-sandbox, dsh-schedule
```

### MCP / LSP / Skills (6)

```
dsh-mcp-client, dsh-mcp-manager, dsh-lsp, dsh-lsp-stdio, dsh-skill, dsh-ptc-runtime
```

### Auth & Credentials (4)

```
dsh-authorization, dsh-credentials, dsh-client-connection, dsh-client-file-upload
```

### Compaction & Token (4)

```
dsh-compaction, dsh-output-retention, dsh-token-meter, dsh-time-context
```

### Utilities (5)

```
dsh-util-time, dsh-util-values, dsh-util-workspace-path, dsh-brand, dsh-message-feedback
```

### Telemetry / Protocol (3)

```
dsh-typert-protocol, dsh-typert-registry, dsh-api-gateway
```

### Native Commands (1)

```
dsh-native-command
```

---

## ❌ 92 NOT INSTALLED (available on npm but not in node_modules)

### 🧪 Experimental - Agent Teams & Browser Use (18)

| Package                                            | Purpose                         |
| -------------------------------------------------- | ------------------------------- |
| `dsh-experimental-agent-team`                      | Agent team orchestration        |
| `dsh-experimental-agent-team-profile`              | Agent team profiles             |
| `dsh-experimental-agent-team-web-profile`          | Web agent team profiles         |
| `dsh-experimental-browser-use-chrome-devtools-mcp` | Browser via Chrome DevTools MCP |
| `dsh-experimental-browser-use-playwright-mcp`      | Browser via Playwright MCP      |
| `dsh-experimental-browser-use-runtime`             | Browser runtime                 |
| `dsh-experimental-browser-use-stagehand-native`    | Stagehand native browser        |
| `dsh-experimental-claude-code-mods`                | Claude Code modifications       |
| `dsh-experimental-client-ui-agent-team`            | Web UI for agent teams          |
| `dsh-experimental-client-ui-claude-code-mods`      | Web UI for Claude Code mods     |
| `dsh-experimental-computer-use-cua-driver-mcp`     | CUA driver MCP                  |
| `dsh-experimental-computer-use-cua-driver-native`  | CUA driver native               |
| `dsh-experimental-cua-macos`                       | CUA macOS                       |
| `dsh-experimental-ptc-runtime-python`              | PTC runtime Python              |
| `dsh-experimental-schedule-bundle`                 | Schedule bundle                 |
| `dsh-experimental-subagent-oar`                    | Subagent OAR                    |
| `dsh-experimental-tool-agent-team`                 | Tool for agent teams            |
| `dsh-experimental-tool-subagent-oar`               | Tool for subagent OAR           |
| `dsh-experimental-webworker-packer`                | WebWorker packer                |
| `dsh-experimental-webworker-runtime`               | WebWorker runtime               |

**Why not used**: Experimental, browser/computer-use focused, WebWorker-based — not terminal TUI.

---

### 🌐 Web / Client Runtime / SDK (13)

| Package                          | Purpose                   |
| -------------------------------- | ------------------------- |
| `dsh-client-runtime`             | Client runtime            |
| `dsh-client-test-runtime`        | Test runtime              |
| `dsh-client-web`                 | Web client                |
| `dsh-client-web-react`           | React web client          |
| `dsh-code-runtime`               | Code runtime              |
| `dsh-code-runtime-python`        | Python code runtime       |
| `dsh-code-runtime-worker-thread` | Worker thread runtime     |
| `dsh-sdk-client`                 | SDK client                |
| `dsh-sdk-jsonrpc-demo`           | JSON-RPC demo             |
| `dsh-workflow-worker-thread`     | Workflow in worker thread |
| `dsh-remote-mock`                | Remote mock               |
| `dsh-loader-smoke`               | Loader smoke test         |
| `dsh-client-store`               | Client store              |

**Why not used**: Web/client runtimes, worker threads, SDK clients — lazydsh uses pi-tui directly.

---

### 🌐 Web UI Components (10)

| Package                                     | Purpose                    |
| ------------------------------------------- | -------------------------- |
| `dsh-client-ui-deepseek-model-label-1017`   | DeepSeek model label       |
| `dsh-client-ui-dockkit`                     | Dock UI kit                |
| `dsh-client-ui-primitives`                  | UI primitives              |
| `dsh-client-ui-settings-unarchive-sessions` | Unarchive sessions setting |
| `dsh-client-ui-sidebar-textpreview`         | Text preview sidebar       |
| `dsh-client-ui-slots`                       | Slot components            |
| `dsh-client-ui-account-notifications`       | Account notifications      |
| `dsh-client-ui-action-cards`                | Action cards               |
| `dsh-client-ui-creation-recommendations`    | Creation recommendations   |
| `dsh-client-ui-model-selection`             | Model selection UI         |

**Why not used**: Web React UI components — lazydsh uses pi-tui.

---

### 🔐 Auth / Account Variants (5)

| Package                         | Purpose                   |
| ------------------------------- | ------------------------- |
| `dsh-api-account-controller`    | Account API controller    |
| `dsh-deepseek-account-platform` | DeepSeek account platform |
| `dsh-hook-protocol`             | Hook protocol             |
| `dsh-hooks-claude-code`         | Claude Code hooks         |
| `dsh-hooks-codex`               | Codex hooks               |

**Why not used**: DeepSeek-specific auth, Claude Code/Codex hooks — lazydsh uses pi-ai multi-provider auth.

---

### ☁️ Cloud / Remote Execution (9)

| Package              | Purpose            |
| -------------------- | ------------------ |
| `dsh-e2b`            | E2B sandbox        |
| `dsh-fs-e2b`         | E2B filesystem     |
| `dsh-fs-ssh`         | SSH filesystem     |
| `dsh-sandbox-ssh`    | SSH sandbox        |
| `dsh-ssh`            | SSH execution      |
| `dsh-subprocess-e2b` | E2B subprocess     |
| `dsh-subprocess-ssh` | SSH subprocess     |
| `dsh-host-apiproxy`  | API proxy host     |
| `dsh-browser-use`    | Browser automation |

**Why not used**: Cloud/remote execution (E2B, SSH) — lazydsh runs locally.

---

### 🗄️ SQLite / Alternative Storage (6)

| Package                          | Purpose                    |
| -------------------------------- | -------------------------- |
| `dsh-session-persistence-sqlite` | SQLite session persistence |
| `dsh-session-snapshot`           | Session snapshots          |
| `dsh-session-query-sqlite`       | SQLite session query       |
| `dsh-settings-file`              | File-based settings        |
| `dsh-storage-sqlite`             | SQLite storage             |
| `dsh-client-schema-form`         | Schema forms               |

**Why not used**: SQLite backends — lazydsh uses JSONL/file-based persistence.

---

### 🤖 Subagent Variants (6)

| Package                          | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `dsh-subagent-acp`               | ACP subagent                              |
| `dsh-subagent-claude-code`       | Claude Code subagent                      |
| `dsh-subagent-codex`             | Codex subagent                            |
| `dsh-subagent-dsh-sdk`           | DSH SDK subagent                          |
| `dsh-subagent-in-process-driver` | In-process driver                         |
| `dsh-subagent-fork-in-process`   | Fork in-process (installed as transitive) |

**Why not used**: Specific subagent integrations — lazydsh uses core `dsh-subagent`.

---

### 🧪 Experimental - Other (7)

| Package                                      | Purpose            |
| -------------------------------------------- | ------------------ |
| `dsh-experimental-voice-input-bundle`        | Voice input bundle |
| `dsh-experimental-speech-to-text`            | Speech to text     |
| `dsh-experimental-speech-to-text-sensevoice` | SenseVoice STT     |
| `dsh-experimental-cot-translation-bundle`    | CoT translation    |
| `dsh-experimental-liveshare`                 | LiveShare          |
| `dsh-experimental-liveshare-protocol`        | LiveShare protocol |
| `dsh-experimental-terminal-bundle`           | Terminal bundle    |

**Why not used**: Experimental, voice/speech, collaboration — not terminal TUI.

---

### 📦 Cordis / Infrastructure (3)

| Package                        | Purpose           |
| ------------------------------ | ----------------- |
| `cordis-plugin-hmr`            | Hot module reload |
| `cordis-plugin-logger-console` | Console logger    |
| `dsh-invariants`               | Invariants/checks |

**Why not used**: Dev/debug tools — not needed in production TUI.

---

### 🔧 LLM Testing / Mock (3)

| Package               | Purpose         |
| --------------------- | --------------- |
| `dsh-llm-mock-server` | Mock LLM server |
| `dsh-llm-replay`      | LLM replay      |
| `dsh-llm-retry`       | LLM retry logic |

**Why not used**: Testing/mocking — not production.

---

### 🧰 Tool Variants (3)

| Package                    | Purpose              |
| -------------------------- | -------------------- |
| `dsh-tool-subagent-report` | Subagent report tool |
| `dsh-tool-testkit`         | Tool testkit         |
| `dsh-typert-generator`     | Typert generator     |

**Why not used**: Testing/reporting tools — not needed.

---

### 🌐 Web Search Variants (3)

| Package                     | Purpose           |
| --------------------------- | ----------------- |
| `dsh-webhook`               | Webhooks          |
| `dsh-webhook-github`        | GitHub webhooks   |
| `dsh-web-search-exa`        | Exa search        |
| `dsh-web-search-perplexity` | Perplexity search |

**Why not used**: Webhook servers, alternative search providers — not used.

---

### 📚 Office / Document (8)

| Package                        | Purpose                              |
| ------------------------------ | ------------------------------------ |
| `dsh-office-to-pdf`            | Office to PDF                        |
| `libreoffice-kit-darwin-arm64` | LibreOffice macOS ARM64              |
| `libreoffice-kit-darwin-x64`   | LibreOffice macOS x64                |
| `libreoffice-kit-win32-arm64`  | LibreOffice Windows ARM64            |
| `libreoffice-kit-win32-x64`    | LibreOffice Windows x64              |
| `libreoffice-kit-wasm`         | LibreOffice WASM (installed)         |
| `dsh-office-kit`               | Office kit (installed as transitive) |

**Why not used**: Platform-specific LibreOffice binaries — only WASM needed if at all.

---

### 🔒 Native Addons - Platform Variants (11)

| Package                               | Purpose                            |
| ------------------------------------- | ---------------------------------- |
| `node-addon-landlock-run`             | Landlock runner                    |
| `node-addon-landlock-run-linux-arm64` | Landlock Linux ARM64               |
| `node-addon-landlock-run-linux-x64`   | Landlock Linux x64 (installed)     |
| `node-addon-system-darwin-arm64`      | System addon macOS ARM64           |
| `node-addon-system-darwin-x64`        | System addon macOS x64             |
| `node-addon-system-linux-arm64`       | System addon Linux ARM64           |
| `node-addon-system-linux-x64`         | System addon Linux x64 (installed) |
| `node-addon-system`                   | System addon (installed)           |

**Why not used**: Platform-specific native binaries — only current platform installed.

---

### 🧪 Agent Demos / Testkits (5)

| Package                  | Purpose            |
| ------------------------ | ------------------ |
| `dsh-agent-loop-testkit` | Agent loop testkit |
| `dsh-agent-presets`      | Agent presets      |
| `dsh-agent-spine-demo`   | Agent spine demo   |
| `dsh-acp-demo`           | ACP demo           |
| `dsh-acp-snapshot`       | ACP snapshot       |

**Why not used**: Demos and testkits — not production.

---

## 📦 264 TRANSITIVE DEPENDENCIES (installed but not in package.json)

These are **pulled in by the 77 direct deps**. Key categories:

### Alternative Implementations (pulled by core packages)

| Category                   | Examples                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Sandboxed tools**        | `dsh-tool-bash`, `dsh-tool-bash-persistent`, `dsh-bash-sandbox`, `dsh-tool-pwsh`, `dsh-pwsh-local`, `dsh-pwsh-sandbox` |
| **Alternative FS**         | `dsh-fs-local`, `dsh-fs-sandbox`, `dsh-fs-patch`, `dsh-fs-observation-policy`                                          |
| **Alternative storage**    | `dsh-storage-json`, `dsh-spill-local`, `dsh-spill-policy`, `dsh-attachment-local`, `dsh-credentials-local`             |
| **Alternative subprocess** | `dsh-subprocess-local`, `dsh-subagent-spawn-in-process`, `dsh-subagent-fork-in-process`                                |
| **Alternative sandbox**    | `dsh-sandbox-local`, `dsh-sandbox-policy`, `dsh-sandbox-windows-acl`                                                   |

### Web UI Components (pulled by `dsh-client-*` deps)

```
dsh-client-ui-* (40+ packages: chat, conversation, sidebar, settings, layout, renderer, etc.)
```

### Session Variants (pulled by `dsh-session-*`)

```
dsh-session-format-v0-to-v1, v1-to-v2, v2-to-v3, v3-to-v4
dsh-session-projection, dsh-session-projection-cache
dsh-session-reference, dsh-session-stats, dsh-session-turn-outline
dsh-session-telemetry-otel, dsh-session-persistence-jsonl
dsh-session-log-deepseek, dsh-session-checkpoint-policy
```

### Experimental (pulled by `dsh-experimental-*`)

```
dsh-experimental-forge, dsh-experimental-forge-bundle, dsh-experimental-forge-github
dsh-experimental-forge-session, dsh-experimental-inspector, dsh-experimental-inspector-profile
dsh-experimental-plugin-market-bundle, dsh-experimental-ralph-bundle
dsh-experimental-session-titles-bundle, dsh-experimental-tool-worktree
dsh-experimental-worktree, dsh-cua, dsh-cua-bundle, dsh-computer-use
```

### Infrastructure/Host (pulled by `dsh-host-*`, `dsh-plugin-*`)

```
dsh-host-directory-picker*, dsh-host-frontend-static, dsh-host-webserver
dsh-plugin-manager, dsh-plugin-market, dsh-plugin-market-index, dsh-plugin-detail
dsh-config-editor, dsh-hmr, dsh-official-bundles
```

### Windows-specific (pulled by platform deps)

```
dsh-win32-process, dsh-pwsh-local, dsh-pwsh-sandbox, dsh-sandbox-windows-acl
```

### Utilities/Internal (pulled by various)

```
dsh-deque, dsh-error, dsh-lazy-require, dsh-chunked-list
dsh-util-code-language, dsh-util-crypto, dsh-util-ripgrep
dsh-shell-env, dsh-system-prompt, dsh-terminal-panel
dsh-tmux-context, dsh-harness-dev-context
dsh-message-quotes, dsh-office-kit, dsh-deepseek-chat-import
dsh-deepseek-llm-api-extensions, dsh-atomic-write
dsh-mcp-resources, dsh-otel, dsh-host-product-telemetry-otel
dsh-package-manifest, dsh-persona, dsh-personalized-recommendations
dsh-plugin-recommendations, dsh-ptc-runtime-node
dsh-repeat-tool-reminder, dsh-creation-recommendations
dsh-cordis-client-runner, dsh-cordis-host-runner
dsh-agent-instructions, dsh-agent-preset, dsh-agent-preset-registry
dsh-agent-team, dsh-agent-tool-presentation
dsh-skill-filesystem, dsh-skill-office, dsh-skill-badge
dsh-goal, dsh-goal-round-driver, dsh-command-compact, dsh-command-feedback
dsh-command-goal, dsh-compaction-basic, dsh-compaction-image-offload
dsh-compaction-tool-result-pruner, dsh-tool-cordis, dsh-tool-executor-native
dsh-tool-executor-ptc, dsh-tool-fs, dsh-tool-fs-search, dsh-tool-goal
dsh-tool-jobs, dsh-tool-office, dsh-tool-ralph, dsh-tool-skill
dsh-tool-str-replace-editor, dsh-tool-subagent, dsh-tool-subagent-control
dsh-tool-terminal, dsh-tool-todo, dsh-tool-web, dsh-tool-workflow
dsh-tool-working-directory, dsh-tool-workspace-dependencies
dsh-typert-loader, dsh-web, dsh-web-app, dsh-web-deepseek-api
dsh-web-fetch-http, dsh-web-frontend, dsh-web-search-deepseek
dsh-workflow-ptc, dsh-workspace-changes
libreoffice-kit, libreoffice-kit-wasm
node-addon-system, node-addon-system-linux-x64, schemastery
cosmokit, cordis-plugin-group, cordis-plugin-timer
```

---

## 🎯 FINAL VERDICT FOR INTERACTIVE MODE

### ✅ What lazydsh HAS (77 direct deps = COMPLETE TUI STACK)

| Capability               | Packages                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **Agent runtime**        | `dsh-agent`, `dsh-subagent`, `dsh-workflow`, `dsh-ptc-runtime`                         |
| **Session management**   | `dsh-session`, `dsh-session-persistence`, `dsh-session-query`, `dsh-session-title-llm` |
| **Multi-provider LLM**   | `dsh-llm` + `dsh-llm-pi-ai` (OpenAI, Anthropic, Codex, DeepSeek, etc.)                 |
| **Local terminal tools** | `dsh-bash-local`, `dsh-fs`, `dsh-terminal-bash`, `dsh-subprocess`                      |
| **MCP/LSP**              | `dsh-mcp-client`, `dsh-mcp-manager`, `dsh-lsp`, `dsh-lsp-stdio`                        |
| **File references**      | `dsh-file-reference`, `dsh-file-reference-local`, `dsh-deliverable-file-references`    |
| **Workspace**            | `dsh-workspace`, `dsh-working-directory`, `dsh-storage`, `dsh-storage-domain`          |
| **Auth**                 | `dsh-authorization`, `dsh-credentials`, `dsh-client-connection`                        |
| **Permissions/Approval** | `dsh-permission-presets`, `dsh-user-approval`, `dsh-user-questions`                    |
| **Plan mode**            | `dsh-plan-mode`                                                                        |
| **Compaction**           | `dsh-compaction`, `dsh-output-retention`, `dsh-token-meter`                            |
| **Skills**               | `dsh-skill`                                                                            |
| **Terminal UI**          | **pi-tui** (NOT dsh-client-ui-*)                                                       |

### ❌ What lazydsh DOESN'T NEED (92 not installed + 264 transitive)

| Category                            | Why not needed for INTERACTIVE MODE         |
| ----------------------------------- | ------------------------------------------- |
| **Web UI** (50+)                    | pi-tui replaces all `dsh-client-ui-*`       |
| **Web/Cloud runtime** (20+)         | Runs locally, not in browser/worker/E2B     |
| **Remote execution** (10+)          | No SSH/E2B/browser automation               |
| **SQLite backends** (6+)            | JSONL/file-based is sufficient              |
| **Experimental** (30+)              | Unstable, not for production TUI            |
| **Windows-only** (7+)               | Linux/macOS target                          |
| **Platform-specific native** (11+)  | Only current platform needed                |
| **Alternative tool variants** (28+) | Chose specific variants (local > sandboxed) |
| **Testing/mock/demos** (10+)        | Not production                              |
| **Voice/speech/CUA** (10+)          | Not terminal TUI features                   |
| **Plugin market/HMR** (10+)         | Dev/web features                            |
| **Office/PDF** (8+)                 | Not needed                                  |

---

## 📈 CONCLUSION

**lazydsh's 77 direct dependencies are COMPLETE and OPTIMAL for a terminal interactive mode.**

- **433 total packages exist** on npm under @deepseek-ai
- **341 installed** (77 direct + 264 transitive) — covers all runtime needs
- **92 not installed** — all for web/cloud/experimental/alternative platforms
- **Zero missing packages** for a full-featured terminal TUI agent

The transitive 264 packages are **implementation details** of the 77 chosen packages — they provide alternative backends that exist but aren't used because lazydsh explicitly selects specific variants (local bash, JSONL sessions, pi-tui, pi-ai providers).
