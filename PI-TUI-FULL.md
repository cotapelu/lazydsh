# PI-TUI FULL UTILIZATION ROADMAP

**Goal:** Achieve 100% pi-tui capability utilization in lazydsh  
**Current:** ~85% (core fully exploited, advanced features untapped)  
**Generated:** 2026-11-27 from full codebase audit (149 TS files)  
**Updated:** 2026-11-27 with pi-tui internals analysis (theme system, component patterns)

---

## 📊 EXECUTIVE SUMMARY

| Category                   | Current | Target   | Effort            |
| -------------------------- | ------- | -------- | ----------------- |
| Layout & Core Components   | 95%     | 100%     | Low               |
| Text & ANSI Handling       | 100%    | 100%     | —                 |
| Input & Interaction        | 90%     | 100%     | Low               |
| Animation & Loading        | 80%     | 100%     | Low               |
| Search & Navigation        | 70%     | 100%     | Medium            |
| Rich Media (Images, LaTeX) | 10%     | 100%     | Medium-High       |
| Extensibility & Themes     | 90%     | 100%     | Low               |
| **Overall**                | **87%** | **100%** | **~35 dev hours** |

---

## 🎨 PI-TUI THEME SYSTEM — CLARIFICATION (2026-11-27)

**Critical finding:** pi-tui v1.5.2 **does NOT provide a global semantic theme/token system.**

| What pi-tui provides                                                                        | What pi-tui does NOT provide                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Color` type (Indexed/RGB/OKLCH)                                                            | ❌ Global token registry                                                        |
| `parseColor`, `mixColors`, `foregroundAnsi`, `backgroundAnsi`                               | ❌ Semantic token names (`"warning"`, `"dim"`, `"success"`, `"borderMuted"`...) |
| `styleText`, `styleTextWithAnsi`                                                            | ❌ Slot system (fg vs bg per token)                                             |
| Component theme factories: `getMarkdownTheme()`, `getSelectListTheme()`, `getEditorTheme()` | ❌ Persistence (`theme.json`), hot-reload, `ThemeController`                    |
| Color science: OKLCH/OKHSL mixing, gamut mapping                                            | ❌ User custom themes (`~/.config/lazydsh/themes/*.json`)                       |

**Pi-tui expects apps to provide their own theme system** and inject it into component factories:

```typescript
// Pi-tui intended pattern
const myTheme = createMyThemeSystem(); // ← App writes this
const markdown = new Markdown({
  theme: getMarkdownTheme(myTheme), // ← Inject semantic tokens
});
```

**Lazydsh correctly implements** `src/interactive-mode/theme/theme.ts` as the app-level theme system:

- `THEME_TOKENS` registry (70+ tokens with fg/bg slots)
- Singleton `Theme` class + proxy `theme.fg("token", text)` / `theme.bg("token", text)`
- `ThemeController` for load/save/preview/hot-reload
- JSON persistence at `~/.config/lazydsh/theme.json`

**This is NOT "reinventing" — it's filling a gap pi-tui intentionally leaves to apps.**

---

## 🎯 PRIORITY MATRIX

```
IMPACT
  ▲
  │  P1 ◢  P2 ◢
  │   │     │
  │   ▼     ▼
  └────────────► EFFORT
       P0 ◢
        │
        ▼
```

- **P0** = Quick wins (1-2 hrs each) — High impact, trivial effort
- **P1** = High impact (half day each) — Differentiating features
- **P2** = Polish (full day each) — Code reduction, advanced features

---

## ✅ P0 — QUICK WINS (Do First, 1-2 hrs each)

### P0-1: Enable Mouse Support in TuiAltScreen

**File:** `src/interactive-mode/tui-renderer.ts:52-83`  
**Change:** Add `mouse: true` to TuiAltScreen options  
**Benefit:** Click links, scroll wheel, text selection, drag-to-scroll in transcript

```typescript
// In createInteractiveTui(), fullscreen branch:
return new TuiAltScreen(terminal, options.showHardwareCursor, options.logDirectory, {
  // ... existing options ...
  mouse: true, // ← ADD THIS LINE
  // ...
});
```

**Test:** Run `npm run build && node dist/cli.mjs`, verify mouse scroll works in transcript.

---

### P0-2: Use HStack + Text for Footer Layout (Fixes Double-Dim Bug)

**File:** `src/interactive-mode/footer.ts:172-315` (entire `render()` method)  
**Root Cause:** Footer bypasses pi-tui component system → manual ANSI string concat → **double-dim on right side** (tokens already have embedded `dim` for bullets `•` `→` `()`, then entire remainder wrapped in `dim` again)

**Change:** Replace manual padding/alignment with `HStack` + `Text` components  
**Benefit:** Cleaner code, automatic responsive truncation, proper alignment, **fixes color mismatch**

```typescript
// Imports
import { HStack, Text, Spacer } from "@earendil-works/pi-tui";

// In render(width):
// Left side: stats (tokens, cost, context%) — apply dim at component level
const leftText = new Text(statsLeft); // statsLeft = raw text, NO theme.fg("dim", ...)
leftText.setCustomBgFn((t) => theme.fg("dim", t)); // or style via theme at leaf level

// Right side: model + thinking + routed — ALREADY has embedded dim for bullets
const rightText = new Text(rightSide); // rightSide = pre-styled with theme.fg("dim", "•") etc.

// HStack handles layout, padding, truncation automatically
const hstack = new HStack([
  { component: leftText, grow: 1, shrink: 1, minSize: 10 },
  { component: new Spacer(1), shrink: 0 }, // minimum 1 cell gap
  { component: rightText, shrink: 0 },
]);

const statsLine = hstack.render(width)[0] ?? "";
// Return [pwdLine, statsLine, ...extensionLines]
```

**Delete:** Manual `truncateToWidth`, `visibleWidth`, padding calculation, double-dim logic (~80 lines)

**Key insight:** pi-tui `Text` component preserves ANSI codes across layout — no manual width math needed. Style at **leaf level** (per segment), not whole concatenated string.

---

### P0-3: Replace Custom Spinners with CancellableLoader

**File:** `src/interactive-mode/components/status-indicator.ts`  
**Target Classes:** `RetryStatusIndicator`, `CompactionStatusIndicator`, `BranchSummaryStatusIndicator`  
**Benefit:** Built-in cancel button, standardized frames, less custom code

```typescript
// Imports
import { CancellableLoader } from "@earendil-works/pi-tui";

// CompactionStatusIndicator → extends CancellableLoader
export class CompactionStatusIndicator extends CancellableLoader {
  constructor(ui: TuiHost, reason: "manual" | "overflow") {
    super(
      narrowedUi(ui),
      (s) => theme.fg("accent", s),
      (s) => theme.fg("muted", s),
      reason === "manual" ? "Compacting context..." : "Auto-compacting...",
      { frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] },
    );
    this.onCancel = () => {
      // Hook into runtime.cancel() via ui reference
      // Requires passing cancel callback or using event bus
    };
  }
}

// RetryStatusIndicator → extends CancellableLoader
export class RetryStatusIndicator extends CancellableLoader {
  constructor(ui: TuiHost, attempt: number, maxAttempts: number, delayMs: number) {
    super(
      narrowedUi(ui),
      (s) => theme.fg("warning", s),
      (s) => theme.fg("muted", s),
      `Retrying (${attempt}/${maxAttempts})...`,
      { frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] },
    );
    this.onCancel = () => {
      /* interrupt retry */
    };
    // Add countdown timer separately
  }
}
```

**Note:** `WorkingStatusIndicator` keeps `Loader` base (no cancel needed).

---

### P0-4: Use TruncatedText for Tool Output Expansion

**File:** `src/interactive-mode/bash-execution.ts:160-184`  
**Change:** Replace manual line hiding with `TruncatedText` component  
**Benefit:** Auto-expand/collapse, built-in "N more lines" indicator, keyboard handling

```typescript
// Imports
import { TruncatedText } from "@earendil-works/pi-tui";

// In BashExecutionComponent render():
const outputText = new TruncatedText(this.fullOutput, {
  maxLines: this.expanded ? Infinity : 20,
  placeholder: (hiddenLines) =>
    theme.fg(
      "muted",
      `\n... ${hiddenLines} more lines (${keyHint("app.tools.expand", "Enter to expand")})`,
    ),
  onExpand: () => {
    this.expanded = true;
    this.invalidate();
  },
  onCollapse: () => {
    this.expanded = false;
    this.invalidate();
  },
});
```

**Delete:** Manual `hiddenLineCount`, `previewLogicalLines`, expand/collapse logic (~40 lines)

---

### P0-5: Use WheelScrollLines for Scroll Tuning

**File:** `src/interactive-mode/tui-renderer.ts:52-83`  
**Change:** Add `wheelScrollLines` option (already supported, just expose)  
**Benefit:** Configurable scroll speed per user preference

```typescript
// In InteractiveTuiOptions:
fullscreenWheelScrollLines?: number | "auto";  // Already exists!

// Pass through to TuiAltScreen:
wheelScrollLines: options.fullscreenWheelScrollLines ?? 3,  // Default 3 lines
```

**Config:** Add to `~/.config/lazydsh/settings.json`:

```json
{ "wheelScrollLines": 3 }
```

---

### P0-6: Use Input Component Features Fully

**Files:** `src/interactive-mode/components/login-dialog.ts`, `src/interactive-mode/presentation.ts` (`SecretInput`)  
**Change:** Leverage `placeholder`, `placeholderStyle`, `onSubmit`, `value` props  
**Benefit:** Consistent UX, less custom handling

```typescript
// LoginDialog - already uses Input, enhance:
this.input = new Input({
  prompt: accent("┃ "),
  placeholder: "Enter API key...",
  placeholderStyle: dim,
  onSubmit: (value) => this.handleSubmit(value),
});

// SecretInput - simplify:
export class SecretInput extends Input {
  constructor() {
    super({
      prompt: accent("┃ "),
      placeholder: "API key (hidden)",
      placeholderStyle: dim,
    });
  }
  override render(width: number): string[] {
    // Pi-tui Input already supports masking via value transformation
    // Or keep custom render for bullet chars
  }
}
```

---

### P0-7: Use SelectList Theme Fully

**File:** `src/interactive-mode/picker.ts:14-20` (`selectionTheme`)  
**Change:** Extend to full `SelectListTheme`  
**Benefit:** Hover highlighting, cursor style, match highlighting, scroll indicators

```typescript
export const selectionTheme = {
  selectedPrefix: accent,
  selectedText: (text: string) => accent(text.replace(/^→ /, "› ")),
  description: dim,
  scrollInfo: dim,
  noMatch: () => dim("  No matches"),
  // ADD THESE:
  cursor: (text: string) => theme.inverse(text), // Selected row cursor
  match: (text: string) => theme.underline(text), // Fuzzy match highlight
  matchCurrent: (text: string) => theme.inverse(theme.underline(text)), // Current match
  hover: (text: string) => theme.bg("selectedBg", text), // Mouse hover
};
```

**Apply:** All `SelectList` instantiations in `picker.ts`, `model-selector.ts`, `session-selector.ts`

---

## 🚀 P1 — HIGH IMPACT (Half day each)

### P1-1: Image Rendering for Mermaid/Charts/Screenshots

**Files:** `src/interactive-mode/components/assistant-message.ts`, `src/interactive-mode/components/mermaid.ts`  
**Benefit:** Agent can _show_ diagrams, charts, screenshots inline — not just text

**Implementation:**

```typescript
// In assistant-message.ts, add to imports:
import { detectCapabilities, renderImage, type ImageRenderOptions } from "@earendil-works/pi-tui";

// Add image rendering to AssistantMessageComponent:
private async renderImages(content: MessageContent[]): Promise<void> {
  const caps = detectCapabilities();
  if (!caps.kitty && !caps.iterm2 && !caps.sixel) return;

  for (const block of content) {
    if (block.type === "image" && block.url) {
      const opts: ImageRenderOptions = {
        path: block.url,  // or base64 data URI
        x: 0, y: 0,
        width: 60,
        height: 30,
        preserveAspectRatio: true,
      };
      // Render via pi-tui's image protocol
      // Note: requires integration with pi-tui's image rendering pipeline
    }
  }
}

// In mermaid.ts transformer: when mermaid renders to PNG,
// inject image block into message content for rendering
```

**Prerequisites:**

- Mermaid CLI (`mmdc`) or `lovely-mermaid` outputs PNG
- Terminal supports kitty/iTerm2/sixel (most modern terminals)
- Add `image` content type to `MessageContent` interface

**Effort:** 4-6 hours (mermaid→PNG pipeline + image protocol integration)

---

### P1-2: AltScreenSearch for Global Transcript Search

**Files:** New `src/interactive-mode/components/transcript-search.ts`, integrate in `ui.ts`  
**Benefit:** Cmd+F / Ctrl+F → instant full-transcript search with navigation

**Implementation:**

```typescript
// New file: transcript-search.ts
import { AltScreenSearch, type SelectItem } from "@earendil-works/pi-tui";
import { theme, accent, dim } from "../theme.ts";

export class TranscriptSearch extends AltScreenSearch {
  constructor(
    private getTranscriptLines: () => { line: string; index: number }[],
    private onSelect: (index: number) => void,
  ) {
    super({
      placeholder: "Search transcript…",
      placeholderStyle: dim,
      prompt: accent("❯ "),
      getItems: () => {
        const lines = getTranscriptLines();
        return lines.map(({ line, index }) => ({
          value: String(index),
          label: line.slice(0, 200), // Truncate for display
          description: dim(`Line ${index}`),
        }));
      },
      onSelect: (item) => onSelect(Number(item.value)),
      theme: {
        match: (text) => theme.underline(text),
        matchCurrent: (text) => theme.inverse(theme.underline(text)),
        selectedPrefix: accent,
        selectedText: accent,
        description: dim,
        noMatch: () => dim("  No matches"),
      },
    });
  }
}

// In ui.ts: Add keybinding "tui.altScreen.search" (Ctrl+F)
// Show overlay: tui.showOverlay(new TranscriptSearch(getLines, scrollToLine))
```

**Keybinding:** Add to `keybindings.ts`:

```typescript
"tui.altScreen.search": { defaultKeys: "ctrl+f", description: "Search transcript" },
```

**Effort:** 3-4 hours

---

### P1-3: SettingsList for Professional Settings UI

**Files:** Replace `src/interactive-mode/settings-selector.ts` (300+ lines)  
**Benefit:** Built-in categories, toggles, validation, descriptions, less custom code

**Implementation:**

```typescript
// New file: settings-list-ui.ts
import { SettingsList, type SettingItem } from "@earendil-works/pi-tui";
import { theme, accent, dim, success, error } from "./theme.ts";

export function createSettingsList(onChange: (key: string, value: unknown) => void): SettingsList {
  const settings: SettingItem[] = [
    // Category: Editor
    { type: "category", label: "Editor" },
    {
      type: "toggle",
      key: "editor.confirmExit",
      label: "Confirm exit on Ctrl+D",
      description: "Require confirmation when editor is not empty",
      value: readUiSettings().confirmExit,
      onChange: (v) => onChange("editor.confirmExit", v),
    },
    {
      type: "number",
      key: "editor.padding",
      label: "Editor padding",
      description: "Lines of padding around editor text",
      value: readUiSettings().editorPadding,
      min: 0,
      max: 5,
      onChange: (v) => onChange("editor.padding", v),
    },

    // Category: Theme
    { type: "category", label: "Theme" },
    {
      type: "select",
      key: "theme.name",
      label: "Theme",
      description: "Color theme (requires restart for full effect)",
      value: readThemeSetting(),
      options: ["default", "system", "dark", "light"],
      onChange: (v) => onChange("theme.name", v),
    },

    // Category: Behavior
    { type: "category", label: "Behavior" },
    {
      type: "toggle",
      key: "behavior.autoCompact",
      label: "Auto-compaction",
      description: "Automatically compact context when approaching limit",
      value: true,
      onChange: (v) => onChange("behavior.autoCompact", v),
    },

    // Category: Advanced
    { type: "category", label: "Advanced" },
    {
      type: "action",
      key: "advanced.resetCache",
      label: "Clear cache",
      description: "Delete all cached model catalogs and session data",
      onAction: () => {
        /* confirm dialog → clear */
      },
    },
  ];

  return new SettingsList(settings, {
    selectedPrefix: accent,
    selectedText: accent,
    description: dim,
    scrollInfo: dim,
    category: (text) => theme.bold(theme.fg("accent", text)),
    toggleOn: (text) => success(text),
    toggleOff: (text) => error(text),
  });
}
```

**Migration:** Replace `SettingsSelectorComponent` entirely (~300 lines → ~100 lines)

**Effort:** 3-4 hours

---

### P1-4: LaTeX Rendering for Math Formulas

**Files:** `src/interactive-mode/components/markdown-transform.ts`, `src/interactive-mode/components/assistant-message.ts`  
**Benefit:** Render mathematical formulas in markdown (`$$E=mc^2$$`)

**Implementation:**

```typescript
// In markdown-transform.ts, add to transform pipeline:
import { renderLatex } from "@earendil-works/pi-tui";

// In createMarkdownTransform():
const transformers: MarkdownTransformers = [
  // ... existing transformers ...
  {
    name: "latex",
    test: (token) => token.type === "math" || token.type === "inline_math",
    render: (token) => {
      const latex = token.type === "math" ? token.text : token.text;
      return renderLatex(latex, { displayMode: token.type === "math" });
    },
  },
];

// Requires: KaTeX fonts available or fallback to Unicode
// Pi-tui's renderLatex uses KaTeX under the hood
```

**Markdown Input:**

```markdown
Inline: $E = mc^2$

Block:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

**Effort:** 2-3 hours (KaTeX integration, font handling)

---

### P1-5: Enhanced Markdown Theme (Code Actions, Callouts, Task Lists)

**Files:** `src/interactive-mode/theme/theme.ts` (`getMarkdownTheme()`)  
**Benefit:** Copy code button, callout blocks (note/warning), interactive task lists

**Implementation:**

```typescript
// In theme.ts, extend getMarkdownTheme():
export function getMarkdownTheme() {
  return {
    // ... existing ...

    // NEW: Code block actions
    codeBlockActions: [
      { label: "Copy", icon: "📋", action: (code) => copyToClipboard(code) },
      { label: "Run", icon: "▶", action: (code) => queueBashCommand(code) },
    ],

    // NEW: Callout rendering
    callout: (type: "note" | "warning" | "error" | "tip", content: string[]) => {
      const icons = { note: "💡", warning: "⚠️", error: "❌", tip: "💡" };
      const colors = { note: "accent", warning: "warning", error: "error", tip: "success" };
      return content.map((line) => theme.fg(colors[type], `${icons[type]} ${line}`));
    },

    // NEW: Task list with checkboxes
    taskList: (items: { checked: boolean; text: string }[]) =>
      items.map(({ checked, text }) =>
        theme.fg(checked ? "success" : "muted", `${checked ? "☑" : "☐"} ${text}`),
      ),
  };
}

// In markdown-transform.ts: Parse callout syntax (> [!NOTE] ...) and task lists (- [x] ...)
```

**Effort:** 3-4 hours

---

## 🔧 P2 — POLISH & CODE REDUCTION (Full day each)

### P2-1: Migrate SessionSelector to Pure SelectList + Input + Box

**Files:** Replace `src/interactive-mode/session-selector.ts` (528 lines)  
**Benefit:** ~400 lines removed, built-in virtualization, fuzzy search, keyboard nav

**Target Architecture:**

```typescript
// New file: session-picker.ts (~100 lines)
import { Box, Input, SelectList, fuzzyFilter, Text, Spacer } from "@earendil-works/pi-tui";
import { theme, accent, dim } from "./theme.ts";

export class SessionPicker extends Box {
  private search = new Input({ prompt: accent("❯ "), placeholder: "Search sessions…" });
  private list: SelectList;
  private sessions: SessionRecord[] = [];

  constructor(
    sessions: SessionRecord[],
    private onSelect: (id: string) => void,
    private onCancel: () => void,
  ) {
    super(2, 1);
    this.sessions = sessions;
    this.search.onSubmit = () => this.selectCurrent();
    this.list = new SelectList(this.buildItems(""), 15, {
      selectedPrefix: accent,
      selectedText: accent,
      description: dim,
      noMatch: () => dim("  No sessions found"),
    });
    this.list.onSelect = (item) => this.onSelect(item.value);
    this.list.onCancel = () => this.onCancel();

    this.addChild(new Text(accent("Sessions"), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(this.search);
    this.addChild(new Spacer(1));
    this.addChild(this.list);
  }

  private buildItems(query: string) {
    const filtered = fuzzyFilter(this.sessions, query, (s) => `${s.title} ${s.id} ${s.directory}`);
    return filtered.map((s) => ({
      value: s.id,
      label: s.title || s.id,
      description: dim(`${s.directory} · ${formatAge(s.modified)} · ${s.messageCount} msg`),
    }));
  }

  handleInput(data: string) {
    if (this.search.handleInput(data)) {
      this.list = new SelectList(this.buildItems(this.search.getValue()), 15, theme);
      this.list.onSelect = (item) => this.onSelect(item.value);
      this.invalidate();
    } else {
      this.list.handleInput(data);
    }
  }
}
```

**Migration Steps:**

1. Create `SessionPicker` component
2. Update `ui.ts` to use `SessionPicker` instead of `SessionSelector`
3. Delete `session-selector.ts`, `session-selector-search.ts`
4. Update imports in `components/index.ts`

**Effort:** 6-8 hours (testing all features: threaded tree, scope toggle, sort, multi-delete)

---

### P2-2: Migrate ModelSelector to Pure SelectList + Input + Box

**Files:** Replace `src/interactive-mode/model-selector.ts` (482 lines)  
**Benefit:** ~350 lines removed, consistent with session picker

**Target Architecture:** Similar to `SessionPicker` but with:

- Provider grouping (optgroups)
- Thinking level badge
- Default model indicator
- Ctrl+S save as default
- Ctrl+T test connection (custom action)

**Effort:** 5-6 hours

---

### P2-3: Migrate SearchPicker to Direct SelectList Usage

**Files:** `src/interactive-mode/picker.ts` (155 lines) → inline usage  
**Benefit:** Remove wrapper indirection, direct `SelectList` control

**Action:** Replace all `SearchPicker` instantiations with inline `SelectList` + `Input` + `Box` pattern. Update `commandMenu`, model picker, theme picker, etc.

**Effort:** 3-4 hours

---

### P2-4: Image Component for Declarative Images

**Files:** `src/interactive-mode/components/assistant-message.ts`, `src/interactive-mode/components/user-message.ts`  
**Benefit:** Declarative `<Image>` in message content, automatic protocol detection

```typescript
// In assistant-message.ts:
import { Image } from "@earendil-works/pi-tui";

// In updateContent():
if (content.type === "image") {
  addVisibleChild(
    new Image({
      src: content.url,
      width: 60,
      height: 30,
      alt: content.alt ?? "Image",
    }),
  );
}
```

**Effort:** 2-3 hours (depends on P1-1 image pipeline)

---

### P2-5: StdinBuffer for Custom Key Combinations

**Files:** `src/interactive-mode/tui-renderer.ts`, `src/interactive-mode/ui.ts`  
**Benefit:** Raw key event access for advanced combos (e.g., Ctrl+Shift+Key, leader keys)

```typescript
// In tui-renderer.ts:
import { StdinBuffer } from "@earendil-works/pi-tui";

export function createInteractiveTui(options: InteractiveTuiOptions = {}): TUI {
  const terminal = options.terminal ?? new ProcessTerminal();
  const stdinBuffer = new StdinBuffer(terminal.stdin, {
    // Capture raw key events before pi-tui processes them
  });

  // Custom key handling for leader-key sequences, etc.
  stdinBuffer.on("data", (key) => {
    if (key.ctrl && key.shift && key.code === "KeyP") {
      // Custom action
    }
  });

  // ... rest of TUI creation
}
```

**Effort:** 2-3 hours

---

### P2-6: Custom Editor Theme (Cursor, Line Numbers, Selection)

**Files:** `src/interactive-mode/theme/theme.ts` (`getEditorTheme()`)  
**Benefit:** Professional editor appearance matching VS Code/Neovim

```typescript
export function getEditorTheme() {
  return {
    borderColor: (x) => theme.fg("borderMuted", x),
    selectList: getSelectListTheme(),

    // NEW:
    cursor: (text) => theme.inverse(text), // Block cursor
    cursorLine: (text) => theme.bg("selectedBg", text), // Current line highlight
    lineNumber: (text) => theme.fg("dim", text), // Line numbers
    selection: (text) => theme.inverse(text), // Text selection
    matchingBracket: (text) => theme.underline(theme.fg("accent", text)),
    searchMatch: (text) => theme.inverse(theme.underline(text)),
    searchCurrentMatch: (text) => theme.bg("warning", theme.fg("text", text)),
  };
}
```

**Effort:** 2-3 hours (requires pi-tui Editor component support)

---

## 📦 DEPENDENCY CHECKLIST

### Already Available (pi-tui v1.5.2)

- [x] `HStack`, `VStack` — layout
- [x] `CancellableLoader` — spinners with cancel
- [x] `TruncatedText` — auto-expand text
- [x] `AltScreenSearch` — global search overlay
- [x] `SettingsList` — settings UI
- [x] `WheelScrollLines` — scroll tuning
- [x] `renderImage`, `detectCapabilities` — images
- [x] `Image` component — declarative images
- [x] `renderLatex` — math formulas
- [x] `StdinBuffer` — raw input
- [x] Full `SelectListTheme`, `MarkdownTheme`, `EditorTheme`

### May Need Updates

- [ ] pi-tui version pin: `"@earendil-works/pi-tui": "1.5.2"` → check for newer
- [ ] `lovely-mermaid` for PNG output (already in deps)
- [ ] KaTeX fonts for LaTeX (may need bundle)

---

## 🧪 TESTING STRATEGY

### Per-Feature Tests

```bash
# After each P0:
npm run check          # Format + lint + types
npm run build          # Bundle
node dist/cli.mjs --version
# Manual: run lazydsh, verify feature works
npm test               # 173 tests pass
```

### Integration Tests

- Mouse scroll in transcript (P0-1)
- Footer resize at various widths (P0-2)
- Cancel compaction/retry (P0-3)
- Expand/collapse tool output (P0-4)
- SettingsList all setting types (P1-3)
- Search transcript with AltScreenSearch (P1-2)
- Mermaid diagram renders as image (P1-1)
- LaTeX formulas render (P1-4)

### Regression Tests

- All existing keybindings work
- Theme switching works
- Session resume/select works
- Model selector works
- Tool approval flow works
- External editor (Ctrl+G) works

---

## 📅 SUGGESTED EXECUTION ORDER

### Week 1: P0 Quick Wins (Days 1-2)

| Day | Task                                                                        | Files                                                                  |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | P0-1 Mouse, P0-2 HStack Footer, P0-3 CancellableLoader                      | `tui-renderer.ts`, `footer.ts`, `status-indicator.ts`                  |
| 2   | P0-4 TruncatedText, P0-5 WheelScrollLines, P0-6 Input, P0-7 SelectListTheme | `bash-execution.ts`, `tui-renderer.ts`, `login-dialog.ts`, `picker.ts` |

### Week 2: P1 High Impact (Days 3-6)

| Day | Task                                        | Files                                                       |
| --- | ------------------------------------------- | ----------------------------------------------------------- |
| 3   | P1-3 SettingsList                           | New `settings-list-ui.ts`, replace `settings-selector.ts`   |
| 4   | P1-2 AltScreenSearch                        | New `transcript-search.ts`, `ui.ts` keybinding              |
| 5   | P1-4 LaTeX                                  | `markdown-transform.ts`, `theme.ts`                         |
| 6   | P1-5 Enhanced Markdown + P1-1 Image (start) | `theme.ts`, `markdown-transform.ts`, `assistant-message.ts` |

### Week 3: P1-1 Image Completion + P2 Migrations (Days 7-10)

| Day | Task                                            |
| --- | ----------------------------------------------- |
| 7   | Complete P1-1 Image pipeline (mermaid→PNG)      |
| 8   | P2-1 SessionSelector migration                  |
| 9   | P2-2 ModelSelector migration                    |
| 10  | P2-3 SearchPicker cleanup, P2-4 Image component |

### Week 4: P2 Polish (Days 11-13)

| Day | Task                                           |
| --- | ---------------------------------------------- |
| 11  | P2-5 StdinBuffer for custom keys               |
| 12  | P2-6 Editor theme                              |
| 13  | Full test suite, documentation update, cleanup |

---

## 🎯 SUCCESS CRITERIA

### Definition of Done

- [ ] All P0 items implemented and tested
- [ ] All P1 items implemented and tested
- [ ] At least 2 P2 items completed
- [ ] `npm run check` passes (0 warnings)
- [ ] `npm test` passes (173/173)
- [ ] Manual smoke test: launch, chat, search, settings, session resume
- [ ] No performance regression (idle <16ms, streaming <33ms)

### Metrics to Track

| Metric                      | Target                          |
| --------------------------- | ------------------------------- |
| Lines of custom picker code | < 200 (from ~1000)              |
| Settings UI code            | < 150 (from ~300)               |
| Image rendering support     | ✅ Mermaid, charts, screenshots |
| Transcript search           | ✅ Ctrl+F global search         |
| LaTeX support               | ✅ Inline + block math          |
| Mouse support               | ✅ Click, scroll, select        |
| Cancel long ops             | ✅ Compaction, retry            |

---

## 📝 NOTES & GOTCHAS

### Pi-tui Theme System — App Responsibility

**Pi-tui v1.5.2 has NO global theme system** — only component factories (`getMarkdownTheme()`, `getSelectListTheme()`, `getEditorTheme()`).  
**Lazydsh correctly implements** `src/interactive-mode/theme/theme.ts` as the app-level semantic token registry.  
See [PI-TUI THEME SYSTEM — CLARIFICATION](#-pi-tui-theme-system--clarification-2026-11-27) for details.

### Pi-tui Version Lock

Current: `"@earendil-works/pi-tui": "1.5.2"` (package.json:135)  
**Do not upgrade** without testing — breaking changes possible in:

- `SelectList` theme structure
- `Editor` theme API
- `AltScreenSearch` options
- `CancellableLoader` events

### Terminal Compatibility

| Feature   | Min Terminal       | Fallback              |
| --------- | ------------------ | --------------------- |
| Mouse     | xterm + kitty/SGR  | Disable gracefully    |
| Images    | Kitty/iTerm2/Sixel | Show link/placeholder |
| Truecolor | 24-bit color term  | 256-color palette     |
| Unicode   | Modern font        | ASCII fallback        |

### Performance Budgets

- First frame: < 500ms (currently ~122ms)
- Idle frame: < 16ms (currently ~2ms)
- Streaming frame: < 33ms (currently ~5ms)
- Memory idle: < 100MB (currently ~80MB)

**All changes must maintain these budgets.**

---

## 🔗 REFERENCES

- Pi-tui source: `node_modules/@earendil-works/pi-tui/dist/`
- Pi-tui exports: `node_modules/@earendil-works/pi-tui/dist/index.d.ts`
- Lazydsh AGENTS.md: Architecture guide
- AUDIT.md: UX gaps (§4)
- Keybinding config: `~/.config/lazydsh/keybindings.json`
- Theme config: `~/.config/lazydsh/theme.json`

---

_Generated from full codebase audit (149 TS files) on 2026-11-27.  
This roadmap represents the path to 100% pi-tui utilization._
