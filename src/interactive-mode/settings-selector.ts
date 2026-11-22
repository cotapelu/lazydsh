import { Container, Text, Spacer, matchesKey } from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";
import { DynamicBorder } from "./components/dynamic-border.ts";
import { accent, dim } from "./theme/theme.ts";
import { keyHint } from "./keybinding-hints.ts";
import { keybindingsConfigPath } from "./keybindings.ts";
import { packageVersion } from "../utils/version.ts";

/** Settings categories. */
export type SettingsCategory = "general" | "appearance" | "keybindings" | "extensions" | "about";

interface SettingsItem {
  key: string;
  label: string;
  description: string;
  category: SettingsCategory;
  type: "toggle" | "select" | "text" | "info";
  value?: any;
  options?: { value: any; label: string }[];
  onChange?: (value: any) => void;
}

/** Settings selector component. */
export class SettingsSelectorComponent extends Container {
  readonly capturesViewportInput = true;
  private _focused = false;
  private currentCategory: SettingsCategory = "general";
  private selectedIndex = 0;
  private items: SettingsItem[] = [];
  private filteredItems: SettingsItem[] = [];
  private categories: { key: SettingsCategory; label: string }[] = [
    { key: "general", label: "General" },
    { key: "appearance", label: "Appearance" },
    { key: "keybindings", label: "Keybindings" },
    { key: "extensions", label: "Extensions" },
    { key: "about", label: "About" },
  ];

  private tui: { requestRender: () => void };

  /**
   * Extra values the launcher injects so the panel shows real state instead of
   * the placeholder defaults compiled into the component. `onToggle` fires for
   * every toggle flip so the launcher can persist the change.
   */
  constructor(
    tui: { requestRender: () => void },
    options: {
      currentTheme?: string;
      version?: string;
      confirmExit?: boolean;
      mermaidMode?: string;
      onToggle?: (key: string, value: boolean) => void;
      onSelect?: (key: string, value: string) => void;
    } = {},
  ) {
    super();
    this.tui = tui;
    this.onSelect = options.onSelect;
    this.initializeItems(
      options.currentTheme,
      options.version,
      options.confirmExit,
      options.mermaidMode,
    );
    this.onToggle = options.onToggle;
    this.rebuild();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  private initializeItems(
    currentTheme?: string,
    version?: string,
    confirmExit?: boolean,
    mermaidMode = "final",
  ): void {
    this.items = [
      // General
      {
        key: "autoCompact",
        label: "Auto-compact context",
        description: "On when the DSH context policy decides — not a TUI setting",
        category: "general",
        type: "info",
      },
      {
        key: "confirmExit",
        label: "Confirm on exit",
        description: "Ask for confirmation when pressing Ctrl+D or an idle Ctrl+C",
        category: "general",
        type: "toggle",
        value: confirmExit ?? false,
      },
      // Appearance
      {
        key: "theme",
        label: "Theme",
        description: "Color theme for the UI",
        category: "appearance",
        type: "select",
        value: currentTheme ?? "lazydsh",
        options: [
          { value: "lazydsh", label: "lazydsh (default)" },
          { value: "system", label: "System (follows terminal)" },
        ],
      },
      {
        key: "transparentBackground",
        label: "Background",
        description: "Set by the active theme — edit its JSON for a transparent background",
        category: "appearance",
        type: "info",
      },
      {
        key: "mermaidMode",
        label: "Mermaid diagrams",
        description: "Render ```mermaid blocks as Unicode diagrams — never, on completion, or live",
        category: "appearance",
        type: "select",
        value: mermaidMode,
        options: [
          { value: "off", label: "off" },
          { value: "final", label: "final (on completion)" },
          { value: "streaming", label: "streaming (live)" },
        ],
      },
      {
        key: "showLineNumbers",
        label: "Line numbers in code",
        description: "Not rendered by the Markdown component — theme and colors only",
        category: "appearance",
        type: "info",
      },
      // Keybindings
      {
        key: "keybindings",
        label: "Configure keybindings",
        description: "Open keybindings configuration file",
        category: "keybindings",
        type: "info",
      },
      // Extensions
      {
        key: "extensions",
        label: "Manage extensions",
        description: "View and configure installed extensions",
        category: "extensions",
        type: "info",
      },
      // About
      {
        key: "version",
        label: "Version",
        description: "lazydsh version information",
        category: "about",
        type: "info",
        value: version ?? packageVersion(),
      },
      {
        key: "github",
        label: "GitHub repository",
        description: "Open lazydsh on GitHub",
        category: "about",
        type: "info",
      },
      {
        key: "license",
        label: "License",
        description: "MIT License",
        category: "about",
        type: "info",
      },
    ];
    this.filterItems();
  }

  private filterItems(): void {
    this.filteredItems = this.items.filter((item) => item.category === this.currentCategory);
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredItems.length - 1));
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    this.addChild(new Spacer(1));

    // Category tabs
    const categoryTabs = this.categories
      .map((cat) => {
        const isActive = cat.key === this.currentCategory;
        const prefix = isActive ? accent("▸ ") : "  ";
        const label = isActive ? accent(cat.label) : cat.label;
        return `${prefix}${label}`;
      })
      .join(dim("  "));
    this.addChild(new Text(categoryTabs, 0, 0));
    this.addChild(new Spacer(1));

    // Settings list
    if (this.filteredItems.length === 0) {
      this.addChild(new Text(dim("  No settings in this category"), 0, 0));
    } else {
      for (let i = 0; i < this.filteredItems.length; i++) {
        const item = this.filteredItems[i];
        const isSelected = i === this.selectedIndex;
        const cursor = isSelected ? accent("› ") : "  ";

        let valueText = "";
        if (item.type === "toggle") {
          valueText = item.value ? accent("ON") : dim("OFF");
        } else if (item.type === "select") {
          valueText = accent(String(item.value));
        } else if (item.type === "info" && item.value) {
          valueText = accent(String(item.value));
        }

        const label = isSelected ? accent(item.label) : item.label;
        const desc = dim(item.description);
        const line = `${cursor}${label} ${valueText ? ` ${valueText}` : ""} ${desc}`;
        this.addChild(new Text(line, 0, 0));
      }
    }

    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        dim(
          `${keyHint("tui.input.tab", "category")} · ${keyHint("tui.select.up", "navigate")} · ${keyHint("tui.select.confirm", "toggle/edit")} · ${keyHint("tui.select.cancel", "back")}`,
        ),
        0,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
  }

  handleInput(data: string): void {
    if (matchesKey(data, "tab")) {
      // Cycle categories
      const currentIdx = this.categories.findIndex((c) => c.key === this.currentCategory);
      const nextIdx = (currentIdx + 1) % this.categories.length;
      this.currentCategory = this.categories[nextIdx].key;
      this.filterItems();
      this.rebuild();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "shift+tab")) {
      // Cycle categories backward
      const currentIdx = this.categories.findIndex((c) => c.key === this.currentCategory);
      const prevIdx = (currentIdx - 1 + this.categories.length) % this.categories.length;
      this.currentCategory = this.categories[prevIdx].key;
      this.filterItems();
      this.rebuild();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.rebuild();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "down")) {
      this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1);
      this.rebuild();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "enter")) {
      const item = this.filteredItems[this.selectedIndex];
      if (!item) return;

      // The launcher may own an item entirely (opening the real theme picker
      // instead of cycling the placeholder options here).
      if (this.onActivate?.(item.key) === true) return;

      if (item.type === "toggle") {
        item.value = !item.value;
        item.onChange?.(item.value);
        this.onToggle?.(item.key, Boolean(item.value));
        this.rebuild();
        this.tui.requestRender();
      } else if (item.type === "select" && item.options) {
        const currentIdx = item.options.findIndex((o) => o.value === item.value);
        const nextIdx = (currentIdx + 1) % item.options.length;
        item.value = item.options[nextIdx].value;
        item.onChange?.(item.value);
        this.onSelect?.(item.key, String(item.value));
        this.rebuild();
        this.tui.requestRender();
      } else if (item.type === "info") {
        if (item.key === "keybindings") {
          void this.openKeybindingsConfig();
        } else if (item.key === "github") {
          void this.openGitHub();
        }
      }
      return;
    }

    if (matchesKey(data, "escape")) {
      this.onCancel?.();
      return;
    }
  }

  private async openKeybindingsConfig(): Promise<void> {
    const { default: open } = await import("open");
    const configPath = keybindingsConfigPath();
    await open(configPath);
  }

  private async openGitHub(): Promise<void> {
    const { default: open } = await import("open");
    await open("https://github.com/nuskey8/lazydsh");
  }

  onCancel?: () => void;

  /**
   * Called on Enter for any item. Return `true` when the launcher handled the
   * activation itself (the built-in toggle/cycle is then skipped).
   */
  onActivate?: (key: string) => boolean | void;

  /** Called after a toggle flipped, with the new value. */
  onToggle?: (key: string, value: boolean) => void;

  /** Called after a select item cycled, with the new value. */
  onSelect?: (key: string, value: string) => void;
}
