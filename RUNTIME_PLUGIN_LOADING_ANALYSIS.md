# lazydsh Runtime Plugin Loading Analysis

## 📊 OVERVIEW

| Stage | Packages Loaded | Mechanism |
|-------|----------------|-----------|
| **Eager (Initial Boot)** | ~70 | Cordis profile composition |
| **Deferred (After First Paint)** | ~50 | Manual `activateDeferredPlugins()` |
| **Never Loaded (Installed Only)** | ~221 | Transitive dependencies, alternatives |

**Total Installed**: 341 packages in `node_modules/@deepseek-ai/`
**Actually Loaded at Runtime**: ~120 packages

---

## ✅ EAGER LOADING (Initial Boot - Before First Frame)

These are loaded during `runProfile()` → `boot()` → Cordis context creation.

### From `dsh-base/cordis.patch.yml` (Base Profile - ~130 rows, but many disabled)

**ALWAYS ENABLED (Core Services):**
```
1.  llm                    → @deepseek-ai/dsh-llm
2.  deepseek-llm-api-extensions → @deepseek-ai/dsh-deepseek-llm-api-extensions
3.  session                → @deepseek-ai/dsh-session
4.  session-log-deepseek   → @deepseek-ai/dsh-session-log-deepseek
5.  typert                 → @deepseek-ai/dsh-typert-registry
6.  typert-loader          → @deepseek-ai/dsh-typert-loader
7.  typert-gateway         → @deepseek-ai/dsh-api-gateway
8.  remote-access          → @deepseek-ai/dsh-api-remote-access
9.  session-title          → @deepseek-ai/dsh-session-title
10. session-title-llm      → @deepseek-ai/dsh-session-title-first-prompt-llm
11. user-questions         → @deepseek-ai/dsh-user-questions
12. agent                  → @deepseek-ai/dsh-agent
13. plugin-package-inventory-deepseek → @deepseek-ai/dsh-plugin-package-inventory-deepseek
14. agent-default-model    → @deepseek-ai/dsh-agent-default-model
15. jobs                   → @deepseek-ai/dsh-jobs-local
16. llm-retry              → @deepseek-ai/dsh-llm-retry
17. authorization          → @deepseek-ai/dsh-authorization
18. deepseek-account       → @deepseek-ai/dsh-deepseek-account
19. credentials            → @deepseek-ai/dsh-credentials-local
20. llm-pi-ai              → @deepseek-ai/dsh-llm-pi-ai     ← CRITICAL: pi-ai provider
21. session-persistence-jsonl → @deepseek-ai/dsh-session-persistence-jsonl
22. attachment-local       → @deepseek-ai/dsh-attachment-local
23. session-query-sqlite   → @deepseek-ai/dsh-session-query-sqlite (openAt: never)
24. working-directory      → @deepseek-ai/dsh-working-directory
25. tool-working-directory → @deepseek-ai/dsh-tool-working-directory
26. session-projection     → @deepseek-ai/dsh-session-projection
27. storage                → @deepseek-ai/dsh-storage
28. storage-json           → @deepseek-ai/dsh-storage-json
29. storage-domain         → @deepseek-ai/dsh-storage-domain
30. session-projection-cache → @deepseek-ai/dsh-session-projection-cache
31. otel                   → @deepseek-ai/dsh-otel
32. session-telemetry-otel → @deepseek-ai/dsh-session-telemetry-otel
33. subprocess             → @deepseek-ai/dsh-subprocess-local
34. sandbox                → @deepseek-ai/dsh-sandbox-local
35. sandbox-policy         → @deepseek-ai/dsh-sandbox-policy
36. bash-sandbox           → @deepseek-ai/dsh-bash-sandbox (disabled on win32)
37. pwsh-sandbox           → @deepseek-ai/dsh-pwsh-sandbox (disabled on non-win32)
38. approval               → @deepseek-ai/dsh-user-approval
39. permission             → @deepseek-ai/dsh-permission-presets
40. shell-env              → @deepseek-ai/dsh-shell-env
41. tool-bash              → @deepseek-ai/dsh-tool-bash (disabled on win32) ← DEFERRED by lazydsh
42. tool-pwsh              → @deepseek-ai/dsh-tool-pwsh (disabled on non-win32) ← DEFERRED
43. tool-jobs              → @deepseek-ai/dsh-tool-jobs ← DEFERRED
44. fs-observation-policy  → @deepseek-ai/dsh-fs-observation-policy (disabled: true)
45. tool-fs                → @deepseek-ai/dsh-tool-fs ← DEFERRED
46. tool-fs-search         → @deepseek-ai/dsh-tool-fs-search ← DEFERRED
47. agent-instructions     → @deepseek-ai/dsh-agent-instructions
48. skill                  → @deepseek-ai/dsh-skill
49. skill-filesystem       → @deepseek-ai/dsh-skill-filesystem
50. tool-skill             → @deepseek-ai/dsh-tool-skill ← DEFERRED
51. commands               → @deepseek-ai/dsh-commands
52. command-feedback       → @deepseek-ai/dsh-command-feedback
53. goal                   → @deepseek-ai/dsh-goal
54. goal-round-driver      → @deepseek-ai/dsh-goal-round-driver
55. command-goal           → @deepseek-ai/dsh-command-goal
56. plan-mode              → @deepseek-ai/dsh-plan-mode
57. token-meter            → @deepseek-ai/dsh-token-meter
58. compaction-basic       → @deepseek-ai/dsh-compaction-basic
59. command-compact        → @deepseek-ai/dsh-command-compact
60. subagent               → @deepseek-ai/dsh-subagent
61. agent-team             → @deepseek-ai/dsh-agent-team
62. tool-agent-team        → @deepseek-ai/dsh-tool-agent-team
63. subagent-spawn-in-process → @deepseek-ai/dsh-subagent-spawn-in-process
64. subagent-fork-in-process  → @deepseek-ai/dsh-subagent-fork-in-process
65. tool-subagent-control → @deepseek-ai/dsh-tool-subagent-control
66. tool-subagent         → @deepseek-ai/dsh-tool-subagent
67. tool-subagent-fork    → @deepseek-ai/dsh-tool-subagent (fork variant)
68. ptc-runtime           → @deepseek-ai/dsh-ptc-runtime-node
69. workflow-ptc          → @deepseek-ai/dsh-workflow-ptc
70. tool-workflow         → @deepseek-ai/dsh-tool-workflow
71. timeout-policy        → @deepseek-ai/dsh-tool-call-timeout-policy
72. spill-local           → @deepseek-ai/dsh-spill-local
73. spill-policy          → @deepseek-ai/dsh-spill-policy
74. session-checkpoint-policy → @deepseek-ai/dsh-session-checkpoint-policy
75. tool-result-pruner    → @deepseek-ai/dsh-compaction-tool-result-pruner
76. image-offload         → @deepseek-ai/dsh-compaction-image-offload
77. tool-todo             → @deepseek-ai/dsh-tool-todo
78. tool-goal             → @deepseek-ai/dsh-tool-goal
79. repeat-tool-reminder  → @deepseek-ai/dsh-repeat-tool-reminder
80. web                   → @deepseek-ai/dsh-web
81. web-search-deepseek   → @deepseek-ai/dsh-web-search-deepseek
82. web-deepseek-api      → @deepseek-ai/dsh-web-deepseek-api
83. web-fetch-http        → @deepseek-ai/dsh-web-fetch-http
84. tool-web              → @deepseek-ai/dsh-tool-web ← DEFERRED
85. mcp-resources         → @deepseek-ai/dsh-mcp-resources
86. tools                 → @deepseek-ai/dsh-tools
87. tool-executor-native  → @deepseek-ai/dsh-tool-executor-native
88. tool-executor-ptc     → @deepseek-ai/dsh-tool-executor-ptc (disabled: true)
89. system-prompt         → @deepseek-ai/dsh-system-prompt
90. agent-loop            → @deepseek-ai/dsh-agent-loop
91. fs-sandbox            → @deepseek-ai/dsh-fs-sandbox
92. llm-deepseek          → @deepseek-ai/dsh-llm-deepseek-api-key
93. llm-deepseek-account  → @deepseek-ai/dsh-llm-deepseek-account
```

**DISABLED IN BASE (via `disabled: true` or `disabled: !!js ...`):**
```
- tool-plugin-manager      (disabled: true)
- plugin-manager           (disabled: !!js "!ctx.get('profileContext')")
- hmr                      (disabled: !!js "!ctx.get('profileContext')")
- config-editor            (disabled: !!js "!ctx.get('profileContext')")
- settings                 (disabled: !!js "!ctx.get('profileContext')")
- fs-observation-policy    (disabled: true)
- tool-executor-ptc        (disabled: true)
- session-title-llm        (disabled: true) ← overridden by lazydsh to use session-title-llm
```

---

## 🔧 LAZYDSH PROFILE PATCHES (plugin-patch.ts)

**Applied on top of base profile:**

```yaml
# profilePatch("lazydshApp") inserts:
- system-prompt: config updated with personaPrefix
- session-title-llm: disabled: true  (override base)
- hmr: disabled: true               (override base)
- tool-plugin-manager: disabled: false (enable plugin manager tools)

# INSERT new rows:
- connection:        @deepseek-ai/dsh-client-connection
- file-upload:       @deepseek-ai/dsh-client-file-upload
- workspace:         @deepseek-ai/dsh-workspace
- schedule:          @deepseek-ai/dsh-schedule (inject: [lazydshApp])
- time-context:      @deepseek-ai/dsh-time-context
- tool-schedule:     @deepseek-ai/dsh-tool-schedule
- tool-ask-user:     @deepseek-ai/dsh-tool-ask-user
- present:           @deepseek-ai/dsh-tool-present
- file-reference-local: @deepseek-ai/dsh-file-reference-local
- deliverable-file-references: @deepseek-ai/dsh-deliverable-file-references

# pluginPatch() also inserts:
- lazydsh: (the main launcher plugin)
```

---

## ⏭️ DEFERRED LOADING (After First Paint)

From `deferred.ts` - `DEFERRED_ENTRY_IDS` (50 entries):

```typescript
const DEFERRED_ENTRY_IDS = [
  // Plugin management
  "plugin-manager",
  "tool-plugin-manager",
  // Telemetry
  "otel",
  "session-telemetry-otel",
  // Remote API transport
  "typert",
  "typert-loader",
  "typert-gateway",
  "remote-access",
  // Agent tools
  "mcp-resources",
  "workflow-ptc",
  "ptc-runtime",
  "tool-workflow",
  "web",
  "web-search-deepseek",
  "web-deepseek-api",
  "web-fetch-http",
  "tool-web",
  "tool-bash",
  "tool-pwsh",
  "tool-jobs",
  "tool-fs",
  "tool-fs-search",
  "tool-working-directory",
  "tool-skill",
  "tool-schedule",
  "tool-ask-user",
  "tool-todo",
  "tool-goal",
  "tool-subagent",
  "tool-subagent-control",
  "tool-subagent-fork",
  "tool-agent-team",
  "present",
];
```

**Two modes:**
1. **`fullDefer = true`** (default for fresh start): ALL enabled rows except `lazydsh` are deferred
2. **`fullDefer = false`** (resume/pick session): Only `DEFERRED_ENTRY_IDS` are deferred

**After first paint**, `activateDeferredPlugins()` dynamically imports and mounts these.

---

## 📦 PACKAGE-TO-PLUGIN MAPPING (What Actually Loads)

### ✅ EAGER LOADED (~70 packages)

| Plugin ID | NPM Package | Loaded |
|-----------|-------------|--------|
| `llm` | `@deepseek-ai/dsh-llm` | ✅ |
| `llm-pi-ai` | `@deepseek-ai/dsh-llm-pi-ai` | ✅ |
| `session` | `@deepseek-ai/dsh-session` | ✅ |
| `session-persistence-jsonl` | `@deepseek-ai/dsh-session-persistence-jsonl` | ✅ |
| `agent` | `@deepseek-ai/dsh-agent` | ✅ |
| `agent-default-model` | `@deepseek-ai/dsh-agent-default-model` | ✅ |
| `authorization` | `@deepseek-ai/dsh-authorization` | ✅ |
| `credentials` | `@deepseek-ai/dsh-credentials-local` | ✅ |
| `working-directory` | `@deepseek-ai/dsh-working-directory` | ✅ |
| `storage` | `@deepseek-ai/dsh-storage` | ✅ |
| `storage-json` | `@deepseek-ai/dsh-storage-json` | ✅ |
| `storage-domain` | `@deepseek-ai/dsh-storage-domain` | ✅ |
| `session-projection` | `@deepseek-ai/dsh-session-projection` | ✅ |
| `session-projection-cache` | `@deepseek-ai/dsh-session-projection-cache` | ✅ |
| `subagent` | `@deepseek-ai/dsh-subagent` | ✅ |
| `subagent-spawn-in-process` | `@deepseek-ai/dsh-subagent-spawn-in-process` | ✅ |
| `subagent-fork-in-process` | `@deepseek-ai/dsh-subagent-fork-in-process` | ✅ |
| `commands` | `@deepseek-ai/dsh-commands` | ✅ |
| `plan-mode` | `@deepseek-ai/dsh-plan-mode` | ✅ |
| `permission` | `@deepseek-ai/dsh-permission-presets` | ✅ |
| `approval` | `@deepseek-ai/dsh-user-approval` | ✅ |
| `user-questions` | `@deepseek-ai/dsh-user-questions` | ✅ |
| `token-meter` | `@deepseek-ai/dsh-token-meter` | ✅ |
| `compaction-basic` | `@deepseek-ai/dsh-compaction-basic` | ✅ |
| `sandbox` | `@deepseek-ai/dsh-sandbox-local` | ✅ |
| `sandbox-policy` | `@deepseek-ai/dsh-sandbox-policy` | ✅ |
| `subprocess` | `@deepseek-ai/dsh-subprocess-local` | ✅ |
| `session-title` | `@deepseek-ai/dsh-session-title` | ✅ |
| `session-title-llm` | `@deepseek-ai/dsh-session-title-first-prompt-llm` | ✅ |
| `attachment-local` | `@deepseek-ai/dsh-attachment-local` | ✅ |
| `spill-local` | `@deepseek-ai/dsh-spill-local` | ✅ |
| `spill-policy` | `@deepseek-ai/dsh-spill-policy` | ✅ |
| `session-checkpoint-policy` | `@deepseek-ai/dsh-session-checkpoint-policy` | ✅ |
| `tool-result-pruner` | `@deepseek-ai/dsh-compaction-tool-result-pruner` | ✅ |
| `image-offload` | `@deepseek-ai/dsh-compaction-image-offload` | ✅ |
| `repeat-tool-reminder` | `@deepseek-ai/dsh-repeat-tool-reminder` | ✅ |
| `agent-instructions` | `@deepseek-ai/dsh-agent-instructions` | ✅ |
| `skill` | `@deepseek-ai/dsh-skill` | ✅ |
| `skill-filesystem` | `@deepseek-ai/dsh-skill-filesystem` | ✅ |
| `system-prompt` | `@deepseek-ai/dsh-system-prompt` | ✅ |
| `agent-loop` | `@deepseek-ai/dsh-agent-loop` | ✅ |
| `fs-sandbox` | `@deepseek-ai/dsh-fs-sandbox` | ✅ |
| `llm-deepseek` | `@deepseek-ai/dsh-llm-deepseek-api-key` | ✅ |
| `llm-deepseek-account` | `@deepseek-ai/dsh-llm-deepseek-account` | ✅ |
| `deepseek-account` | `@deepseek-ai/dsh-deepseek-account` | ✅ |
| `deepseek-llm-api-extensions` | `@deepseek-ai/dsh-deepseek-llm-api-extensions` | ✅ |
| `typert` | `@deepseek-ai/dsh-typert-registry` | ✅ |
| `typert-loader` | `@deepseek-ai/dsh-typert-loader` | ✅ |
| `typert-gateway` | `@deepseek-ai/dsh-api-gateway` | ✅ |
| `remote-access` | `@deepseek-ai/dsh-api-remote-access` | ✅ |
| `session-log-deepseek` | `@deepseek-ai/dsh-session-log-deepseek` | ✅ |
| `session-query-sqlite` | `@deepseek-ai/dsh-session-query-sqlite` | ✅ (openAt: never) |
| `otel` | `@deepseek-ai/dsh-otel` | ✅ |
| `session-telemetry-otel` | `@deepseek-ai/dsh-session-telemetry-otel` | ✅ |
| `bash-sandbox` | `@deepseek-ai/dsh-bash-sandbox` | ✅ (platform) |
| `pwsh-sandbox` | `@deepseek-ai/dsh-pwsh-sandbox` | ✅ (platform) |
| `shell-env` | `@deepseek-ai/dsh-shell-env` | ✅ |
| `tool-bash` | `@deepseek-ai/dsh-tool-bash` | ⚠️ DEFERRED |
| `tool-pwsh` | `@deepseek-ai/dsh-tool-pwsh` | ⚠️ DEFERRED |
| `tool-jobs` | `@deepseek-ai/dsh-tool-jobs` | ⚠️ DEFERRED |
| `tool-fs` | `@deepseek-ai/dsh-tool-fs` | ⚠️ DEFERRED |
| `tool-fs-search` | `@deepseek-ai/dsh-tool-fs-search` | ⚠️ DEFERRED |
| `tool-skill` | `@deepseek-ai/dsh-tool-skill` | ⚠️ DEFERRED |
| `tool-web` | `@deepseek-ai/dsh-tool-web` | ⚠️ DEFERRED |
| `web` | `@deepseek-ai/dsh-web` | ⚠️ DEFERRED |
| `web-search-deepseek` | `@deepseek-ai/dsh-web-search-deepseek` | ⚠️ DEFERRED |
| `web-deepseek-api` | `@deepseek-ai/dsh-web-deepseek-api` | ⚠️ DEFERRED |
| `web-fetch-http` | `@deepseek-ai/dsh-web-fetch-http` | ⚠️ DEFERRED |
| `tool-working-directory` | `@deepseek-ai/dsh-tool-working-directory` | ⚠️ DEFERRED |
| `tool-schedule` | `@deepseek-ai/dsh-tool-schedule` | ⚠️ DEFERRED (but also inserted by lazydsh) |
| `tool-ask-user` | `@deepseek-ai/dsh-tool-ask-user` | ⚠️ DEFERRED (but also inserted by lazydsh) |
| `tool-todo` | `@deepseek-ai/dsh-tool-todo` | ⚠️ DEFERRED |
| `tool-goal` | `@deepseek-ai/dsh-tool-goal` | ⚠️ DEFERRED |
| `tool-subagent` | `@deepseek-ai/dsh-tool-subagent` | ⚠️ DEFERRED |
| `tool-subagent-control` | `@deepseek-ai/dsh-tool-subagent-control` | ⚠️ DEFERRED |
| `tool-subagent-fork` | `@deepseek-ai/dsh-tool-subagent` | ⚠️ DEFERRED |
| `tool-agent-team` | `@deepseek-ai/dsh-tool-agent-team` | ⚠️ DEFERRED |
| `present` | `@deepseek-ai/dsh-tool-present` | ⚠️ DEFERRED (but also inserted by lazydsh) |
| `tool-workflow` | `@deepseek-ai/dsh-tool-workflow` | ⚠️ DEFERRED |
| `workflow-ptc` | `@deepseek-ai/dsh-workflow-ptc` | ⚠️ DEFERRED |
| `ptc-runtime` | `@deepseek-ai/dsh-ptc-runtime-node` | ⚠️ DEFERRED |
| `mcp-resources` | `@deepseek-ai/dsh-mcp-resources` | ⚠️ DEFERRED |
| `tool-executor-native` | `@deepseek-ai/dsh-tool-executor-native` | ✅ |
| `tool-executor-ptc` | `@deepseek-ai/dsh-tool-executor-ptc` | ✅ (disabled) |
| `timeout-policy` | `@deepseek-ai/dsh-tool-call-timeout-policy` | ✅ |
| `command-compact` | `@deepseek-ai/dsh-command-compact` | ✅ |
| `command-feedback` | `@deepseek-ai/dsh-command-feedback` | ✅ |
| `command-goal` | `@deepseek-ai/dsh-command-goal` | ✅ |
| `goal` | `@deepseek-ai/dsh-goal` | ✅ |
| `goal-round-driver` | `@deepseek-ai/dsh-goal-round-driver` | ✅ |
| `tool-skill` | `@deepseek-ai/dsh-tool-skill` | ⚠️ DEFERRED |
| `tool-plugin-manager` | `@deepseek-ai/dsh-plugin-manager/tools` | ✅ (enabled by lazydsh) |
| `plugin-manager` | `@deepseek-ai/dsh-plugin-manager` | ⚠️ DEFERRED |
| `hmr` | `@deepseek-ai/dsh-hmr` | ✅ (disabled by lazydsh) |
| `config-editor` | `@deepseek-ai/dsh-config-editor` | ✅ (disabled) |
| `settings` | `@deepseek-ai/dsh-settings` | ✅ (disabled) |

**LAZYDSH INSERTED (EAGER):**
```
connection              → @deepseek-ai/dsh-client-connection       ✅
file-upload             → @deepseek-ai/dsh-client-file-upload      ✅
workspace               → @deepseek-ai/dsh-workspace               ✅
schedule                → @deepseek-ai/dsh-schedule                ✅
time-context            → @deepseek-ai/dsh-time-context            ✅
tool-schedule           → @deepseek-ai/dsh-tool-schedule           ✅ (overrides deferred)
tool-ask-user           → @deepseek-ai/dsh-tool-ask-user           ✅ (overrides deferred)
present                 → @deepseek-ai/dsh-tool-present            ✅ (overrides deferred)
file-reference-local    → @deepseek-ai/dsh-file-reference-local    ✅
deliverable-file-refs   → @deepseek-ai/dsh-deliverable-file-references ✅
```

### ⏭️ DEFERRED LOADED (~40 packages after first paint)

These are dynamically imported via `activateDeferredPlugins()`:

| Plugin ID | NPM Package | Notes |
|-----------|-------------|-------|
| `tool-bash` | `@deepseek-ai/dsh-tool-bash` | Sandboxed bash |
| `tool-pwsh` | `@deepseek-ai/dsh-tool-pwsh` | PowerShell (win32 only) |
| `tool-jobs` | `@deepseek-ai/dsh-tool-jobs` | Background jobs |
| `tool-fs` | `@deepseek-ai/dsh-tool-fs` | Filesystem tools |
| `tool-fs-search` | `@deepseek-ai/dsh-tool-fs-search` | File search |
| `tool-working-directory` | `@deepseek-ai/dsh-tool-working-directory` | CWD tool |
| `tool-skill` | `@deepseek-ai/dsh-tool-skill` | Skill invocation |
| `tool-web` | `@deepseek-ai/dsh-tool-web` | Web search/fetch |
| `web` | `@deepseek-ai/dsh-web` | Web service |
| `web-search-deepseek` | `@deepseek-ai/dsh-web-search-deepseek` | DeepSeek search |
| `web-deepseek-api` | `@deepseek-ai/dsh-web-deepseek-api` | |
| `web-fetch-http` | `@deepseek-ai/dsh-web-fetch-http` | |
| `tool-todo` | `@deepseek-ai/dsh-tool-todo` | Todo tracking |
| `tool-goal` | `@deepseek-ai/dsh-tool-goal` | Goal tool |
| `tool-subagent` | `@deepseek-ai/dsh-tool-subagent` | Subagent tool (spawn) |
| `tool-subagent-control` | `@deepseek-ai/dsh-tool-subagent-control` | Control |
| `tool-subagent-fork` | `@deepseek-ai/dsh-tool-subagent` | Fork variant |
| `tool-agent-team` | `@deepseek-ai/dsh-tool-agent-team` | Agent teams |
| `tool-workflow` | `@deepseek-ai/dsh-tool-workflow` | Workflow tool |
| `workflow-ptc` | `@deepseek-ai/dsh-workflow-ptc` | PTC workflow |
| `ptc-runtime` | `@deepseek-ai/dsh-ptc-runtime-node` | PTC runtime |
| `mcp-resources` | `@deepseek-ai/dsh-mcp-resources` | MCP resources |
| `present` | `@deepseek-ai/dsh-tool-present` | Presentation (if not eager) |
| `plugin-manager` | `@deepseek-ai/dsh-plugin-manager` | Plugin manager |
| `tool-plugin-manager` | `@deepseek-ai/dsh-plugin-manager/tools` | Plugin manager tools |
| `otel` | `@deepseek-ai/dsh-otel` | OpenTelemetry |
| `session-telemetry-otel` | `@deepseek-ai/dsh-session-telemetry-otel` | OTel telemetry |
| `typert` | `@deepseek-ai/dsh-typert-registry` | Typert registry |
| `typert-loader` | `@deepseek-ai/dsh-typert-loader` | |
| `typert-gateway` | `@deepseek-ai/dsh-api-gateway` | |
| `remote-access` | `@deepseek-ai/dsh-api-remote-access` | |

**Note**: Some like `tool-schedule`, `tool-ask-user`, `present` are **also inserted eagerly** by lazydsh, so they load twice (eager wins, deferred skipped).

---

## 🚫 NEVER LOADED (Installed but Not Used at Runtime)

### Alternative Implementations (28 packages)
```
@deepseek-ai/dsh-tool-bash-persistent
@deepseek-ai/dsh-tool-pwsh-persistent
@deepseek-ai/dsh-pwsh-local
@deepseek-ai/dsh-fs-local
@deepseek-ai/dsh-fs-sandbox
@deepseek-ai/dsh-fs-patch
@deepseek-ai/dsh-fs-observation-policy
@deepseek-ai/dsh-storage-json (loaded via storage-json row)
@deepseek-ai/dsh-spill-local (loaded via spill-local row)
@deepseek-ai/dsh-spill-policy (loaded via spill-policy row)
@deepseek-ai/dsh-attachment-local (loaded via attachment-local row)
@deepseek-ai/dsh-credentials-local (loaded via credentials row)
@deepseek-ai/dsh-subprocess-local (loaded via subprocess row)
@deepseek-ai/dsh-subagent-spawn-in-process (loaded)
@deepseek-ai/dsh-subagent-fork-in-process (loaded)
@deepseek-ai/dsh-bash-sandbox (loaded via bash-sandbox row)
@deepseek-ai/dsh-pwsh-sandbox (loaded via pwsh-sandbox row)
@deepseek-ai/dsh-sandbox-local (loaded via sandbox row)
@deepseek-ai/dsh-sandbox-policy (loaded via sandbox-policy row)
@deepseek-ai/dsh-sandbox-windows-acl
```

### Web UI Stack (40+ packages)
```
@deepseek-ai/dsh-client-ui-* (all 40+ packages)
@deepseek-ai/dsh-client-web
@deepseek-ai/dsh-client-web-react
@deepseek-ai/dsh-client-runtime
@deepseek-ai/dsh-client-test-runtime
@deepseek-ai/dsh-client-store
@deepseek-ai/dsh-client-schema-form
```

### Experimental (30+ packages)
```
@deepseek-ai/dsh-experimental-*
@deepseek-ai/dsh-cua
@deepseek-ai/dsh-cua-bundle
@deepseek-ai/dsh-computer-use
```

### Cloud/Remote (10+ packages)
```
@deepseek-ai/dsh-e2b
@deepseek-ai/dsh-fs-e2b
@deepseek-ai/dsh-fs-ssh
@deepseek-ai/dsh-sandbox-ssh
@deepseek-ai/dsh-ssh
@deepseek-ai/dsh-subprocess-e2b
@deepseek-ai/dsh-subprocess-ssh
@deepseek-ai/dsh-host-apiproxy
@deepseek-ai/dsh-browser-use
@deepseek-ai/dsh-remote-mock
```

### SQLite Variants (6 packages)
```
@deepseek-ai/dsh-session-persistence-sqlite
@deepseek-ai/dsh-session-query-sqlite (loaded but openAt: never)
@deepseek-ai/dsh-session-snapshot
@deepseek-ai/dsh-settings-file
@deepseek-ai/dsh-storage-sqlite
```

### Subagent Variants (6 packages)
```
@deepseek-ai/dsh-subagent-acp
@deepseek-ai/dsh-subagent-claude-code
@deepseek-ai/dsh-subagent-codex
@deepseek-ai/dsh-subagent-dsh-sdk
@deepseek-ai/dsh-subagent-in-process-driver
```

### Platform-Specific Native (11 packages)
```
@deepseek-ai/node-addon-landlock-run-linux-arm64
@deepseek-ai/node-addon-landlock-run-linux-x64 (loaded)
@deepseek-ai/node-addon-system-linux-arm64
@deepseek-ai/node-addon-system-linux-x64 (loaded)
@deepseek-ai/node-addon-system-darwin-arm64
@deepseek-ai/node-addon-system-darwin-x64
@deepseek-ai/node-addon-system-win32-arm64
@deepseek-ai/node-addon-system-win32-x64
@deepseek-ai/libreoffice-kit-darwin-arm64
@deepseek-ai/libreoffice-kit-darwin-x64
@deepseek-ai/libreoffice-kit-win32-arm64
@deepseek-ai/libreoffice-kit-win32-x64
@deepseek-ai/libreoffice-kit-wasm (loaded)
```

### Windows-Only (7 packages)
```
@deepseek-ai/dsh-win32-process
@deepseek-ai/dsh-pwsh-local
@deepseek-ai/dsh-pwsh-sandbox
@deepseek-ai/dsh-tool-pwsh
@deepseek-ai/dsh-tool-pwsh-persistent
@deepseek-ai/dsh-sandbox-windows-acl
```

### Testing/Mock/Demos (10 packages)
```
@deepseek-ai/dsh-llm-mock-server
@deepseek-ai/dsh-llm-replay
@deepseek-ai/dsh-llm-retry
@deepseek-ai/dsh-loader-smoke
@deepseek-ai/dsh-tool-testkit
@deepseek-ai/dsh-tool-subagent-report
@deepseek-ai/dsh-agent-loop-testkit
@deepseek-ai/dsh-agent-presets
@deepseek-ai/dsh-agent-spine-demo
@deepseek-ai/dsh-acp-demo
```

### Infrastructure (10 packages)
```
@deepseek-ai/dsh-host-webserver
@deepseek-ai/dsh-host-frontend-static
@deepseek-ai/dsh-host-directory-picker*
@deepseek-ai/dsh-host-plugin-inventory
@deepseek-ai/dsh-host-product-telemetry-otel
@deepseek-ai/dsh-host-open-in-app
@deepseek-ai/dsh-plugin-manager (loaded deferred)
@deepseek-ai/dsh-plugin-market
@deepseek-ai/dsh-plugin-market-index
@deepseek-ai/dsh-config-editor
@deepseek-ai/dsh-hmr
@deepseek-ai/dsh-official-bundles
```

### Utilities/Internal (15 packages)
```
@deepseek-ai/dsh-deque
@deepseek-ai/dsh-error
@deepseek-ai/dsh-lazy-require
@deepseek-ai/dsh-chunked-list
@deepseek-ai/dsh-util-code-language
@deepseek-ai/dsh-util-crypto
@deepseek-ai/dsh-util-ripgrep
@deepseek-ai/dsh-shell-env (loaded via shell-env row)
@deepseek-ai/dsh-system-prompt (loaded via system-prompt row)
@deepseek-ai/dsh-terminal-panel
@deepseek-ai/dsh-tmux-context
@deepseek-ai/dsh-harness-dev-context
@deepseek-ai/dsh-message-quotes
@deepseek-ai/dsh-office-kit
@deepseek-ai/dsh-deepseek-chat-import
@deepseek-ai/dsh-deepseek-llm-api-extensions (loaded)
@deepseek-ai/dsh-atomic-write
@deepseek-ai/dsh-mcp-resources (deferred)
@deepseek-ai/dsh-otel (loaded)
@deepseek-ai/dsh-package-manifest
@deepseek-ai/dsh-persona
@deepseek-ai/dsh-personalized-recommendations
@deepseek-ai/dsh-plugin-recommendations
@deepseek-ai/dsh-ptc-runtime-node (deferred)
@deepseek-ai/dsh-repeat-tool-reminder (loaded)
@deepseek-ai/dsh-creation-recommendations
@deepseek-ai/dsh-cordis-client-runner
@deepseek-ai/dsh-cordis-host-runner
@deepseek-ai/dsh-agent-instructions (loaded)
@deepseek-ai/dsh-agent-preset
@deepseek-ai/dsh-agent-preset-registry
@deepseek-ai/dsh-agent-team (loaded)
@deepseek-ai/dsh-agent-tool-presentation
@deepseek-ai/dsh-skill-filesystem (loaded)
@deepseek-ai/dsh-skill-office
@deepseek-ai/dsh-skill-badge
@deepseek-ai/dsh-goal (loaded)
@deepseek-ai/dsh-goal-round-driver (loaded)
@deepseek-ai/dsh-command-compact (loaded)
@deepseek-ai/dsh-command-feedback (loaded)
@deepseek-ai/dsh-command-goal (loaded)
@deepseek-ai/dsh-compaction-basic (loaded)
@deepseek-ai/dsh-compaction-image-offload (loaded)
@deepseek-ai/dsh-compaction-tool-result-pruner (loaded)
@deepseek-ai/dsh-tool-cordis
@deepseek-ai/dsh-tool-executor-native (loaded)
@deepseek-ai/dsh-tool-executor-ptc (loaded, disabled)
@deepseek-ai/dsh-tool-fs (deferred)
@deepseek-ai/dsh-tool-fs-search (deferred)
@deepseek-ai/dsh-tool-goal (deferred)
@deepseek-ai/dsh-tool-jobs (deferred)
@deepseek-ai/dsh-tool-office
@deepseek-ai/dsh-tool-ralph
@deepseek-ai/dsh-tool-skill (deferred)
@deepseek-ai/dsh-tool-str-replace-editor
@deepseek-ai/dsh-tool-subagent (deferred)
@deepseek-ai/dsh-tool-subagent-control (deferred)
@deepseek-ai/dsh-tool-terminal
@deepseek-ai/dsh-tool-todo (deferred)
@deepseek-ai/dsh-tool-web (deferred)
@deepseek-ai/dsh-tool-workflow (deferred)
@deepseek-ai/dsh-tool-working-directory (deferred)
@deepseek-ai/dsh-tool-workspace-dependencies
@deepseek-ai/dsh-typert-loader (loaded)
@deepseek-ai/dsh-web (deferred)
@deepseek-ai/dsh-web-app
@deepseek-ai/dsh-web-deepseek-api (deferred)
@deepseek-ai/dsh-web-fetch-http (deferred)
@deepseek-ai/dsh-web-frontend
@deepseek-ai/dsh-webhook
@deepseek-ai/dsh-webhook-github
@deepseek-ai/dsh-web-search-deepseek (deferred)
@deepseek-ai/dsh-web-search-exa
@deepseek-ai/dsh-web-search-perplexity
@deepseek-ai/dsh-workflow-ptc (deferred)
@deepseek-ai/dsh-workspace-changes
@deepseek-ai/cordis-plugin-group
@deepseek-ai/cordis-plugin-timer (loaded as transitive)
@deepseek-ai/cordis-plugin-hmr
@deepseek-ai/cordis-plugin-logger-console
@deepseek-ai/cosmokit
@deepseek-ai/schemastery
@deepseek-ai/node-addon-system (loaded)
```

---

## 📈 FINAL STATISTICS

| Category | Count | % of 341 Installed |
|----------|-------|-------------------|
| **Eager Loaded** | ~70 | 20.5% |
| **Deferred Loaded** | ~40 | 11.7% |
| **Loaded (Eager + Deferred)** | **~110** | **32.3%** |
| **Never Loaded (Installed Only)** | **~231** | **67.7%** |

### Why So Many Never Loaded?

1. **Alternative implementations** - Base profile includes sandboxed AND local variants; lazydsh picks one
2. **Web UI stack** - 40+ packages for web React UI; lazydsh uses pi-tui
3. **Experimental features** - CUA, browser-use, agent teams, voice, etc.
4. **Cloud/Remote** - E2B, SSH, browser automation
5. **Platform-specific** - Windows, macOS, Linux ARM64/x64 native addons
6. **SQLite variants** - Alternative persistence backends
7. **Subagent variants** - ACP, Claude Code, Codex integrations
8. **Testing/Demos** - Mock servers, testkits, demo apps
9. **Infrastructure** - Web server, plugin market, HMR, config editor
10. **Transitive deps** - Dependencies of dependencies not directly referenced

---

## ✅ CONCLUSION FOR INTERACTIVE MODE

**lazydsh loads ~110 packages at runtime** (70 eager + 40 deferred), which provides:

| Capability | Packages |
|------------|----------|
| **Core Agent** | agent, agent-loop, agent-default-model, subagent, subagent-spawn/fork |
| **Session** | session, session-persistence-jsonl, session-title, session-title-llm, session-projection, session-query-sqlite |
| **LLM** | llm, llm-pi-ai, llm-deepseek, llm-deepseek-account, llm-retry |
| **Tools (Eager)** | tool-schedule, tool-ask-user, tool-present, tool-executor-native |
| **Tools (Deferred)** | tool-bash, tool-fs, tool-fs-search, tool-web, tool-subagent, tool-workflow, tool-todo, tool-goal, tool-skill, tool-agent-team, tool-jobs, tool-working-directory, present |
| **MCP/LSP** | mcp-resources (deferred), skill, skill-filesystem |
| **Workspace** | workspace, working-directory, storage, storage-json, storage-domain, file-reference-local, deliverable-file-references |
| **Auth** | authorization, credentials, deepseek-account, connection, file-upload |
| **Permissions** | permission, approval, user-questions, sandbox, sandbox-policy |
| **Compaction** | compaction-basic, token-meter, spill, tool-result-pruner, image-offload, session-checkpoint-policy |
| **Terminal** | subprocess, bash-sandbox/pwsh-sandbox, shell-env |
| **System** | commands, plan-mode, system-prompt, agent-instructions, repeat-tool-reminder, timeout-policy, goal, goal-round-driver |

**The other 231 installed packages are correctly NOT loaded** - they're alternative implementations, web UI, experimental, cloud, platform-specific, or testing code that has no place in a terminal TUI.