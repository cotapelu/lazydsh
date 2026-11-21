# @deepseek-ai Packages: Complete Analysis for lazydsh

## Summary

| Category                                                                                | Count   |
| --------------------------------------------------------------------------------------- | ------- |
| **Direct dependencies** (in `package.json`)                                             | **77**  |
| **Transitive dependencies** (in `node_modules/@deepseek-ai/` but NOT in `package.json`) | **264** |
| **Total in `node_modules/@deepseek-ai/`**                                               | **341** |

---

## ✅ 77 DIRECT DEPENDENCIES (what lazydsh explicitly uses)

### Core Runtime (12)

| Package                  | Purpose                            |
| ------------------------ | ---------------------------------- |
| `cordis`                 | Plugin framework kernel            |
| `cordis-plugin-include`  | Profile composition                |
| `cordis-plugin-loader`   | Plugin loading                     |
| `dsh`                    | Meta-package (for version pinning) |
| `dsh-app-boot`           | Two-phase profile boot             |
| `dsh-base`               | Base profile                       |
| `dsh-cmdline`            | CLI command parsing                |
| `dsh-commands`           | Slash command registry             |
| `dsh-launch-environment` | Launch env snapshot                |
| `dsh-sdk-protocol`       | SDK protocol types                 |
| `dsh-shell`              | Shell integration                  |
| `dsh-home-paths`         | DSH home directory                 |

### LLM & Providers (4)

| Package                   | Purpose                       |
| ------------------------- | ----------------------------- |
| `dsh-llm`                 | **LLM abstraction interface** |
| `dsh-llm-pi-ai`           | **pi-ai provider adapter**    |
| `dsh-agent-default-model` | Default model selection       |
| `dsh-anonymous-user-id`   | Anonymous user ID             |

### Session & Persistence (11)

| Package                         | Purpose                            |
| ------------------------------- | ---------------------------------- |
| `dsh-session`                   | Core session (JSONL event-sourced) |
| `dsh-session-persistence`       | Session persistence service        |
| `dsh-session-query`             | Session listing/query              |
| `dsh-session-title`             | Session titles                     |
| `dsh-session-title-llm`         | LLM-generated titles               |
| `dsh-session-log-export`        | Export session logs                |
| `dsh-session-telemetry`         | Session telemetry                  |
| `dsh-session-persistence-jsonl` | JSONL persistence (transitive)     |
| `dsh-session-format-*`          | Format migrations (transitive)     |
| `dsh-session-projection`        | Projections (transitive)           |
| `dsh-session-stats`             | Stats (transitive)                 |

### Agent & Tools (12)

| Package                  | Purpose             |
| ------------------------ | ------------------- |
| `dsh-agent`              | Agent core          |
| `dsh-subagent`           | Subagent spawning   |
| `dsh-tool-ask-user`      | Ask user tool       |
| `dsh-tool-lsp`           | LSP tool            |
| `dsh-tool-present`       | Presentation tool   |
| `dsh-tool-schedule`      | Schedule tool       |
| `dsh-tools`              | Tool protocol types |
| `dsh-user-approval`      | Approval flow       |
| `dsh-user-questions`     | Questions flow      |
| `dsh-permission-presets` | Permission presets  |
| `dsh-plan-mode`          | Plan mode           |
| `dsh-workflow`           | Workflow engine     |

### File System & Workspace (8)

| Package                           | Purpose             |
| --------------------------------- | ------------------- |
| `dsh-fs`                          | File system service |
| `dsh-workspace`                   | Workspace registry  |
| `dsh-working-directory`           | CWD management      |
| `dsh-file-reference`              | @file references    |
| `dsh-file-reference-local`        | Local file refs     |
| `dsh-deliverable-file-references` | Deliverable refs    |
| `dsh-storage`                     | Key-value storage   |
| `dsh-storage-domain`              | Storage domains     |

### Terminal & Execution (6)

| Package             | Purpose                     |
| ------------------- | --------------------------- |
| `dsh-bash-local`    | **Local bash (no sandbox)** |
| `dsh-terminal`      | Terminal service            |
| `dsh-terminal-bash` | Bash terminal               |
| `dsh-subprocess`    | Subprocess management       |
| `dsh-sandbox`       | Sandbox policy              |
| `dsh-schedule`      | Scheduler                   |

### MCP / LSP / Skills (6)

| Package           | Purpose             |
| ----------------- | ------------------- |
| `dsh-mcp-client`  | MCP client          |
| `dsh-mcp-manager` | MCP server manager  |
| `dsh-lsp`         | LSP integration     |
| `dsh-lsp-stdio`   | LSP stdio transport |
| `dsh-skill`       | Skill system        |
| `dsh-ptc-runtime` | PTC runtime         |

### Auth & Credentials (4)

| Package                  | Purpose                   |
| ------------------------ | ------------------------- |
| `dsh-authorization`      | OAuth/authorization flows |
| `dsh-credentials`        | Credential management     |
| `dsh-client-connection`  | Client connection         |
| `dsh-client-file-upload` | File upload               |

### Compaction & Token (4)

| Package                | Purpose            |
| ---------------------- | ------------------ |
| `dsh-compaction`       | Context compaction |
| `dsh-output-retention` | Output retention   |
| `dsh-token-meter`      | Token counting     |
| `dsh-time-context`     | Time context       |

### Utilities (5)

| Package                   | Purpose              |
| ------------------------- | -------------------- |
| `dsh-util-time`           | Time utilities       |
| `dsh-util-values`         | Value utilities      |
| `dsh-util-workspace-path` | Workspace path utils |
| `dsh-brand`               | Brand assets         |
| `dsh-message-feedback`    | Message feedback     |

### Telemetry / Protocol (3)

| Package               | Purpose         |
| --------------------- | --------------- |
| `dsh-typert-protocol` | Typert protocol |
| `dsh-typert-registry` | Typert registry |
| `dsh-api-gateway`     | API gateway     |

### Native Commands (1)

| Package              | Purpose               |
| -------------------- | --------------------- |
| `dsh-native-command` | Built-in DSH commands |

---

## ❌ 264 TRANSITIVE DEPENDENCIES (NOT in package.json, pulled by deps)

### 🧪 Experimental & Bundles (31) — _Unstable, not for production TUI_

```
dsh-experimental-*
  - api-speech-to-text, auto-review, badge-skill-bundle
  - client-ui-cot-translation, client-ui-forge, client-ui-stats, client-ui-voice-input
  - cot-translation-bundle, forge, forge-bundle, forge-github, forge-session
  - inspector, inspector-profile, liveshare, liveshare-protocol
  - plugin-market-bundle, ralph-bundle, session-inspector, session-search
  - session-titles-bundle, speech-to-text, speech-to-text-sensevoice
  - terminal-bundle, tool-worktree, translator, voice-input-bundle, worktree
dsh-cua, dsh-cua-bundle, dsh-computer-use, dsh-experimental-worktree
```

**Why not used**: Experimental, unstable, for web/headless clients, not terminal TUI.

---

### 🌐 Web / Headless / SDK / ACP (28) — _Web UI, API server, SDK clients_

```
dsh-web, dsh-web-app, dsh-web-deepseek-api, dsh-web-fetch-http, dsh-web-frontend, dsh-web-search-deepseek
dsh-headless, dsh-sdk-app, dsh-sdk-minimal, dsh-sdk-jsonrpc-server
dsh-acp, dsh-acp-app
dsh-cordis-client-runner, dsh-cordis-host-runner
dsh-client-ui-* (20 packages: chat, conversation, sidebar, settings, layout, renderer, etc.)
```

**Why not used**: lazydsh uses **pi-tui** (React-like TUI), not web React UI. Headless/SDK/ACP are for different deployment modes.

---

### 🔧 Alternative Tool Implementations (28) — _lazydsh picks specific variants_

| Not Used                                             | lazydsh Uses Instead               | Reason                          |
| ---------------------------------------------------- | ---------------------------------- | ------------------------------- |
| `dsh-tool-bash`                                      | `dsh-bash-local`                   | Local bash, no sandbox overhead |
| `dsh-tool-bash-persistent`                           | `dsh-bash-local`                   | Persistent not needed           |
| `dsh-tool-pwsh` / `dsh-tool-pwsh-persistent`         | —                                  | Windows PowerShell only         |
| `dsh-pwsh-local` / `dsh-pwsh-sandbox`                | —                                  | Windows only                    |
| `dsh-tool-fs`                                        | `dsh-fs`                           | Core FS service                 |
| `dsh-tool-fs-search`                                 | —                                  | Separate search tool            |
| `dsh-tool-goal`                                      | —                                  | Goal tracking not used          |
| `dsh-tool-jobs`                                      | —                                  | Background jobs not used        |
| `dsh-tool-skill`                                     | —                                  | Skill invocation not used       |
| `dsh-tool-str-replace-editor`                        | —                                  | Str-replace editor not used     |
| `dsh-tool-subagent` / `dsh-tool-subagent-control`    | `dsh-subagent`                     | Core subagent                   |
| `dsh-tool-todo`                                      | —                                  | Todo tracking not used          |
| `dsh-tool-web`                                       | —                                  | Web search not used             |
| `dsh-tool-workflow`                                  | `dsh-workflow` / `dsh-ptc-runtime` | Core workflow                   |
| `dsh-tool-workspace-dependencies`                    | —                                  | Not needed                      |
| `dsh-tool-terminal`                                  | `dsh-terminal-bash`                | Terminal via bash               |
| `dsh-tool-agent-team`                                | —                                  | Agent teams not used            |
| `dsh-tool-call-timeout-policy`                       | —                                  | Policy not needed               |
| `dsh-tool-cordis`                                    | —                                  | Cordis introspection not used   |
| `dsh-tool-executor-native` / `dsh-tool-executor-ptc` | —                                  | Executor variants               |
| `dsh-tool-office`                                    | —                                  | Office tools not used           |
| `dsh-tool-ralph`                                     | —                                  | Ralph not used                  |
| `dsh-tool-session-query`                             | `dsh-session-query`                | Core query                      |
| `dsh-tool-working-directory`                         | `dsh-working-directory`            | Core CWD                        |

---

### 🪟 Windows-Specific (7) — _Windows only_

```
dsh-pwsh-local, dsh-pwsh-sandbox, dsh-tool-pwsh, dsh-tool-pwsh-persistent
dsh-win32-process, dsh-sandbox-windows-acl
```

**Why not used**: Linux/macOS only.

---

### 🧩 Skills / Compaction / Commands (15)

```
dsh-skill-filesystem, dsh-skill-office, dsh-skill-badge
dsh-compaction-basic, dsh-compaction-image-offload, dsh-compaction-tool-result-pruner
dsh-command-compact, dsh-command-feedback, dsh-command-goal
dsh-goal, dsh-goal-round-driver
dsh-persona, dsh-personalized-recommendations
dsh-creation-recommendations
dsh-repeat-tool-reminder
```

**Why not used**: Alternative implementations; lazydsh uses core compaction (`dsh-compaction`), no goal/persona system.

---

### 🏗️ Infrastructure / Host / Plugin Market (22)

```
dsh-host-* (7: directory-picker*, frontend-static, open-in-app, plugin-inventory, product-telemetry-otel, webserver)
dsh-plugin-manager, dsh-plugin-market, dsh-plugin-market-index, dsh-plugin-detail
dsh-plugin-package-inventory-deepseek, dsh-plugin-recommendations
dsh-config-editor, dsh-hmr
dsh-official-bundles
dsh-otel, dsh-host-product-telemetry-otel
dsh-package-manifest
```

**Why not used**: Host/webserver for web deployment; plugin market for web UI; HMR for dev; bundles not needed.

---

### 🔐 Auth Variants (5) — _lazydsh uses pi-ai auth_

```
dsh-llm-deepseek, dsh-llm-deepseek-account, dsh-llm-deepseek-api-key
dsh-llm-retry, dsh-deepseek-account
```

**Why not used**: DeepSeek-specific auth; lazydsh uses `dsh-llm-pi-ai` for multi-provider.

---

### 📦 Session Variants (12) — _lazydsh uses core services_

```
dsh-session-checkpoint-policy, dsh-session-format, dsh-session-format-catalog
dsh-session-format-v0-to-v1, dsh-session-format-v1-to-v2, dsh-session-format-v2-to-v3, dsh-session-format-v3-to-v4
dsh-session-log-deepseek, dsh-session-persistence-jsonl
dsh-session-projection, dsh-session-projection-cache, dsh-session-query-sqlite
dsh-session-reference, dsh-session-stats, dsh-session-turn-outline
dsh-session-telemetry-otel
```

**Why not used**: Internal format migrations, SQLite backend, OTel telemetry — core services suffice.

---

### 🗄️ Storage / FS Variants (10)

```
dsh-fs-local, dsh-fs-observation-policy, dsh-fs-patch, dsh-fs-sandbox
dsh-storage-json, dsh-spill-local, dsh-spill-policy
dsh-attachment-local
dsh-credentials-local
dsh-atomic-write
```

**Why not used**: Alternative backends; lazydsh uses main services (`dsh-fs`, `dsh-storage`, `dsh-spill`, `dsh-attachment`, `dsh-credentials`).

---

### ⚙️ Sandbox / Subprocess Variants (7)

```
dsh-bash-sandbox, dsh-sandbox-local, dsh-sandbox-policy
dsh-subprocess-local, dsh-subagent-fork-in-process, dsh-subagent-spawn-in-process
dsh-timeout
```

**Why not used**: Sandbox variants; lazydsh uses `dsh-bash-local` (no sandbox) and `dsh-subprocess`.

---

### 🔄 Workflow / PTC Variants (4)

```
dsh-workflow-ptc, dsh-ptc-runtime-node
dsh-tool-executor-native, dsh-tool-executor-ptc
```

**Why not used**: PTC variants; lazydsh uses `dsh-ptc-runtime`.

---

### 🛠️ Utilities / Internal (15)

```
dsh-deque, dsh-error, dsh-lazy-require, dsh-chunked-list
dsh-util-code-language, dsh-util-crypto, dsh-util-ripgrep
dsh-shell-env, dsh-system-prompt, dsh-terminal-panel
dsh-tmux-context, dsh-harness-dev-context
dsh-message-quotes, dsh-office-kit, dsh-deepseek-chat-import
dsh-deepseek-llm-api-extensions
```

**Why not used**: Internal utilities, not needed by TUI.

---

### 📚 Document / Office (3)

```
dsh-office-kit, libreoffice-kit, libreoffice-kit-wasm
```

**Why not used**: Office document processing; not needed.

---

### 🏷️ Misc (5)

```
dsh-action-cards, dsh-client-resources, dsh-client-shortcuts
dsh-client-hmr, dsh-client-locale, dsh-client-modules, dsh-client-product-analytics
dsh-settings, dsh-scope, dsh-typert-loader
node-addon-system, node-addon-system-linux-x64, schemastery, cosmokit
cordis-plugin-group, cordis-plugin-timer
```

**Why not used**: Cordis internals, client analytics, settings UI, schema system.

---

## 🎯 CONCLUSION: Nothing Missing

### lazydsh's 77 direct dependencies are **precisely curated** for a **terminal TUI**:

| ✅ Included                     | ❌ Excluded (by design)           |
| ------------------------------- | --------------------------------- |
| Core agent/session/runtime      | Web/headless/SDK/ACP clients      |
| Local bash (`dsh-bash-local`)   | Sandboxed bash/PowerShell         |
| pi-ai multi-provider LLM        | DeepSeek-only LLM                 |
| pi-tui (React-like TUI)         | Web React UI (`dsh-client-ui-*`)  |
| Core tools (bash, fs, lsp, mcp) | Alternative tool variants         |
| Session persistence/query       | SQLite/OTel/experimental variants |
| Terminal TUI components         | Plugin market, HMR, config editor |

### The 264 transitive packages are **implementation details** of the 77 chosen packages — they provide:

- Alternative backends (SQLite, sandboxed FS, PowerShell)
- Web/headless deployment stacks
- Experimental features
- Internal utilities

**Verdict**: lazydsh is **feature-complete** for its target (terminal TUI). Adding more would bloat the binary with unused web/Windows/experimental code.
