/**
 * Theme Controller
 *
 * Applies a theme setting and keeps it in sync with the terminal. The theme
 * applies immediately from the JSON on disk; the terminal's reported colors
 * (DA1) fill in the tokens declared as `""` and decide light/dark for the
 * system theme and for `light/dark` pairs. Ported from pi-coding-agent's
 * `InteractiveThemeController`.
 */

import { existsSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import type { TUI, TerminalColors } from "@earendil-works/pi-tui";
import {
  customThemesDir,
  initTheme,
  markTerminalColorsPending,
  onThemeChange,
  setTerminalColors,
  setTerminalColorScheme,
  setTheme,
  SYSTEM_THEME,
} from "./theme.ts";
import { writeThemeSetting } from "./theme-settings.ts";

/** How long the terminal has to answer the DA1 color query. */
const TERMINAL_QUERY_TIMEOUT_MS = 100;

const DEFAULT_THEME = "lazydsh";

export interface ThemeSettingsManager {
  getThemeSetting(): string | undefined;
}

export interface ThemeControllerOptions {
  getSettingsManager: () => ThemeSettingsManager;
  showError: (message: string) => void;
  onChanged: () => void;
  initialThemeSetting?: string;
}

/** Same shape as `TerminalColors`, minus the parts we never read. */
type ReportedColors = Pick<TerminalColors, "foreground" | "background" | "palette">;

export class ThemeController {
  private ui: TUI;
  private readonly getSettingsManager: () => ThemeSettingsManager;
  private readonly showError: (message: string) => void;
  private readonly onChanged: () => void;
  private currentThemeSetting: string | undefined;

  private terminalColors: ReportedColors = {};
  private activeThemeName = DEFAULT_THEME;
  private autoSyncEnabled = false;
  private colorSchemeUnsubscribe: (() => void) | undefined;

  /** Settles when the latest color query completed or timed out. */
  private terminalColorQuery = Promise.resolve();
  private watcher: FSWatcher | undefined;
  private watchedThemeName: string | undefined;

  constructor(ui: TUI, options: ThemeControllerOptions) {
    this.ui = ui;
    this.getSettingsManager = options.getSettingsManager;
    this.showError = options.showError;
    this.onChanged = options.onChanged;
    this.currentThemeSetting = options.initialThemeSetting;

    // The system theme renders in grayscale until the terminal reports colors.
    markTerminalColorsPending();
    this.activeThemeName = this.resolveThemeName();
    initTheme(this.activeThemeName);
    this.bindColorSchemeListener();
  }

  /** Rebind after a TUI mode switch. */
  rebindTui(ui: TUI): void {
    this.ui = ui;
    this.colorSchemeUnsubscribe?.();
    this.bindColorSchemeListener();
    this.ui.setTerminalColorSchemeNotifications(this.autoSyncEnabled);
  }

  dispose(): void {
    this.setAutoSync(false);
    this.colorSchemeUnsubscribe?.();
    this.colorSchemeUnsubscribe = undefined;
    this.stopWatching();
  }

  /** Apply the setting now and query the terminal's colors. */
  applyFromSettings(): void {
    const themeName = this.resolveThemeName();
    this.setAutoSync(this.getThemeSetting()?.includes("/") === true);
    this.applyThemeName(themeName, false);
    this.queryTerminalColors();
  }

  /**
   * Wait until the latest color query completed or timed out. Content that
   * bakes theme colors into strings (the startup header) should wait for this.
   */
  waitForTerminalColors(): Promise<void> {
    return this.terminalColorQuery;
  }

  getThemeSetting(): string | undefined {
    return this.getSettingsManager().getThemeSetting();
  }

  setThemeName(themeName: string, showError = false): { success: boolean; error?: string } {
    const result = setTheme(themeName, true);
    if (!result.success) {
      if (showError) this.showError(`Failed to load theme "${themeName}": ${result.error}`);
      return result;
    }
    writeThemeSetting(themeName);
    this.activeThemeName = themeName;
    this.startWatching(themeName);
    this.setAutoSync(false);
    this.notifyChanged();
    return result;
  }

  setThemeSetting(themeSetting: string): void {
    writeThemeSetting(themeSetting);
    this.currentThemeSetting = themeSetting;
    const themeName = this.resolveThemeSetting(themeSetting) ?? DEFAULT_THEME;
    this.setAutoSync(themeSetting.includes("/"));
    this.applyThemeName(themeName, false);
    this.queryTerminalColors();
  }

  /** Preview a theme without persisting it. */
  preview(themeSettingOrName: string): void {
    const themeName = this.resolveThemeSetting(themeSettingOrName) ?? themeSettingOrName;
    const previous = this.activeThemeName;
    const result = this.applyThemeName(themeName, false);
    if (!result.success) this.applyThemeName(previous, false);
  }

  disableAutoSync(): void {
    this.setAutoSync(false);
  }

  get activeTheme(): string {
    return this.activeThemeName;
  }

  // ─── internals ───

  private resolveThemeName(): string {
    return this.resolveThemeSetting(this.getThemeSetting()) ?? DEFAULT_THEME;
  }

  private applyThemeName(
    themeName: string,
    showError = false,
  ): { success: boolean; error?: string } {
    const result = setTheme(themeName, true);
    this.activeThemeName = result.success ? themeName : DEFAULT_THEME;
    // Track the applied theme so an edit on disk is picked up without a
    // restart. The watcher used to be dead code: nothing ever called
    // startWatching, so the documented live-reload never happened.
    this.startWatching(this.activeThemeName);
    this.notifyChanged();
    if (!result.success && showError)
      this.showError(
        `Failed to load theme "${themeName}": ${result.error}\nFell back to the default theme.`,
      );
    return result;
  }

  private parseAutoThemeSetting(
    setting: string | undefined,
  ): { light: string; dark: string } | undefined {
    if (!setting) return undefined;
    const slash = setting.indexOf("/");
    if (slash === -1 || setting.indexOf("/", slash + 1) !== -1) return undefined;
    const light = setting.slice(0, slash).trim();
    const dark = setting.slice(slash + 1).trim();
    return light && dark ? { light, dark } : undefined;
  }

  private resolveThemeSetting(setting: string | undefined): string | undefined {
    const auto = this.parseAutoThemeSetting(setting);
    if (auto) return this.terminalAppearance() === "light" ? auto.light : auto.dark;
    if (setting?.includes("/")) return undefined;
    return typeof setting === "string" ? setting : undefined;
  }

  private setAutoSync(enabled: boolean): void {
    if (this.autoSyncEnabled === enabled) return;
    this.autoSyncEnabled = enabled;
    this.ui.setTerminalColorSchemeNotifications(enabled);
  }

  private bindColorSchemeListener(): void {
    this.colorSchemeUnsubscribe = this.ui.onTerminalColorSchemeChange((scheme) =>
      this.applyColorSchemeChange(scheme),
    );
  }

  private applyColorSchemeChange(scheme: "light" | "dark"): void {
    if (!this.autoSyncEnabled) return;
    const previous = this.terminalAppearance();
    setTerminalColorScheme(scheme);
    if (this.terminalAppearance() !== previous) this.reapplyForTerminal();
    this.queryTerminalColors();
  }

  private reapplyForTerminal(): void {
    const themeName = this.resolveThemeName();
    if (themeName === SYSTEM_THEME || themeName !== this.activeThemeName)
      this.applyThemeName(themeName);
  }

  private queryTerminalColors(): void {
    this.terminalColorQuery = this.requestTerminalColors(this.ui, (colors) =>
      this.applyTerminalColors(colors),
    );
  }

  private async requestTerminalColors(
    ui: TUI,
    apply: (colors: ReportedColors) => void,
  ): Promise<void> {
    let query: Promise<ReportedColors>;
    try {
      query = ui.queryTerminalColors({
        timeoutMs: TERMINAL_QUERY_TIMEOUT_MS,
        onLateReply: apply,
      }) as Promise<ReportedColors>;
    } catch {
      // A failed query behaves like a terminal that reports no colors.
      query = Promise.resolve({});
    }
    await query.then(apply, () => apply({}));
  }

  private applyTerminalColors(reported: ReportedColors): void {
    const previous = this.terminalColors;
    const next: ReportedColors = {
      foreground: reported.foreground ?? previous.foreground,
      background: reported.background ?? previous.background,
      palette: reported.palette ?? previous.palette,
    };
    // Re-rendering rebuilds every component, so skip a no-op report.
    if (previous && sameTerminalColors(previous, next)) return;
    this.terminalColors = next;
    setTerminalColors(next);
    this.reapplyForTerminal();
    this.ui.invalidate();
    this.ui.requestRender();
  }

  private terminalAppearance(): "light" | "dark" {
    const { background } = this.terminalColors;
    if (background === undefined) return "dark";
    const lightness = (0.2126 * background.r + 0.7152 * background.g + 0.0722 * background.b) / 255;
    return lightness > 0.5 ? "light" : "dark";
  }

  private notifyChanged(): void {
    this.ui.invalidate();
    this.onChanged();
  }

  /** Watch a custom theme file so edits re-apply without a restart. */
  private startWatching(themeName: string): void {
    this.stopWatching();
    if (themeName === DEFAULT_THEME || themeName === SYSTEM_THEME) return;
    const directory = customThemesDir();
    const file = join(directory, `${themeName}.json`);
    if (!existsSync(file)) return;
    this.watchedThemeName = themeName;
    let timer: NodeJS.Timeout | undefined;
    this.watcher = watch(directory, (_event, filename) => {
      if (this.watchedThemeName !== themeName) return;
      if (filename !== `${themeName}.json`) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (this.watchedThemeName !== themeName || !existsSync(file)) return;
        setTheme(themeName, false);
        this.notifyChanged();
      }, 100);
    });
  }

  private stopWatching(): void {
    this.watcher?.close();
    this.watcher = undefined;
    this.watchedThemeName = undefined;
  }
}

export function sameRgb(a: ReportedColors["foreground"], b: ReportedColors["foreground"]): boolean {
  return (
    a === b || (a !== undefined && b !== undefined && a.r === b.r && a.g === b.g && a.b === b.b)
  );
}

function sameTerminalColors(a: ReportedColors, b: ReportedColors): boolean {
  if (!sameRgb(a.foreground, b.foreground) || !sameRgb(a.background, b.background)) return false;
  if (a.palette === b.palette) return true;
  if (!a.palette || !b.palette || a.palette.length !== b.palette.length) return false;
  return a.palette.every((color, index) => sameRgb(color, b.palette?.[index]));
}

/** Theme change notifications for components that cache themed strings. */
export function watchThemeChanges(callback: () => void): void {
  onThemeChange(callback);
}
