# @deepseek-ai Packages: Complete Analysis for lazydsh

> Combined from `FULL_DEEPSEEK_AI_ANALYSIS.md` + `RUNTIME_PLUGIN_LOADING_ANALYSIS.md`

---

## 📊 Executive Summary

| Metric | Count | % |
|--------|-------|---|
| **Total on npm (@deepseek-ai/\*)** | 433 | 100% |
| **Installed in `node_modules/`** | 341 | 78.8% |
| **Direct dependencies (package.json)** | 77 | 17.8% |
| **Transitive dependencies** | 264 | 61.0% |
| **NOT installed (available)** | 92 | 21.2% |
| **Loaded at runtime (eager + deferred)** | ~110 | 32.3% of installed |
| **Never loaded (installed only)** | ~231 | 67.7% of installed |

**Verdict**: lazydsh's 77 direct deps are **complete and optimal** for a terminal TUI. Runtime loads only ~110 packages — the rest are alternative implementations, web UI, experimental, cloud, platform-specific, or testing code correctly excluded.

---

## ✅ 77 Direct Dependencies (package.json)

### Core Runtime (12)
`cordis`, `cordis-plugin-include`, `cordis-plugin-loader`, `dsh`, `dsh-app-boot`, `dsh-base`, `dsh-cmdline`, `dsh-commands`, `dsh-launch-environment`, `dsh-sdk-protocol`, `dsh-shell`, `dsh-home-paths`

### LLM & Providers (4)
`dsh-llm`, `dsh-llm-pi-ai`, `dsh-agent-default-model`, `dsh-anonymous-user-id`

### Session & Persistence (11)
`dsh-session`, `dsh-session-persistence`, `dsh-session-query`, `dsh-session-title`, `dsh-session-title-llm`, `dsh-session-log-export`, `dsh-session-telemetry`, `dsh-session-persistence-jsonl`, `dsh-session-projection`, `dsh-session-projection-cache`, `dsh-session-checkpoint-policy`

### Agent & Tools (12)
`dsh-agent`, `dsh-subagent`, `dsh-tool-ask-user`, `dsh-tool-lsp`, `dsh-tool-present`, `dsh-tool-schedule`, `dsh-tools`, `dsh-user-approval`, `dsh-user-questions`, `dsh-permission-presets`, `dsh-plan-mode`, `dsh-workflow`

### File System & Workspace (8)
`dsh-fs`, `dsh-workspace`, `dsh-working-directory`, `dsh-file-reference`, `dsh-file-reference-local`, `dsh-deliverable-file-references`, `dsh-storage`, `dsh-storage-domain`

### Terminal & Execution (6)
`dsh-bash-local`, `dsh-terminal`, `dsh-terminal-bash`, `dsh-subprocess`, `dsh-sandbox`, `dsh-schedule`

### MCP / LSP / Skills (6)
`dsh-mcp-client`, `dsh-mcp-manager`, `dsh-lsp`, `dsh-lsp-stdio`, `dsh-skill`, `dsh-ptc-runtime`

### Auth & Credentials (4)
`dsh-authorization`, `dsh-credentials`, `dsh-client-connection`, `dsh-client-file-upload`

### Compaction & Token (4)
`dsh-compaction`, `dsh-output-retention`, `dsh-token-meter`, `dsh-time-context`

### Utilities (5)
`dsh-util-time`, `dsh-util-values`, `dsh-util-workspace-path`, `dsh-brand`, `dsh-message-feedback`

### Telemetry / Protocol (3)
`dsh-typert-protocol`, `dsh-typert-registry`, `dsh-api-gateway`

### Native Commands (1)
`dsh-native-command`

---

## ❌ 92 NOT Installed (Available on npm)

| Category | Count | Reason Not Needed |
|----------|-------|-------------------|
| **Experimental — Agent Teams & Browser** | 18 | Browser/computer-use, WebWorker, not terminal |
| **Web / Client Runtime / SDK** | 13 | Web runtimes, worker threads, SDK clients |
| **Web UI Components** | 10 | React web UI — lazydsh uses pi-tui |
| **Auth / Account Variants** | 5 | DeepSeek-specific, Claude Code/Codex hooks |
| **Cloud / Remote Execution** | 9 | E2B, SSH, browser automation — runs locally |
| **SQLite / Alternative Storage** | 6 | JSONL/file-based is sufficient |
| **Subagent Variants** | 6 | ACP, Claude Code, Codex — uses core `dsh-subagent` |
| **Experimental — Other** | 7 | Voice, speech, LiveShare, terminal bundle |
| **Cordis / Infrastructure** | 3 | HMR, console logger, invariants — dev tools |
| **LLM Testing / Mock** | 3 | Mock server, replay, retry — not production |
| **Tool Variants** | 3 | Subagent report, testkit, typert generator |
| **Web Search Variants** | 4 | Webhooks, Exa, Perplexity — not used |
| **Office / Document** | 8 | LibreOffice platform binaries — WASM only if needed |
| **Native Addons — Platform Variants** | 11 | Only current platform (linux-x64) installed |
| **Agent Demos / Testkits** | 5 | Demos and testkits — not production |

---

## ⚡ Runtime Plugin Loading: Two-Phase Boot

### Phase 1: Eager Loading (~70 packages, < 500ms → first frame)

**Core Services (always enabled from `dsh-base`):**

| Service | Package | Notes |
|---------|---------|-------|
| `llm` | `dsh-llm` | Core LLM abstraction |
| `llm-pi-ai` | `dsh-llm-pi-ai` | **Critical**: pi-ai multi-provider |
| `session` | `dsh-session` | Session management |
| `session-persistence-jsonl` | `dsh-session-persistence-jsonl` | JSONL persistence |
| `agent` | `dsh-agent` | Main agent |
| `agent-default-model` | `dsh-agent-default-model` | Default model selection |
| `authorization` | `dsh-authorization` | Auth providers |
| `credentials` | `dsh-credentials-local` | Local credential store |
| `working-directory` | `dsh-working-directory` | CWD tracking |
| `storage` / `storage-json` / `storage-domain` | `dsh-storage*` | Storage layers |
| `session-projection` / `session-projection-cache` | `dsh-session-projection*` | Session projections |
| `subagent` / `subagent-spawn-in-process` / `subagent-fork-in-process` | `dsh-subagent*` | Subagent support |
| `commands` | `dsh-commands` | Command registry |
| `plan-mode` | `dsh-plan-mode` | Plan mode |
| `permission` | `dsh-permission-presets` | Permission presets |
| `approval` | `dsh-user-approval` | User approval |
| `user-questions` | `dsh-user-questions` | User questions |
| `token-meter` | `dsh-token-meter` | Token counting |
| `compaction-basic` | `dsh-compaction-basic` | Compaction |
| `sandbox` / `sandbox-policy` | `dsh-sandbox-local` / `dsh-sandbox-policy` | Sandbox |
| `subprocess` | `dsh-subprocess-local` | Local subprocess |
| `session-title` / `session-title-llm` | `dsh-session-title*` | Session titles |
| `attachment-local` | `dsh-attachment-local` | Attachments |
| `spill-local` / `spill-policy` | `dsh-spill*` | Spill management |
| `session-checkpoint-policy` | `dsh-session-checkpoint-policy` | Checkpoints |
| `tool-result-pruner` / `image-offload` | `dsh-compaction-*` | Compaction tools |
| `repeat-tool-reminder` | `dsh-repeat-tool-reminder` | Tool reminders |
| `agent-instructions` | `dsh-agent-instructions` | Agent instructions |
| `skill` / `skill-filesystem` | `dsh-skill*` | Skills |
| `system-prompt` | `dsh-system-prompt` | System prompt |
| `agent-loop` | `dsh-agent-loop` | Agent loop |
| `fs-sandbox` | `dsh-fs-sandbox` | FS sandbox |
| `llm-deepseek` / `llm-deepseek-account` | `dsh-llm-deepseek*` | DeepSeek provider |
| `deepseek-account` | `dsh-deepseek-account` | DeepSeek auth |
| `deepseek-llm-api-extensions` | `dsh-deepseek-llm-api-extensions` | API extensions |
| `typert` / `typert-loader` / `typert-gateway` | `dsh-typert*` / `dsh-api-gateway` | Typert protocol |
| `remote-access` | `dsh-api-remote-access` | Remote access |
| `session-log-deepseek` | `dsh-session-log-deepseek` | DeepSeek logging |
| `session-query-sqlite` | `dsh-session-query-sqlite` | **openAt: never** |
| `otel` / `session-telemetry-otel` | `dsh-otel*` | OpenTelemetry |
| `bash-sandbox` / `pwsh-sandbox` | `dsh-bash-sandbox` / `dsh-pwsh-sandbox` | Platform-specific |
| `shell-env` | `dsh-shell-env` | Shell environment |
| `tool-executor-native` | `dsh-tool-executor-native` | Native executor |
| `tool-executor-ptc` | `dsh-tool-executor-ptc` | **Disabled** |
| `timeout-policy` | `dsh-tool-call-timeout-policy` | Timeout policy |
| `command-compact` / `command-feedback` / `command-goal` | `dsh-command-*` | Commands |
| `goal` / `goal-round-driver` | `dsh-goal*` | Goal system |

**lazydsh Profile Patches (eager, from `plugin-patch.ts`):**
- `connection` → `dsh-client-connection`
- `file-upload` → `dsh-client-file-upload`
- `workspace` → `dsh-workspace`
- `schedule` → `dsh-schedule`
- `time-context` → `dsh-time-context`
- `tool-schedule` → `dsh-tool-schedule` (overrides deferred)
- `tool-ask-user` → `dsh-tool-ask-user` (overrides deferred)
- `present` → `dsh-tool-present` (overrides deferred)
- `file-reference-local` → `dsh-file-reference-local`
- `deliverable-file-references` → `dsh-deliverable-file-references`
- `lazydsh` → main launcher plugin

---

### Phase 2: Deferred Loading (~40 packages, after first paint)

Triggered by `activateDeferredPlugins()` from `deferred.ts`:

| Plugin ID | Package | Purpose |
|-----------|---------|---------|
| `tool-bash` | `dsh-tool-bash` | Sandboxed bash |
| `tool-pwsh` | `dsh-tool-pwsh` | PowerShell (win32) |
| `tool-jobs` | `dsh-tool-jobs` | Background jobs |
| `tool-fs` | `dsh-tool-fs` | Filesystem tools |
| `tool-fs-search` | `dsh-tool-fs-search` | File search |
| `tool-working-directory` | `dsh-tool-working-directory` | CWD tool |
| `tool-skill` | `dsh-tool-skill` | Skill invocation |
| `tool-web` | `dsh-tool-web` | Web search/fetch |
| `web` / `web-search-deepseek` / `web-deepseek-api` / `web-fetch-http` | `dsh-web*` | Web services |
| `tool-todo` | `dsh-tool-todo` | Todo tracking |
| `tool-goal` | `dsh-tool-goal` | Goal tool |
| `tool-subagent` / `tool-subagent-control` / `tool-subagent-fork` | `dsh-tool-subagent*` | Subagent tools |
| `tool-agent-team` | `dsh-tool-agent-team` | Agent teams |
| `tool-workflow` | `dsh-tool-workflow` | Workflow tool |
| `workflow-ptc` | `dsh-workflow-ptc` | PTC workflow |
| `ptc-runtime` | `dsh-ptc-runtime-node` | PTC runtime |
| `mcp-resources` | `dsh-mcp-resources` | MCP resources |
| `present` | `dsh-tool-present` | If not eager |
| `plugin-manager` / `tool-plugin-manager` | `dsh-plugin-manager*` | Plugin management |
| `otel` / `session-telemetry-otel` | `dsh-otel*` | Telemetry |
| `typert` / `typert-loader` / `typert-gateway` / `remote-access` | `dsh-typert*` / `dsh-api-*` | Typert/remote |

**Two modes:**
- `fullDefer = true` (fresh start): ALL enabled rows except `lazydsh` deferred
- `fullDefer = false` (resume): Only `DEFERRED_ENTRY_IDS` deferred

---

## 🚫 Never Loaded at Runtime (~231 packages installed but unused)

### Alternative Implementations (28)
Sandboxed vs local variants: `dsh-tool-bash-persistent`, `dsh-fs-local`, `dsh-fs-sandbox`, `dsh-fs-patch`, `dsh-fs-observation-policy`, `dsh-pwsh-local`, `dsh-subprocess-local`, `dsh-bash-sandbox`, `dsh-pwsh-sandbox`, `dsh-sandbox-local`, `dsh-sandbox-policy`, `dsh-sandbox-windows-acl`, `dsh-storage-json`, `dsh-spill-local`, `dsh-spill-policy`, `dsh-attachment-local`, `dsh-credentials-local`, `dsh-subagent-spawn-in-process`, `dsh-subagent-fork-in-process`

### Web UI Stack (40+)
All `dsh-client-ui-*`, `dsh-client-web`, `dsh-client-web-react`, `dsh-client-runtime`, `dsh-client-test-runtime`, `dsh-client-store`, `dsh-client-schema-form`

### Experimental (30+)
`dsh-experimental-*`, `dsh-cua`, `dsh-cua-bundle`, `dsh-computer-use`, `dsh-experimental-forge*`, `dsh-experimental-inspector*`, `dsh-experimental-plugin-market*`, `dsh-experimental-ralph-bundle`, `dsh-experimental-session-titles-bundle`, `dsh-experimental-tool-worktree`, `dsh-experimental-worktree`

### Cloud/Remote (10+)
`dsh-e2b`, `dsh-fs-e2b`, `dsh-fs-ssh`, `dsh-sandbox-ssh`, `dsh-ssh`, `dsh-subprocess-e2b`, `dsh-subprocess-ssh`, `dsh-host-apiproxy`, `dsh-browser-use`, `dsh-remote-mock`

### SQLite Variants (6)
`dsh-session-persistence-sqlite`, `dsh-session-query-sqlite` (loaded but `openAt: never`), `dsh-session-snapshot`, `dsh-settings-file`, `dsh-storage-sqlite`, `dsh-client-schema-form`

### Subagent Variants (6)
`dsh-subagent-acp`, `dsh-subagent-claude-code`, `dsh-subagent-codex`, `dsh-subagent-dsh-sdk`, `dsh-subagent-in-process-driver`, `dsh-subagent-fork-in-process`

### Platform-Specific Native (11)
`node-addon-landlock-run-linux-arm64`, `node-addon-system-linux-arm64`, `node-addon-system-darwin-*`, `node-addon-system-win32-*`, `libreoffice-kit-darwin-*`, `libreoffice-kit-win32-*`, `libreoffice-kit-wasm` (loaded)

### Windows-Only (7)
`dsh-win32-process`, `dsh-pwsh-local`, `dsh-pwsh-sandbox`, `dsh-tool-pwsh`, `dsh-tool-pwsh-persistent`, `dsh-sandbox-windows-acl`

### Testing/Mock/Demos (10)
`dsh-llm-mock-server`, `dsh-llm-replay`, `dsh-llm-retry`, `dsh-loader-smoke`, `dsh-tool-testkit`, `dsh-tool-subagent-report`, `dsh-agent-loop-testkit`, `dsh-agent-presets`, `dsh-agent-spine-demo`, `dsh-acp-demo`

### Infrastructure (10+)
`dsh-host-webserver`, `dsh-host-frontend-static`, `dsh-host-directory-picker*`, `dsh-host-plugin-inventory`, `dsh-host-product-telemetry-otel`, `dsh-host-open-in-app`, `dsh-plugin-manager` (deferred), `dsh-plugin-market*`, `dsh-config-editor`, `dsh-hmr`, `dsh-official-bundles`

### Utilities/Internal (15+)
`dsh-deque`, `dsh-error`, `dsh-lazy-require`, `dsh-chunked-list`, `dsh-util-code-language`, `dsh-util-crypto`, `dsh-util-ripgrep`, `dsh-terminal-panel`, `dsh-tmux-context`, `dsh-harness-dev-context`, `dsh-message-quotes`, `dsh-office-kit`, `dsh-deepseek-chat-import`, `dsh-atomic-write`, `dsh-package-manifest`, `dsh-persona`, `dsh-personalized-recommendations`, `dsh-plugin-recommendations`, `dsh-skill-office`, `dsh-skill-badge`, `dsh-tool-cordis`, `dsh-tool-office`, `dsh-tool-ralph`, `dsh-tool-str-replace-editor`, `dsh-tool-terminal`, `dsh-tool-workspace-dependencies`, `dsh-web-app`, `dsh-web-frontend`, `dsh-webhook*`, `dsh-web-search-exa`, `dsh-web-search-perplexity`, `dsh-workspace-changes`, `cordis-plugin-group`, `cordis-plugin-timer`, `cordis-plugin-hmr`, `cordis-plugin-logger-console`, `cosmokit`, `schemastery`, `node-addon-system`

---

## 🎯 Runtime Capability Matrix (What Actually Works)

| Capability | Eager Packages | Deferred Packages |
|------------|----------------|-------------------|
| **Core Agent** | `agent`, `agent-loop`, `agent-default-model`, `subagent`, `subagent-spawn/fork` | — |
| **Session** | `session`, `session-persistence-jsonl`, `session-title`, `session-title-llm`, `session-projection`, `session-query-sqlite` | — |
| **LLM** | `llm`, `llm-pi-ai`, `llm-deepseek`, `llm-deepseek-account`, `llm-retry` | — |
| **Tools (Eager)** | `tool-schedule`, `tool-ask-user`, `tool-present`, `tool-executor-native` | — |
| **Tools (Deferred)** | — | `tool-bash`, `tool-fs`, `tool-fs-search`, `tool-web`, `tool-subagent`, `tool-workflow`, `tool-todo`, `tool-goal`, `tool-skill`, `tool-agent-team`, `tool-jobs`, `tool-working-directory`, `present` |
| **MCP/LSP** | `skill`, `skill-filesystem` | `mcp-resources` |
| **Workspace** | `workspace`, `working-directory`, `storage*`, `file-reference-local`, `deliverable-file-references` | — |
| **Auth** | `authorization`, `credentials`, `deepseek-account`, `connection`, `file-upload` | — |
| **Permissions** | `permission`, `approval`, `user-questions`, `sandbox`, `sandbox-policy` | — |
| **Compaction** | `compaction-basic`, `token-meter`, `spill*`, `tool-result-pruner`, `image-offload`, `session-checkpoint-policy` | — |
| **Terminal** | `subprocess`, `bash-sandbox`, `pwsh-sandbox`, `shell-env` | — |
| **System** | `commands`, `plan-mode`, `system-prompt`, `agent-instructions`, `repeat-tool-reminder`, `timeout-policy`, `goal`, `goal-round-driver` | `tool-workflow`, `workflow-ptc`, `ptc-runtime` |

---

## 📈 Final Statistics

| Category | Count | % of 341 Installed |
|----------|-------|-------------------|
| **Eager Loaded** | ~70 | 20.5% |
| **Deferred Loaded** | ~40 | 11.7% |
| **Total Loaded at Runtime** | **~110** | **32.3%** |
| **Never Loaded (Installed Only)** | **~231** | **67.7%** |

---

## ✅ Conclusion

**lazydsh is optimally configured:**

1. **77 direct deps = complete TUI stack** — covers agent, session, LLM, tools, workspace, auth, permissions, compaction, terminal, skills, MCP/LSP
2. **~110 packages load at runtime** — eager for fast first paint (<500ms), deferred for heavy tools
3. **231 packages correctly never load** — they are alternative implementations, web UI, experimental, cloud, platform-specific, or testing code with no place in a terminal TUI
4. **Zero missing packages** for a full-featured terminal interactive mode

The transitive 264 dependencies are implementation details of the 77 chosen packages — they provide alternative backends that exist but aren't activated because lazydsh explicitly selects specific variants (local bash, JSONL sessions, pi-tui, pi-ai providers).