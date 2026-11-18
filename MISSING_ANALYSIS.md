# Missing Analysis: lazydsh vs pi-coding-agent Interactive Mode

## Overview

This document lists all components/files in pi-coding-agent's interactive mode that are **missing** in lazydsh.

---

## Theme System (src/theme/)

| pi-coding-agent       | lazydsh    | Status                                                  |
| --------------------- | ---------- | ------------------------------------------------------- |
| `system-theme.ts`     | ❌ Missing | **NEEDED** - Generates theme from terminal colors (DA1) |
| `theme-schema.ts`     | ❌ Missing | **NEEDED** - Validates theme JSON                       |
| `dark.json`           | ❌ Missing | **NEEDED** - Built-in dark theme                        |
| `light.json`          | ❌ Missing | **NEEDED** - Built-in light theme                       |
| `theme-controller.ts` | ✅ Exists  | -                                                       |
| `theme-tokens.ts`     | ✅ Exists  | -                                                       |
| `theme.ts`            | ✅ Exists  | -                                                       |
| `lazydsh.json`        | ✅ Exists  | (vs pi's default theme)                                 |

---

## Components (src/components/)

### ✅ Implemented in lazydsh

| Component                 | pi                               | lazydsh                         |
| ------------------------- | -------------------------------- | ------------------------------- |
| `assistant-message`       | ✅                               | ✅                              |
| `bash-execution`          | ✅                               | ✅                              |
| `countdown-timer`         | ✅                               | ✅                              |
| `dynamic-border`          | ✅                               | ✅                              |
| `footer`                  | ✅ (as src/footer.ts)            | ✅                              |
| `header`                  | ❌ (inline in interactive-mode)  | ✅                              |
| `keybinding-hints`        | ✅                               | ✅ (as src/keybinding-hints.ts) |
| `login-dialog`            | ✅                               | ✅                              |
| `markdown-transform`      | ✅                               | ✅                              |
| `model-selector`          | ✅                               | ✅                              |
| `session-selector`        | ✅                               | ✅                              |
| `session-selector-search` | ✅                               | ✅                              |
| `settings-selector`       | ✅ (as src/settings-selector.ts) | ✅                              |
| `status-indicator`        | ✅                               | ✅                              |
| `themed-text`             | ✅                               | ✅                              |
| `theme-selector`          | ✅                               | ✅                              |
| `thinking-selector`       | ✅                               | ✅                              |
| `tool-execution`          | ✅                               | ✅                              |
| `user-message`            | ✅                               | ✅                              |
| `visual-truncate`         | ✅                               | ✅                              |

### ❌ Missing in lazydsh (pi-specific or not ported)

| Component                              | pi  | lazydsh | Notes                                           |
| -------------------------------------- | --- | ------- | ----------------------------------------------- |
| `armin`                                | ✅  | ❌      | 3D animation - pi-specific easter egg           |
| `auth-url`                             | ✅  | ❌      | OAuth URL display - pi-specific                 |
| `bordered-loader`                      | ✅  | ❌      | Loading with border - used in pi                |
| `branch-summary-message`               | ✅  | ❌      | Branch summary display                          |
| `compaction-summary-message`           | ✅  | ❌      | Compaction summary display                      |
| `config-selector`                      | ✅  | ❌      | Config selection UI                             |
| `custom-editor`                        | ✅  | ❌      | Extension custom editor                         |
| `custom-entry`                         | ✅  | ❌      | Extension custom entry                          |
| `custom-message`                       | ✅  | ❌      | Extension custom message                        |
| `diff`                                 | ✅  | ❌      | Inline diff component (lazydsh has src/diff.ts) |
| `earendil-announcement`                | ✅  | ❌      | pi-specific announcements                       |
| `easter-egg-3d` / `easter-egg-3d.lazy` | ✅  | ❌      | 3D easter eggs - pi-specific                    |
| `extension-editor`                     | ✅  | ❌      | Extension editor UI                             |
| `extension-input`                      | ✅  | ❌      | Extension input UI                              |
| `extension-selector`                   | ✅  | ❌      | Extension selector UI                           |
| `first-time-setup`                     | ✅  | ❌      | pi onboarding wizard                            |
| `footer`                               | ✅  | ❌      | (lazydsh has separate src/footer.ts)            |
| `index`                                | ✅  | ❌      | Component barrel (lazydsh has index.ts)         |
| `keybinding-hints`                     | ✅  | ❌      | (lazydsh has src/keybinding-hints.ts)           |
| `login-dialog`                         | ✅  | ✅      | Implemented                                     |
| `markdown-transform`                   | ✅  | ✅      | Implemented                                     |
| `mermaid`                              | ✅  | ❌      | Mermaid diagram rendering                       |
| `model-selector`                       | ✅  | ✅      | Implemented                                     |
| `oauth-selector`                       | ✅  | ❌      | OAuth provider selector                         |
| `pi-logo`                              | ✅  | ❌      | pi branding - pi-specific                       |
| `provider-brand`                       | ✅  | ❌      | Provider brand animations (Radius, OpenRouter)  |
| `radius-login-selector`                | ✅  | ❌      | Radius-specific login                           |
| `scoped-models-selector`               | ✅  | ❌      | Scoped models UI (pi feature)                   |
| `session-selector`                     | ✅  | ✅      | Implemented (DSH-native)                        |
| `session-selector-search`              | ✅  | ✅      | Implemented                                     |
| `settings-selector`                    | ✅  | ✅      | Implemented (as src/settings-selector.ts)       |
| `settings-submenu`                     | ✅  | ❌      | Settings submenu system                         |
| `show-images-selector`                 | ✅  | ❌      | Image display settings                          |
| `skill-invocation-message`             | ✅  | ❌      | pi skill system                                 |
| `status-indicator`                     | ✅  | ✅      | Implemented                                     |
| `themed-text`                          | ✅  | ✅      | Implemented                                     |
| `theme-selector`                       | ✅  | ✅      | Implemented                                     |
| `thinking-selector`                    | ✅  | ✅      | Implemented                                     |
| `tool-execution`                       | ✅  | ✅      | Implemented                                     |
| `tree-selector`                        | ✅  | ❌      | Tree selector (lazydsh uses different approach) |
| `trust-selector`                       | ✅  | ❌      | pi trust management                             |
| `user-message`                         | ✅  | ✅      | Implemented                                     |
| `user-message-selector`                | ✅  | ❌      | User message selection                          |
| `visual-truncate`                      | ✅  | ✅      | Implemented                                     |

---

## Core Theme Files (src/theme/)

| File                  | pi  | lazydsh | Status                                      |
| --------------------- | --- | ------- | ------------------------------------------- |
| `system-theme.ts`     | ✅  | ❌      | **NEEDED** - DA1 terminal color integration |
| `theme-schema.ts`     | ✅  | ❌      | **NEEDED** - Theme validation               |
| `dark.json`           | ✅  | ❌      | **NEEDED** - Built-in dark theme            |
| `light.json`          | ✅  | ❌      | **NEEDED** - Built-in light theme           |
| `theme-controller.ts` | ✅  | ✅      | -                                           |
| `theme-tokens.ts`     | ✅  | ✅      | -                                           |
| `theme.ts`            | ✅  | ✅      | -                                           |

---

## Core Files (src/)

| File                       | pi             | lazydsh   | Status |
| -------------------------- | -------------- | --------- | ------ |
| `chat-viewport.ts`         | ✅             | ✅        | -      |
| `model-catalog-refresh.ts` | ✅             | ✅        | -      |
| `model-search.ts`          | ✅             | ✅        | -      |
| `model-selector.ts`        | ✅             | ✅        | -      |
| `bug-report.ts`            | ✅             | ✅        | -      |
| `program-status.ts`        | ✅             | ✅        | -      |
| `session-share.ts`         | ✅             | ✅        | -      |
| `external-editor.ts`       | ✅             | ✅        | -      |
| `clipboard.ts`             | ✅             | ✅        | -      |
| `extensions.ts`            | ✅             | ✅        | -      |
| `changelog.ts`             | ✅             | ✅        | -      |
| `keybinding-hints.ts`      | ✅ (component) | ✅ (src/) | -      |
| `footer-data-provider.ts`  | ✅ (component) | ✅ (src/) | -      |
| `footer.ts`                | ✅ (component) | ✅ (src/) | -      |
| `settings-selector.ts`     | ✅ (component) | ✅ (src/) | -      |
| `keybindings.ts`           | ✅ (core)      | ✅ (src/) | -      |

---

## Summary: What's Needed for True Parity

### Must Implement (Core Experience)

1. **`system-theme.ts`** - DA1 terminal color query for auto light/dark
2. **`theme-schema.ts`** - Theme validation with typebox
3. **`dark.json` / `light.json`** - Built-in themes
4. **`bordered-loader`** - Loading indicator with border (used in pi)

### Pi-Specific (Not Needed for DSH)

- `armin`, `easter-egg-3d`, `pi-logo`, `earendil-announcement` - pi branding
- `provider-brand`, `radius-login-selector` - pi-specific providers
- `armin`, `easter-egg-3d` - 3D animations
- `skill-invocation-message`, `trust-selector`, `first-time-setup` - pi-specific features
- `oauth-selector`, `scoped-models-selector`, `settings-submenu` - pi-specific UI
- `mermaid`, `show-images-selector` - Optional features
- `custom-editor`, `custom-entry`, `custom-message` - Extension system
- `tree-selector`, `user-message-selector`, `trust-selector` - pi-specific

### Optional Enhancements

- `compaction-summary-message` - Could be nice for compaction UX
- `branch-summary-message` - For session branching
- `config-selector` - Config selection UI
- `diff` component - Inline diffs (lazydsh has src/diff.ts)

---

## Action Plan

1. Add `system-theme.ts` - DA1 terminal color integration
2. Add `theme-schema.ts` - Theme validation
3. Add `dark.json` / `light.json` - Built-in themes
4. Add `bordered-loader.ts` - Loading with border
5. Update theme controller to use system-theme
6. Verify all existing components work with new theme system
