# CẤU TRÚC THƯ MỤC LAZYDSH

> Kiến trúc **3 lớp flat, minimal**: Interactive TUI (Frontend) ↔ Shared Utils ↔ DSH Bridge (Backend) + 2 Contract files ở root.
> **Không có bridge/ layer thừa thãi**. FE chỉ gọi BE qua **1 class `Runtime`**.
> **Cập nhật**: 2025-11-18 - Scan thực tế 89 files, có 3 file mới từ agent khác.

---

## 🏗️ CẤU TRÚC CUỐI CÙNG (FINAL)

```
src/
├── interactive-mode/          # 🎨 FE: TUI/UI (~38 files)
│   ├── components/            # Chỉ subdir duy nhất (22 files)
│   └── *.ts, *.json          # Flat: TUI files + theme files
│
├── runtime/                   # ⚙️ BE: DSH Bridge (~10 files)
│   └── *.ts                  # Flat: RuntimeImpl + catalog + ...
│
├── utils/                     # 🔧 SHARED: 4 utils (FLAT, ngang hàng)
│   └── *.ts
│
├── interfaces.ts              # 📋 CONTRACT: Runtime interface (1 file)
├── runtime-events.ts          # 📋 CONTRACT: Event definitions (1 file)
│
├── cli.ts                     # Entry point
├── plugin.ts                  # Cordis plugin
└── types.ts                   # Re-export: interfaces + utils
```

---

## 🔗 LUỒNG GỌI DUY NHẤT (1 CLASS RUNTIME)

```typescript
// interactive-mode/ui.ts
import { Runtime, RuntimeOptions, Callbacks, RuntimeEvent } from "@/interfaces";
import { RuntimeImpl } from "@/runtime/runtime";
import { formatStats } from "@/interactive-mode/stats";

const runtime: Runtime = new RuntimeImpl(ctx, options);

// FE chỉ gọi qua 1 class Runtime
const sessionId = await runtime.open({ provider, model }, callbacks);
const result = await runtime.run(prompt, onEvent, attachments);

// Events
runtime.on("tool_execution_start", handler);
```

```typescript
// runtime/runtime.ts
import { Runtime, RuntimeOptions, Callbacks, RuntimeEvent } from '@/interfaces';
import { formatTokens } from '@/utils/format';
import { catalog } from '@/runtime/catalog';

export class RuntimeImpl implements Runtime { ... }
```

---

## 📁 CHI TIẾT TẤT CẢ FILES (TRẠNG THÁI HIỆN TẠI: 89 FILES)

### 🎨 `interactive-mode/` — FE: TUI/UI (~38 files)

#### Root (`interactive-mode/`) — 38 files (FLAT)

| File                         | Nguồn                                       | Mô tả                                                  |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `ui.ts`                      | `src/ui.ts`                                 | Main orchestration (~1380 lines)                       |
| `chat-viewport.ts`           | `src/chat-viewport.ts`                      | Layout: Header/Transcript/Pending/Status/Editor/Footer |
| `streaming.ts`               | `src/streaming.ts`                          | StreamingMarkdown (incremental parsing)                |
| `autocomplete.ts`            | `src/autocomplete.ts`                       | @ files, / commands autocomplete                       |
| `extensions.ts`              | `src/extensions.ts`                         | Extension widget registry                              |
| `bug-report.ts`              | `src/bug-report.ts`                         | `/bug` command                                         |
| `session-share.ts`           | `src/session-share.ts`                      | `/share` command                                       |
| `external-editor.ts`         | `src/external-editor.ts`                    | Ctrl+G $EDITOR integration                             |
| `clipboard.ts`               | `src/clipboard.ts`                          | Ctrl+X copy message                                    |
| `program-status.ts`          | `src/program-status.ts`                     | OSC 7501 shell integration                             |
| `show-changelog.ts`          | `src/show-changelog.ts`                     | `/changelog` panel                                     |
| `changelog.ts`               | `src/changelog.ts`                          | Changelog data + component                             |
| `keybindings.ts`             | `src/keybindings.ts`                        | Keybinding config + hot reload                         |
| `keybinding-hints.ts`        | `src/keybinding-hints.ts`                   | Key display formatting                                 |
| `session-select.ts`          | `src/session-select.ts`                     | Standalone session picker                              |
| `session-selector-search.ts` | `src/session-selector-search.ts` (merge)    | Search/filter/sort utilities                           |
| `stream-highlight.ts`        | `src/stream-highlight.ts`                   | Incremental syntax highlighting                        |
| `tui-console.ts`             | `src/tui-console.ts`                        | Console capture during TUI                             |
| `ui-commands.ts`             | `src/ui-commands.ts`                        | Command validation helpers                             |
| `resume-directory.ts`        | `src/resume-directory.ts`                   | Resume directory selection                             |
| `tool-presentation.ts`       | `src/tool-presentation.ts`                  | DSH tool → UI component bridge                         |
| `history.ts`                 | `src/history.ts`                            | Event rendering cho replay                             |
| `model-catalog-refresh.ts`   | `src/model-catalog-refresh.ts`              | UI coordinator                                         |
| `model-search.ts`            | `src/model-search.ts`                       | UI search utilities                                    |
| `terminal-login.ts`          | `src/terminal-login.ts`                     | **Full TUI auth** (dùng pi-tui)                        |
| `dsh-boot.ts`                | `src/dsh-boot.ts`                           | TUI two-phase boot logic                               |
| `plugin-patch.ts`            | `src/plugin-patch.ts`                       | TUI profile patches                                    |
| `deferred.ts`                | `src/deferred.ts`                           | TUI deferred loading logic                             |
| `telemetry-patch.ts`         | `src/telemetry-patch.ts`                    | TUI OTel opt-out patch                                 |
| `open-url.ts`                | `src/open-url.ts`                           | TUI helper (OAuth URL)                                 |
| `stats.ts`                   | `src/stats.ts`                              | UI formatting (footer/status panel)                    |
| `limits.ts`                  | `src/limits.ts`                             | UI formatting (footer/status panel)                    |
| `tui-renderer.ts`            | Tách từ `ui.ts`                             | TUI creation helpers                                   |
| `theme.ts`                   | Merge `src/theme.ts` + `src/theme/theme.ts` | Theme core                                             |
| `theme-controller.ts`        | `src/theme/theme-controller.ts`             | Theme controller                                       |
| `theme-tokens.ts`            | `src/theme/theme-tokens.ts`                 | 83 token definitions                                   |
| `theme-schema.ts`            | `src/theme/theme-schema.ts`                 | Theme JSON validation                                  |
| `system-theme.ts`            | `src/theme/system-theme.ts`                 | System theme từ terminal                               |
| `lazydsh.json`               | `src/theme/lazydsh.json`                    | Default theme                                          |

#### Subdirectory duy nhất: `interactive-mode/components/` — 22 files (FLAT)

| File                      | Nguồn                                  | Component                                    |
| ------------------------- | -------------------------------------- | -------------------------------------------- |
| `index.ts`                | Rewrite                                | Barrel export                                |
| `tool-execution.ts`       | `src/tool-execution.ts`                | `ToolExecutionComponent`                     |
| `bash-execution.ts`       | `src/bash-execution.ts`                | `BashExecutionComponent`                     |
| `model-selector.ts`       | `src/model-selector.ts`                | `ModelSelectorComponent`                     |
| `session-selector.ts`     | `src/session-selector.ts`              | `SessionSelector` (DSH-native)               |
| `footer.ts`               | `src/footer.ts`                        | `FooterComponent`                            |
| `footer-data-provider.ts` | `src/footer-data-provider.ts`          | `FooterDataProvider`                         |
| `presentation.ts`         | `src/presentation.ts`                  | 10 component classes                         |
| `header.ts`               | `src/components/header.ts`             | `HeaderComponent`                            |
| `login-dialog.ts`         | `src/components/login-dialog.ts`       | `LoginDialog`                                |
| `settings-selector.ts`    | `src/settings-selector.ts`             | `SettingsSelectorComponent`                  |
| `theme-selector.ts`       | `src/components/theme-selector.ts`     | `ThemeSelectorComponent`                     |
| `thinking-selector.ts`    | `src/components/thinking-selector.ts`  | `ThinkingSelectorComponent`                  |
| `status-indicator.ts`     | `src/components/status-indicator.ts`   | 5 status classes                             |
| `status-container.ts`     | `src/components/status-container.ts`   | `StatusIndicatorContainer`                   |
| `dynamic-border.ts`       | `src/components/dynamic-border.ts`     | `DynamicBorder`                              |
| `bordered-loader.ts`      | `src/components/bordered-loader.ts`    | `BorderedLoader`                             |
| `visual-truncate.ts`      | `src/components/visual-truncate.ts`    | `truncateToVisualLines`, `VisualLinePreview` |
| `markdown-transform.ts`   | `src/components/markdown-transform.ts` | `createMarkdownTransform`                    |
| `countdown-timer.ts`      | `src/components/countdown-timer.ts`    | `CountdownTimer`                             |
| `themed-text.ts`          | `src/components/themed-text.ts`        | `ThemedText`                                 |
| `keybinding-hints.ts`     | `src/keybinding-hints.ts`              | Key display formatting                       |
| `oauth-selector.ts`       | `src/components/oauth-selector.ts`     | **MỚI** OAuth provider selector              |
| `provider-brand.ts`       | `src/components/provider-brand.ts`     | **MỚI** Provider branding                    |
| `auth-url.ts`             | `src/components/auth-url.ts`           | **MỚI** Auth URL display                     |

> ❌ **XÓA**: `src/components/session-selector.ts` (dead code 748 lines, file-path based)

---

### ⚙️ `runtime/` — BE: DSH Bridge (~10 files, FLAT)

| File                 | Nguồn                    | Mô tả                                                      |
| -------------------- | ------------------------ | ---------------------------------------------------------- |
| `runtime.ts`         | `src/runtime.ts`         | `RuntimeImpl` (implements `Runtime` interface, 1219 lines) |
| `runtime-events.ts`  | `src/runtime-events.ts`  | Event emission logic                                       |
| `catalog.ts`         | `src/catalog.ts`         | Provider/model catalog                                     |
| `provider.ts`        | `src/provider.ts`        | Normalize provider (`codex` → `openai-codex`)              |
| `native-commands.ts` | `src/native-commands.ts` | DSH commands: `/export`, `/effort`                         |
| `plugin.ts`          | `src/plugin.ts`          | Cordis plugin entry, Runtime creation                      |
| `preferences.ts`     | `src/preferences.ts`     | Model persistence (`~/.dsh/lazydsh-model.json`)            |
| `upgrade.ts`         | `src/upgrade.ts`         | Self-upgrade logic (npm, bun, pnpm, yarn, vp)              |
| `command-runner.ts`  | `src/command-runner.ts`  | CLI command runner (ask/login/logout)                      |
| `history.ts`         | `src/history.ts`         | Session history data layer                                 |

> **FLAT, KHÔNG SUBDIR**. Không import `pi-tui`, không import `interactive-mode/*`.

---

### 🔧 `utils/` — SHARED (4 files, FLAT, ngang hàng)

| File                  | Nguồn                           | Dùng bởi                                |
| --------------------- | ------------------------------- | --------------------------------------- |
| `ansi.ts`             | `src/utils/ansi.ts`             | FE + BE                                 |
| `truncate.ts`         | `src/utils/truncate.ts`         | FE + BE                                 |
| `models-are-equal.ts` | `src/utils/models-are-equal.ts` | FE + BE (xóa `src/models-are-equal.ts`) |
| `format.ts`           | `src/format.ts`                 | FE + BE                                 |

---

### 📋 CONTRACT FILES (Root, FLAT)

| File                | Nguồn                    | Vai trò                                                                                                                   |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `interfaces.ts`     | Tách từ `src/runtime.ts` | `Runtime` interface + types (`RuntimeOptions`, `Callbacks`, `RunResult`, `Route`, `CredentialSource`, `SessionInfo`, ...) |
| `runtime-events.ts` | `src/runtime-events.ts`  | Event type definitions (`RuntimeEvent`, `isAuthFailure`, `eventText`, `contentText`)                                      |

---

### Root `src/` — 3 FILES

| File        | Mô tả                                                   |
| ----------- | ------------------------------------------------------- |
| `cli.ts`    | Entry point, arg parsing, commands                      |
| `plugin.ts` | Cordis plugin entry                                     |
| `types.ts`  | `export * from './interfaces'; export * from './utils'` |

---

## 📊 TỔNG KẾT SỐ FILE (HIỆN TẠI: 89 FILES)

| Layer        | Thư mục/File                         | Files  | Subdirs           |
| ------------ | ------------------------------------ | ------ | ----------------- |
| **FE**       | `interactive-mode/`                  | 38     | `components/` (1) |
| **BE**       | `runtime/`                           | 10     | 0 (flat)          |
| **Shared**   | `utils/`                             | 4      | 0 (flat)          |
| **Contract** | `interfaces.ts`, `runtime-events.ts` | 2      | -                 |
| **Root**     | `cli.ts`, `plugin.ts`, `types.ts`    | 3      | -                 |
| **Tổng**     |                                      | **65** | **1 subdir**      |

> **Chênh lệch**: Hiện tại 89 files vs Target 65 files. Cần xóa 4 duplicates + 1 dead code + 19 merged/moved.

---

## 🔗 IMPORT PATTERNS

```typescript
// interactive-mode/ui.ts
import { Runtime, RuntimeOptions, Callbacks, RuntimeEvent } from '@/interfaces';
import { RuntimeImpl } from '@/runtime/runtime';
import { formatStats } from '@/interactive-mode/stats';
import { terminalAuth } from '@/interactive-mode/terminal-login';
import { ToolExecutionComponent } from '@/interactive-mode/components/tool-execution';
import { theme } from '@/interactive-mode/theme';

// runtime/runtime.ts
import { Runtime, RuntimeOptions, Callbacks, RuntimeEvent } from '@/interfaces';
import { formatTokens } from '@/utils/format';
import { catalog } from '@/runtime/catalog';

export class RuntimeImpl implements Runtime { ... }

// interfaces.ts
export interface Runtime {
  open(route: Route, callbacks: Callbacks): Promise<string>;
  run(text: string, onEvent?: (e: RuntimeEvent) => void, ...): Promise<RunResult>;
  cancel(): Promise<void>;
  close(): Promise<void>;
  sessions(): Promise<SessionInfo[]>;
  // ... tất cả methods FE cần
}
export type RuntimeOptions = ...
export type Callbacks = ...
export type RunResult = ...
export type Route = ...
export type CredentialSource = ...
export type SessionInfo = ...
// RuntimeEvent export từ runtime-events.ts
```

---

## 📦 DEPENDENCY DIRECTION

```
interactive-mode/  ──imports──▶  interfaces.ts, runtime-events.ts, utils/, runtime/
    (TUI, pi-tui)
         │
         ▼
   Render UI, Handle keys, Show markdown

runtime/           ──imports──▶  interfaces.ts, utils/
    (DSH, @deepseek-ai/dsh-*)
         │
         ▼
   Talk to DSH Agent
   Sessions, Models, Tools
   Auth, Stats, History

utils/             ──imports──▶  (nothing)
    (pure TS)
```

**Quy tắc:**

- `interactive-mode/` → import từ `interfaces`, `runtime-events`, `utils`, `runtime/*`
- `runtime/` → import từ `interfaces`, `utils` (**KHÔNG** import `interactive-mode/*`)
- `interfaces.ts`, `runtime-events.ts`, `utils/*` → **KHÔNG import gì cả**

---

## ❌ FILES XÓA / GỘP / DI CHUYỂN (TỪ TRẠNG THÁI HIỆN TẠI)

| File cũ                                     | Xử lý                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/components/session-selector.ts`        | **XÓA** (748 lines, dead code, file-path based)                                                                       |
| `src/models-are-equal.ts`                   | **XÓA** (giữ `utils/models-are-equal.ts`)                                                                             |
| `src/theme.ts`                              | **GỘP** vào `interactive-mode/theme.ts`                                                                               |
| `src/theme/theme.ts`                        | **GỘP** vào `interactive-mode/theme.ts`                                                                               |
| `src/session-selector-search.ts`            | **GỘP** với `src/components/session-selector-search.ts` → `interactive-mode/session-selector-search.ts`               |
| `src/session-selector.ts`                   | **GỘP** với `src/components/session-selector.ts` → `interactive-mode/components/session-selector.ts` (giữ DSH-native) |
| `src/theme/` (thư mục)                      | Xóa sau khi move                                                                                                      |
| `src/components/` (thư mục)                 | Xóa sau khi move (chỉ giữ `components/` trong `interactive-mode/`)                                                    |
| `src/utils/` (thư mục)                      | Xóa sau khi move                                                                                                      |
| `src/components/index.ts`                   | Rewrite → `interactive-mode/components/index.ts`                                                                      |
| `src/components/oauth-selector.ts`          | Move → `interactive-mode/components/oauth-selector.ts`                                                                |
| `src/components/provider-brand.ts`          | Move → `interactive-mode/components/provider-brand.ts`                                                                |
| `src/components/auth-url.ts`                | Move → `interactive-mode/components/auth-url.ts`                                                                      |
| `src/components/session-selector-search.ts` | Gộp với `src/session-selector-search.ts` → `interactive-mode/session-selector-search.ts`                              |
| `src/theme/` JSON files                     | Copy → `interactive-mode/`                                                                                            |

---

## ✅ CHECKLIST REFACTOR (7 PHASES)

- [ ] Tạo `src/interactive-mode/`, `src/interactive-mode/components/`, `src/runtime/`, `src/utils/`
- [ ] Move 22 components → `interactive-mode/components/` (bao gồm 3 file mới: oauth-selector, provider-brand, auth-url)
- [ ] Move 38 TUI files → `interactive-mode/` (flat)
- [ ] Move 10 runtime files → `runtime/` (flat)
- [ ] Move 4 utils → `utils/` (flat)
- [ ] Tạo `interfaces.ts` (extract từ `runtime.ts`)
- [ ] Move `runtime-events.ts` → root
- [ ] Xóa duplicates + dead code + merge theme
- [ ] Fix imports → `@/interfaces`, `@/runtime/*`, `@/interactive-mode/*`, `@/utils/*`
- [ ] Chạy `npm run check` + `npm run test`

---

## 📁 CẤU TRÚC HIỆN TẠI vs TARGET

| Hiện tại (89 files)           | Target (65 files)                                                     |
| ----------------------------- | --------------------------------------------------------------------- |
| 62 files ở root               | 3 files ở root (`cli.ts`, `plugin.ts`, `types.ts`) + 2 contract files |
| `src/components/` (19)        | `interactive-mode/components/` (22)                                   |
| `src/theme/` (8)              | `interactive-mode/` flat (7)                                          |
| `src/utils/` (3)              | `utils/` (4)                                                          |
| `src/runtime.ts` (1219 lines) | `runtime/runtime.ts` + `interfaces.ts`                                |
| 4 duplicates                  | 0 duplicates                                                          |
| 1 dead code                   | 0 dead code                                                           |

---

## 🎯 NGUYÊN TẮC CỐT LÕI

1. **3 Lớp flat**: FE (`interactive-mode/`) ↔ Shared (`utils/`) ↔ BE (`runtime/`) + 2 Contract files
2. **1 subdir duy nhất**: `interactive-mode/components/`
3. **FE chỉ gọi BE qua 1 class**: `Runtime` (implement `Runtime` interface)
4. **Zero UI deps in runtime/utils**: Không import `pi-tui`, `theme.ts`, components
5. **Contract = 2 files**: `interfaces.ts` + `runtime-events.ts` (chỉ types, không logic)
6. **Terminal-login là TUI**: Ở `interactive-mode/` vì dùng `pi-tui` hoàn chỉnh

---

_Cập nhật: 2025-11-18 — Scan thực tế 89 files, 3 file mới từ agent khác (oauth-selector, provider-brand, auth-url)_
