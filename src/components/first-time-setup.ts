/**
 * First Time Setup Component
 *
 * Onboarding dialog with two steps: pick a theme (live preview) and opt in to
 * anonymous usage analytics. Ported from pi-coding-agent's `first-time-setup.js`.
 */

import { Container, getKeybindings, Spacer, Text } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.js";
import { SYSTEM_THEME } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint, rawKeyHint } from "../keybinding-hints.js";

const THEME_OPTIONS = [
  { value: SYSTEM_THEME, label: "System (matches your terminal colors)" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const ANALYTICS_OPTIONS = [
  { value: true, label: "Share anonymous usage data" },
  { value: false, label: "Don't share" },
];

const SETUP_LOGO_LINES = ["██████", "██  ██", "████  ██", "██    ██"];

export interface FirstTimeSetupOptions {
  onThemePreview: (themeName: string) => void;
  onSubmit: (result: { theme: string; shareAnalytics: boolean }) => void;
  onCancel: () => void;
}

/**
 * First-time setup dialog: theme choice and analytics opt-in.
 */
export class FirstTimeSetupComponent extends Container {
  private step: "theme" | "analytics" = "theme";
  private themeIndex: number;
  private analyticsIndex = 0;
  private options: FirstTimeSetupOptions;

  constructor(options: FirstTimeSetupOptions) {
    super();
    this.options = options;
    this.themeIndex = 0;
    this.update();
  }

  /** Rebuild on theme changes, e.g. when the system theme receives the terminal's colors. */
  invalidate(): void {
    this.update();
    super.invalidate();
  }

  // Rebuild the whole dialog on every change so theme previews recolor all text.
  private update(): void {
    this.clear();
    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg("accent", SETUP_LOGO_LINES.join("\n")), 1, 0));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg("accent", theme.bold("Welcome to lazydsh.")), 1, 0));
    this.addChild(new Spacer(1));
    if (this.step === "theme") {
      this.addChild(new Text(theme.fg("text", "Pick a theme."), 1, 0));
      this.addChild(new Spacer(1));
      this.addOptionList(
        THEME_OPTIONS.map((option) => option.label),
        this.themeIndex,
      );
    } else {
      this.addChild(new Text(theme.fg("text", "Opt-in to anonymous usage data sharing?"), 1, 0));
      this.addChild(
        new Text(
          theme.fg(
            "muted",
            "Opting in stores a tracking identifier in settings.json and enables anonymous\nusage analytics. This helps us to better debug, reproduce, and resolve issues\nand bugs. You can observe what is shared and make changes anytime.",
          ),
          1,
          0,
        ),
      );
      this.addChild(new Spacer(1));
      this.addOptionList(
        ANALYTICS_OPTIONS.map((option) => option.label),
        this.analyticsIndex,
      );
    }
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        rawKeyHint("↑↓", "navigate") +
          "  " +
          keyHint("tui.select.confirm", this.step === "theme" ? "continue" : "finish") +
          "  " +
          keyHint("tui.select.cancel", "skip setup"),
        1,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
  }

  private addOptionList(labels: string[], selectedIndex: number): void {
    for (let i = 0; i < labels.length; i++) {
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? theme.fg("accent", "→ ") : "  ";
      const label = isSelected
        ? theme.fg("accent", labels[i] ?? "")
        : theme.fg("text", labels[i] ?? "");
      this.addChild(new Text(`${prefix}${label}`, 1, 0));
    }
  }

  private moveSelection(delta: number): void {
    if (this.step === "theme") {
      const next = Math.max(0, Math.min(THEME_OPTIONS.length - 1, this.themeIndex + delta));
      if (next !== this.themeIndex) {
        this.themeIndex = next;
        const option = THEME_OPTIONS[this.themeIndex];
        if (option) this.options.onThemePreview(option.value);
      }
    } else {
      this.analyticsIndex = Math.max(
        0,
        Math.min(ANALYTICS_OPTIONS.length - 1, this.analyticsIndex + delta),
      );
    }
    this.update();
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
      this.moveSelection(-1);
    } else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
      this.moveSelection(1);
    } else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      if (this.step === "theme") {
        this.step = "analytics";
        this.update();
      } else {
        const themeOption = THEME_OPTIONS[this.themeIndex];
        const analyticsOption = ANALYTICS_OPTIONS[this.analyticsIndex];
        this.options.onSubmit({
          theme: themeOption?.value ?? SYSTEM_THEME,
          shareAnalytics: analyticsOption?.value ?? false,
        });
      }
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.options.onCancel();
    }
  }
}
