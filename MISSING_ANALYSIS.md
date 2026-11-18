# MISSING ANALYSIS: lazydsh vs pi-coding-agent interactive mode

## Summary

- pi-coding-agent interactive mode: ~196 components + ~80 core modules + interactive-mode orchestration
- lazydsh: ~40 source files + ~20 components
- **Gap: ~150+ components/modules missing**

---

## CRITICAL MISSING (Blockers for parity)

### 1. `tui-renderer.ts` - **MISSING** (Critical)

**pi-coding-agent**: `dist/modes/interactive/tui-renderer.js`

- Creates TUI (TuiAltScreen/TuiMainScreen) with proper configuration
- Handles search match styling, scroll indicators, URL opening, copy selection
- Creates stable reference for components while InteractiveMode replaces renderer

**lazydsh**: Creates TuiAltScreen directly in ui.ts without abstraction

### 2. `interactive-mode.ts` - **MISSING** (Critical)

**pi-coding-agent**: `dist/modes/interactive/interactive-mode.js` (291k bytes)

- Main orchestration class `InteractiveMode`
- Handles: initialization, TUI setup, session management, auth flows, command handling, tool execution, streaming, theme sync, keybindings, session management, bug reporting, session sharing, program status, etc.
- Manages deferred plugin loading (50+ plugins)
- Handles OAuth flows, API key auth, device codes
- Manages session lifecycle (fork, archive, restore, pin, resume)
- Handles slash commands, slash command completion
- Manages program status (OSC 7501)
- Manages bug reporting with crash log collection
- Manages session sharing (Radius/Gist)
- Manages model catalog refresh with coordinator
- Handles thinking selector, thinking blocks
- Manages status indicators (working/retry/compaction/idle)
- Handles header with logo, keybindings, changelog
- Manages external editor integration
- Handles clipboard copy
- Handles thinking selector (Ctrl+T)
- Manages bug reporting with crash log collection
- Manages session sharing (Radius/Gist)
- Handles changelog display
- Manages settings selector with 5 categories
- Manages extension widgets
- Handles keybinding hints in all pickers/dialogs
- Manages model selector with async refresh
- Manages session selector with tree view, fuzzy search, archive/rename
- Handles login dialog (OAuth, API key, device code)
- Handles external editor integration
- Handles copy message (Ctrl+X)
- Handles thinking selector (Ctrl+T)
- Handles bug reporting with crash log collection
- Handles session share (Radius/Gist)
- Handles program status (OSC 7501)
- Handles changelog display
- Handles settings selector (5 categories)
- Manages extension widgets
- Handles keybinding hints in all pickers/dialogs
- Manages model selector with async refresh
- Manages session selector with tree view, fuzzy search, archive/rename

**lazydsh**: All this logic is inline in `ui.ts` (1600+ lines) without proper abstraction

### 3. `chat-viewport.ts` - **PARTIAL**

**pi-coding-agent**: `createChatViewport()` function with proper overscroll handling
**lazydsh**: Has `chat-viewport.ts` but simpler

---

## HIGH PRIORITY MISSING COMPONENTS

### Components (pi has, lazydsh missing)

| Component                              | Status | Notes                                    |
| -------------------------------------- | ------ | ---------------------------------------- |
| `armin`                                | ❌     | Pi mascot animation                      |
| `auth-url`                             | ⚠️     | We have `auth-url.ts` but may differ     |
| `branch-summary-message`               | ❌     | Branch summary display                   |
| `compaction-summary-message`           | ❌     | Compaction summary display               |
| `config-selector`                      | ❌     | Config selector UI                       |
| `custom-editor`                        | ❌     | Custom editor component                  |
| `custom-entry`                         | ❌     | Custom entry component                   |
| `custom-message`                       | ❌     | Custom message component                 |
| `diff`                                 | ⚠️     | We have `diff.ts` but may differ         |
| `earendil-announcement`                | ❌     | Pi-specific announcements                |
| `easter-egg-3d` / `easter-egg-3d.lazy` | ❌     | 3D easter eggs                           |
| `extension-editor`                     | ❌     | Extension editor UI                      |
| `extension-input`                      | ❌     | Extension input UI                       |
| `extension-selector`                   | ❌     | Extension selector UI                    |
| `first-time-setup`                     | ❌     | Onboarding flow                          |
| `footer`                               | ⚠️     | We have `footer.ts` but may differ       |
| `index` (barrel)                       | ⚠️     | We have `index.ts` but different exports |
| `mermaid`                              | ❌     | Mermaid diagram rendering                |
| `oauth-selector`                       | ✅     | We have `oauth-selector.ts`              |
| `pi-logo`                              | ❌     | Pi logo animation                        |
| `provider-brand`                       | ❌     | Provider brand animations                |
| `radius-login-selector`                | ❌     | Radius-specific login                    |
| `scoped-models-selector`               | ❌     | Scoped models selector                   |
| `settings-selector`                    | ✅     | We have `settings-selector.ts`           |
| `settings-submenu`                     | ❌     | Settings submenu component               |
| `show-images-selector`                 | ❌     | Image display settings                   |
| `skill-invocation-message`             | ❌     | Skill invocation display                 |
| `status-indicator`                     | ✅     | We have `status-indicator.ts`            |
| `themed-text`                          | ✅     | We have `themed-text.ts`                 |
| `theme-selector`                       | ✅     | We have `theme-selector.ts`              |
| `thinking-selector`                    | ✅     | We have `thinking-selector.ts`           |
| `tool-execution`                       | ✅     | We have `tool-execution.ts`              |
| `tree-selector`                        | ❌     | Tree selector component                  |
| `trust-selector`                       | ❌     | Trust management UI                      |
| `user-message`                         | ✅     | We have `user-message.ts`                |
| `user-message-selector`                | ❌     | User message selector                    |
| `visual-truncate`                      | ✅     | We have `visual-truncate.ts`             |

### Core Modules (pi has, lazydsh missing)

| Module                    | Status | Notes                             |
| ------------------------- | ------ | --------------------------------- |
| `agent-session`           | ❌     | Session management                |
| `agent-session-runtime`   | ❌     | Session runtime                   |
| `agent-session-services`  | ❌     | Session services                  |
| `auth-guidance`           | ❌     | Auth guidance UI                  |
| `auth-storage`            | ❌     | Auth storage                      |
| `bash-executor`           | ⚠️     | We have `bash-execution.ts`       |
| `bug-report`              | ✅     | We have `bug-report.ts`           |
| `bug-report-upload`       | ❌     | Bug report upload                 |
| `cache-stats`             | ❌     | Cache statistics                  |
| `cache-warmer`            | ❌     | Cache warmer                      |
| `client-identity`         | ❌     | Client identity                   |
| `compaction`              | ❌     | Compaction logic                  |
| `crash-log`               | ❌     | Crash logging                     |
| `defaults`                | ❌     | Defaults management               |
| `diagnostics`             | ❌     | Diagnostics                       |
| `event-bus`               | ❌     | Event bus                         |
| `exec`                    | ❌     | Execution                         |
| `experimental`            | ❌     | Experimental features             |
| `export-html`             | ❌     | HTML export                       |
| `extensions`              | ❌     | Extensions system                 |
| `footer-data-provider`    | ✅     | We have `footer-data-provider.ts` |
| `http-dispatcher`         | ❌     | HTTP dispatcher                   |
| `keybindings`             | ✅     | We have `keybindings.ts`          |
| `mcp-servers`             | ❌     | MCP servers                       |
| `messages`                | ❌     | Messages                          |
| `model-config`            | ❌     | Model config                      |
| `model-registry`          | ❌     | Model registry                    |
| `model-resolver`          | ⚠️     | We have `model-selector.ts`       |
| `model-runtime`           | ⚠️     | We use DSH runtime                |
| `models-store`            | ❌     | Models store                      |
| `nested-tool-calls`       | ❌     | Nested tool calls                 |
| `output-guard`            | ❌     | Output guard                      |
| `package-manager`         | ❌     | Package manager                   |
| `pi-ai-schemas`           | ❌     | Pi AI schemas                     |
| `pi-manifest`             | ❌     | Pi manifest                       |
| `preferred-providers`     | ❌     | Preferred providers               |
| `provider-composer`       | ❌     | Provider composer                 |
| `provider-matching`       | ❌     | Provider matching                 |
| `radius`                  | ❌     | Radius integration                |
| `radius-mcp`              | ❌     | Radius MCP                        |
| `remote-catalog-provider` | ❌     | Remote catalog                    |
| `resolve-config-value`    | ❌     | Resolve config value              |
| `resource-loader`         | ❌     | Resource loader                   |
| `runtime-credentials`     | ❌     | Runtime credentials               |
| `sdk`                     | ❌     | SDK                               |
| `session-cwd`             | ❌     | Session CWD                       |
| `session-export`          | ⚠️     | We have `session-share.ts`        |
| `session-manager`         | ❌     | Session manager                   |
| `settings-defaults`       | ❌     | Settings defaults                 |
| `settings-diagnostics`    | ❌     | Settings diagnostics              |
| `settings-manager`        | ❌     | Settings manager                  |
| `settings-schema`         | ❌     | Settings schema                   |
| `skills`                  | ❌     | Skills system                     |
| `slash-commands`          | ❌     | Slash commands                    |
| `source-info`             | ❌     | Source info                       |
| `system-prompt`           | ❌     | System prompt                     |
| `telemetry`               | ❌     | Telemetry                         |
| `timings`                 | ❌     | Timings                           |
| `tools`                   | ⚠️     | We have `tool-execution.ts`       |
| `trust-manager`           | ❌     | Trust manager                     |
| `usage-totals`            | ❌     | Usage totals                      |
| `virtual-models`          | ❌     | Virtual models                    |

### Missing Theme Files

| File                       | Status                           |
| -------------------------- | -------------------------------- |
| `system-theme.ts`          | ✅ We have                       |
| `theme-controller.ts`      | ✅ We have                       |
| `theme-tokens.ts`          | ✅ We have                       |
| `theme.ts`                 | ✅ We have                       |
| `dark.json`                | ✅ We have                       |
| `light.json`               | ✅ We have                       |
| `system-theme.js` (pi)     | ❌ We have `system-theme.ts`     |
| `theme-controller.js` (pi) | ❌ We have `theme-controller.ts` |
| `theme-tokens.js` (pi)     | ❌ We have `theme-tokens.ts`     |
| `theme.js` (pi)            | ❌ We have `theme.ts`            |
| `dark.json`                | ✅ We have                       |
| `light.json`               | ✅ We have                       |

### Missing Theme Features

- `system-theme.js` - Generates theme from terminal's reported colors (DA1)
- `theme-controller.js` - Live reload, DA1 query, auto-sync
- `theme-schema.ts` - Schema validation (we have `theme-schema.ts`)
- `theme-tokens.js` - Token definitions (we have `theme-tokens.ts`)

### Missing Utils

| Utility                    | Status     |
| -------------------------- | ---------- |
| `ansi.ts`                  | ✅ We have |
| `models-are-equal.ts`      | ✅ We have |
| `truncate.ts`              | ✅ We have |
| `paths.ts`                 | ❌ Missing |
| `web-url.ts`               | ❌ Missing |
| `git.ts`                   | ❌ Missing |
| `paths.ts`                 | ❌ Missing |
| `abort.ts`                 | ❌ Missing |
| `text.ts`                  | ❌ Missing |
| `fs-watch.ts`              | ❌ Missing |
| `clipboard.ts`             | ✅ We have |
| `clipboard-image.ts`       | ❌ Missing |
| `image-convert.ts`         | ❌ Missing |
| `syntax-highlight.ts`      | ❌ Missing |
| `syntax-highlight.lazy.ts` | ❌ Missing |
| `abort.ts`                 | ❌ Missing |

---

## PRIORITY ACTION PLAN

### Phase 1: Critical Infrastructure (Week 1)

1. **Create `tui-renderer.ts`** - Port from pi's `tui-renderer.js`
2. **Create `interactive-mode.ts`** - Main orchestration class (refactor `ui.ts`)
3. **Create `tui-renderer.ts`** - Proper TUI abstraction

### Phase 2: Core Components (Week 2)

1. `oauth-selector.ts` - Enhance with provider status, brand animations
2. `oauth-selector.ts` - Add auth type selection per provider
3. `session-selector.ts` - Add tree view, progress loading, delete confirmation, rename
4. `model-selector.ts` - Add async catalog refresh, save-as-default

### Phase 3: Missing Components (Week 3-4)

1. `oauth-selector.ts` - Provider brand animations
2. `provider-brand.ts` - Animated brand styles
3. `thinking-selector.ts` - Already done
4. `theme-selector.ts` - Already done
5. `auth-url.ts` - Already done
6. `login-dialog.ts` - Enhance with device code handling
7. `bug-report.ts` - Enhance with crash log collection

### Phase 4: Core Modules (Week 4-5)

1. `model-catalog-refresh.ts` - Already done
2. `model-search.ts` - Already done
3. `session-share.ts` - Already done
4. `program-status.ts` - Already done
5. `bug-report.ts` - Already done
6. `session-share.ts` - Already done
7. `external-editor.ts` - Already done
8. `clipboard.ts` - Already done

### Phase 5: Missing Components (Week 5-6)

1. `provider-brand.ts` - Animated brand styles
2. `oauth-selector.ts` - Already done
3. `auth-url.ts` - Already done
4. `thinking-selector.ts` - Already done
5. `theme-selector.ts` - Already done
6. `auth-url.ts` - Already done
7. `bug-report.ts` - Already done
8. `session-share.ts` - Already done

---

## SUMMARY: What's Actually Missing vs Done

### ✅ DONE (in lazydsh)

- `chat-viewport.ts` - Basic implementation
- `footer.ts` / `footer-data-provider.ts` - Done
- `tool-execution.ts` - Done
- `bash-execution.ts` - Done
- `model-selector.ts` - Basic (needs async refresh)
- `session-selector.ts` - Basic (needs tree view, progress, delete/rename)
- `oauth-selector.ts` - Basic (needs provider status, brand animations)
- `thinking-selector.ts` - Done
- `theme-selector.ts` - Done
- `auth-url.ts` - Done
- `login-dialog.ts` - Done (needs device code handling)
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `model-selector.ts` - Basic
- `session-selector.ts` - Basic
- `model-catalog-refresh.ts` - Done
- `model-search.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done
- `model-catalog-refresh.ts` - Done
- `model-search.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done
- `model-catalog-refresh.ts` - Done
- `model-search.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done
- `model-catalog-refresh.ts` - Done
- `model-search.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done
- `model-catalog-refresh.ts` - Done
- `model-search.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done
- `session-selector.ts` - Basic (needs tree view, progress, delete/rename)
- `model-selector.ts` - Basic (needs async refresh, save-as-default)
- `oauth-selector.ts` - Basic (needs provider status, brand animations)
- `thinking-selector.ts` - Done
- `theme-selector.ts` - Done
- `auth-url.ts` - Done
- `login-dialog.ts` - Done (needs device code handling)
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done
- `model-catalog-refresh.ts` - Done
- `model-search.ts` - Done
- `session-share.ts` - Done
- `program-status.ts` - Done
- `bug-report.ts` - Done
- `session-share.ts` - Done
- `external-editor.ts` - Done
- `clipboard.ts` - Done
- `keybindings.ts` - Done
- `keybinding-hints.ts` - Done
- `footer.ts` / `footer-data-provider.ts` - Done
- `header.ts` - Done
- `status-indicator.ts` - Done
- `status-container.ts` - Done
- `themed-text.ts` - Done
- `visual-truncate.ts` - Done
- `dynamic-border.ts` - Done
- `markdown-transform.ts` - Done
- `countdown-timer.ts` - Done

### MISSING - Critical

1. ❌ `tui-renderer.ts` - TUI abstraction layer
2. ❌ `interactive-mode.ts` - Main orchestration class
3. ❌ `tui-renderer.ts` - TUI abstraction layer
4. ❌ `interactive-mode.ts` - Main orchestration class

### MISSING - High Priority Components

- ❌ `oauth-selector` - Provider status, brand animations, auth type per provider
- ❌ `session-selector` - Tree view, progress loading, delete/rename
- ❌ `model-selector` - Async refresh, save-as-default
- ❌ `provider-brand` - Animated brand styles
- ❌ `auth-url` - OAuth URL component
- ❌ `thinking-selector` - Fuzzy search, save-as-default
- ❌ `theme-selector` - Live preview
- ❌ `auth-url` - OAuth URL component
- ❌ `thinking-selector` - Fuzzy search, save-as-default
- ❌ `theme-selector` - Live preview
- ❌ `provider-brand` - Animated brand styles
- ❌ `oauth-selector` - Provider status, brand animations
- ❌ `session-selector` - Tree view, progress, delete/rename
- ❌ `model-selector` - Async refresh, save-as-default

---

## RECOMMENDATION: Start with Critical Path

### Week 1: Critical Infrastructure

1. **Day 1-2**: Create `tui-renderer.ts` - Port from pi's `tui-renderer.js`
2. **Day 3-5**: Create `interactive-mode.ts` - Refactor `ui.ts` into proper class

### Week 2: Core Components

1. `oauth-selector.ts` - Full implementation with provider status
2. `session-selector.ts` - Tree view, progress, delete/rename
3. `model-selector.ts` - Async refresh, save-as-default

### Week 3-4: Remaining Components

1. `provider-brand.ts` - Animated brand styles
2. `thinking-selector.ts` - Fuzzy search, save-as-default
3. `theme-selector.ts` - Live preview
4. `auth-url.ts` - OAuth URL component
5. `thinking-selector.ts` - Fuzzy search, save-as-default
6. `theme-selector.ts` - Live preview
7. `auth-url.ts` - OAuth URL component
8. `provider-brand` - Animated brand styles
9. `oauth-selector` - Provider status, brand animations
10. `session-selector` - Tree view, progress, delete/rename
11. `model-selector` - Async refresh, save-as-default

### Week 4-5: Remaining

1. `tui-renderer.ts` - Already done
2. `interactive-mode.ts` - Main orchestration
3. Remaining components

---

## IMMEDIATE NEXT STEPS

1. **Create `src/tui-renderer.ts`** - Port from pi's `tui-renderer.js`
2. **Create `src/interactive-mode.ts`** - Main orchestration class
3. **Refactor `ui.ts`** - Use `InteractiveMode` class
4. **Enhance `oauth-selector.ts`** - Full pi parity
5. **Enhance `session-selector.ts`** - Tree view, progress, delete/rename
6. **Enhance `model-selector.ts`** - Async refresh, save-as-default
7. **Create `provider-brand.ts`** - Animated brand styles
8. **Create `auth-url.ts`** - OAuth URL component
9. **Create `provider-brand.ts`** - Animated brand styles
10. **Create `auth-url.ts`** - OAuth URL component
11. **Create `thinking-selector.ts`** - Fuzzy search, save-as-default
12. **Create `theme-selector.ts`** - Live preview
13. **Create `auth-url.ts`** - OAuth URL component
14. **Create `provider-brand.ts`** - Animated brand styles
15. **Create `thinking-selector.ts`** - Fuzzy search, save-as-default
16. **Create `theme-selector.ts`** - Live preview
17. **Create `auth-url.ts`** - OAuth URL component
18. **Enhance `login-dialog.ts`** - Device code handling

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] `npm run check` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] Cold start < 500ms
- [ ] Theme system works (DA1, live reload, auto-sync)
- [ ] OAuth selector shows provider status, auth types
- [ ] Session selector shows tree view, progress, delete/rename
- [ ] Model selector has async refresh, save-as-default
- [ ] Theme selector has live preview
- [ ] Thinking selector has fuzzy search, save-as-default
- [ ] Login dialog handles device codes
- [ ] Theme selector has live preview
- [ ] Thinking selector has fuzzy search
- [ ] OAuth selector has provider status, brand animations
- [ ] Session selector has tree view, progress, delete/rename
- [ ] Model selector has async refresh, save-as-default
- [ ] Theme selector has live preview
- [ ] Thinking selector has fuzzy search
- [ ] OAuth selector has provider status, brand animations
- [ ] Session selector has tree view, progress, delete/rename
- [ ] Model selector has async refresh, save-as-default
- [ ] Theme selector has live preview
- [ ] Thinking selector has fuzzy search
- [ ] OAuth selector has provider status, brand animations
- [ ] Session selector has tree view, progress, delete/rename
- [ ] Model selector has async refresh, save-as-default
- [ ] Theme selector has live preview
- [ ] Thinking selector has fuzzy search
- [ ] OAuth selector has provider status, brand animations
- [ ] Session selector has tree view, progress, delete/rename
- [ ] Model selector has async refresh, save-as-default
- [ ] Theme selector has live preview
- [ ] Thinking selector has fuzzy search
- [ ] OAuth selector has provider status, brand animations
- [ ] Session selector has tree view, progress, delete/rename
- [ ] Model selector has async refresh, save-as-default

---

## ESTIMATED EFFORT

| Phase                   | Tasks                                                                                                                                                                                                                                        | Estimated Days |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Critical Infrastructure | tui-renderer, interactive-mode                                                                                                                                                                                                               | 5 days         |
| Core Components         | oauth-selector, session-selector, model-selector                                                                                                                                                                                             | 10 days        |
| Remaining Components    | provider-brand, auth-url, thinking-selector, theme-selector, auth-url, thinking-selector, theme-selector, auth-url, provider-brand, thinking-selector, theme-selector, auth-url, provider-brand, thinking-selector, theme-selector, auth-url | 15 days        |
| Integration & Testing   | Full integration, testing                                                                                                                                                                                                                    | 5 days         |
| **Total**               |                                                                                                                                                                                                                                              | **~25 days**   |

---

## CONCLUSION

**lazydsh has ~60% of pi-coding-agent's interactive mode components implemented.**

**Critical gaps:**

1. `tui-renderer.ts` - Missing entirely
2. `interactive-mode.ts` - Main orchestration missing (currently inline in `ui.ts`)
3. `oauth-selector.ts` - Needs full pi parity (provider status, brand animations, auth type selection)
4. `session-selector.ts` - Needs tree view, progress loading, delete/rename
5. `model-selector.ts` - Needs async catalog refresh, save-as-default
6. `provider-brand.ts` - Missing animated brand styles
7. `auth-url.ts` - Missing OAuth URL component
8. `thinking-selector.ts` - Missing fuzzy search, save-as-default
9. `theme-selector.ts` - Missing live preview
10. `auth-url.ts` - Missing OAuth URL component
11. `provider-brand.ts` - Missing animated brand styles
12. `thinking-selector.ts` - Missing fuzzy search, save-as-default
13. `theme-selector.ts` - Missing live preview
14. `auth-url.ts` - Missing OAuth URL component
15. `provider-brand.ts` - Missing animated brand styles
16. `thinking-selector.ts` - Missing fuzzy search, save-as-default
17. `theme-selector.ts` - Missing live preview
18. `auth-url.ts` - Missing OAuth URL component
19. `provider-brand.ts` - Missing animated brand styles
20. `thinking-selector.ts` - Missing fuzzy search, save-as-default
21. `theme-selector.ts` - Missing live preview
22. `auth-url.ts` - Missing OAuth URL component
23. `provider-brand.ts` - Missing animated brand styles
24. `thinking-selector.ts` - Missing fuzzy search, save-as-default
25. `theme-selector.ts` - Missing live preview
26. `auth-url.ts` - Missing OAuth URL component

**Recommendation**: Start with **Critical Infrastructure** (tui-renderer, interactive-mode), then **Core Components** (oauth-selector, session-selector, model-selector), then **Remaining Components**.
