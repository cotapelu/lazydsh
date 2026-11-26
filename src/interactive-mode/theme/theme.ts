/**
 * Theme
 *
 * Token-based theming with terminal color integration (DA1), live reload, and
 * fallbacks. Ported from pi-coding-agent's `modes/interactive/theme/theme.js`.
 *
 * The theme is a process-wide singleton behind a proxy, so every component
 * reads the same instance and a theme switch is visible everywhere.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import {
  backgroundAnsi,
  foregroundAnsi,
  getTerminalColorMode,
  parseColor,
  rgbColor,
  styleTextWithAnsi,
} from "@earendil-works/pi-tui";
import { THEME_TOKENS, type ThemeTokenName } from "./theme-tokens.ts";
import { validateTheme } from "./theme-schema.ts";
import {
  terminalColors,
  _terminalColorsPending,
  terminalColorsPending,
  terminalTheme,
  GUESSED_DEFAULTS,
} from "./system-theme.ts";
import { lazydshConfigDir } from "./theme-settings.ts";

// Re-export terminal color functions
export {
  setTerminalColors,
  setTerminalColorScheme,
  markTerminalColorsPending,
  terminalTheme,
} from "./system-theme.ts";

/** The generated theme that follows the terminal's own colors. */
export const SYSTEM_THEME = "system";
export const DEFAULT_THEME = "lazydsh";

type ColorValue = string | number;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ReportedColors {
  foreground?: Rgb;
  background?: Rgb;
  palette?: Rgb[];
}

// ── variable + fallback resolution ──

function resolveVarRefs(
  value: ColorValue,
  vars: Record<string, ColorValue>,
  visited = new Set<string>(),
): ColorValue {
  if (typeof value === "number" || value === "") return value;
  if (value.startsWith("#") || /^ok(lch|hsl)\(/i.test(value)) return value;
  if (visited.has(value)) throw new Error(`Circular variable reference detected: ${value}`);
  const next = vars[value];
  if (next === undefined) throw new Error(`Variable reference not found: ${value}`);
  visited.add(value);
  return resolveVarRefs(next, vars, visited);
}

function withThemeTokenFallbacks(values: Record<string, ColorValue>): Record<string, ColorValue> {
  const resolved = { ...values };
  for (const [name, descriptor] of Object.entries(THEME_TOKENS)) {
    const fallback = descriptor.fallback;
    if (fallback === undefined) continue;
    if (resolved[name] !== undefined) continue;
    const fallbackValue = resolved[fallback];
    // A theme that never declared the fallback's target (a minimal accent-only
    // theme, or the shipped dark/light files which omit `text`) used to make the
    // whole document unloadable. The chain's purpose is "reuse this other
    // token", and the terminal's own default is the only honest answer when
    // that token is absent too, so fall back to it rather than throwing.
    resolved[name] = fallbackValue ?? "";
  }
  // Ensure every registered token exists so themes that omit newer tokens
  // (e.g. dark/light) never crash at render time; missing values resolve to
  // the terminal's own default color.
  for (const name of Object.keys(THEME_TOKENS)) {
    if (resolved[name] === undefined) resolved[name] = "";
  }
  return resolved;
}

function resolveThemeColors(
  colors: Record<string, ColorValue>,
  vars: Record<string, ColorValue> = {},
) {
  const resolved: Record<string, ColorValue> = {};
  for (const [key, value] of Object.entries(colors)) resolved[key] = resolveVarRefs(value, vars);
  return resolved;
}

// ── Theme ──

export class Theme {
  readonly name: string;
  readonly sourcePath: string | undefined;
  readonly mode: ReturnType<typeof getTerminalColorMode>;
  private readonly dimTokens = new Set<ThemeTokenName>();
  private readonly fgAnsi = new Map<ThemeTokenName, string>();
  private readonly bgAnsi = new Map<ThemeTokenName, string>();
  private readonly concreteColors: Record<string, unknown> = {};
  private readonly defaultForegroundTokens: ThemeTokenName[] = [];
  private readonly defaultBackgroundTokens: ThemeTokenName[] = [];
  private readonly ownAppearance: "light" | "dark" | undefined;
  private resolved?: { terminal: ReportedColors; colors: Record<string, unknown> };

  constructor(
    colors: Record<string, ColorValue>,
    mode: ReturnType<typeof getTerminalColorMode>,
    options: {
      name?: string;
      sourcePath?: string;
      appearance?: "light" | "dark";
      dim?: ThemeTokenName[];
    } = {},
  ) {
    this.name = options.name ?? DEFAULT_THEME;
    this.sourcePath = options.sourcePath;
    this.mode = mode;
    this.ownAppearance = options.appearance;
    for (const token of options.dim ?? []) this.dimTokens.add(token);

    const resolved = withThemeTokenFallbacks(resolveThemeColors(colors));
    const foregrounds: Record<string, ColorValue> = {};
    const backgrounds: Record<string, ColorValue> = {};
    for (const [key, value] of Object.entries(resolved)) {
      if (THEME_TOKENS[key as ThemeTokenName]?.slot === "background") backgrounds[key] = value;
      else foregrounds[key] = value;
    }

    const concreteForegrounds: unknown[] = [];
    const concreteBackgrounds: unknown[] = [];
    const add = (token: ThemeTokenName, value: ColorValue, isBackground: boolean): string => {
      if (value === "") {
        (isBackground ? this.defaultBackgroundTokens : this.defaultForegroundTokens).push(token);
        return isBackground ? "\x1b[49m" : "\x1b[39m";
      }
      const color = parseColor(value);
      this.concreteColors[token] = color;
      (isBackground ? concreteBackgrounds : concreteForegrounds).push(color);
      return isBackground ? backgroundAnsi(color, mode) : foregroundAnsi(color, mode);
    };
    for (const [token, value] of Object.entries(foregrounds))
      this.fgAnsi.set(token as ThemeTokenName, add(token as ThemeTokenName, value, false));
    for (const [token, value] of Object.entries(backgrounds))
      this.bgAnsi.set(token as ThemeTokenName, add(token as ThemeTokenName, value, true));
  }

  get appearance(): "light" | "dark" {
    return this.ownAppearance ?? terminalTheme();
  }

  /** Concrete colors, with terminal defaults filled in for `""` tokens. */
  get colors(): Record<string, unknown> {
    if (this.resolved?.terminal !== terminalColors) {
      const guess = GUESSED_DEFAULTS[this.appearance];
      const foreground = terminalColors.foreground
        ? rgbColor(
            terminalColors.foreground.r,
            terminalColors.foreground.g,
            terminalColors.foreground.b,
          )
        : guess.foreground;
      const background = terminalColors.background
        ? rgbColor(
            terminalColors.background.r,
            terminalColors.background.g,
            terminalColors.background.b,
          )
        : guess.background;
      const colors: Record<string, unknown> = { ...this.concreteColors };
      for (const token of this.defaultForegroundTokens) colors[token] = foreground;
      for (const token of this.defaultBackgroundTokens) colors[token] = background;
      this.resolved = { terminal: terminalColors, colors: Object.freeze(colors) };
    }
    return this.resolved.colors;
  }

  fg(token: ThemeTokenName, text: string): string {
    const ansi = this.fgAnsi.get(token);
    if (ansi === undefined) throw new Error(`Unknown theme color: ${token}`);
    return this.dimTokens.has(token)
      ? `${ansi}\x1b[2m${text}\x1b[22;39m`
      : `${ansi}${text}\x1b[39m`;
  }

  bg(token: ThemeTokenName, text: string): string {
    const ansi = this.bgAnsi.get(token);
    if (ansi === undefined) throw new Error(`Unknown theme color: ${token}`);
    return `${ansi}${text}\x1b[49m`;
  }

  style(
    text: string,
    options: { fg?: ThemeTokenName; bg?: ThemeTokenName; dim?: boolean },
  ): string {
    const fgAnsi =
      options.fg === undefined
        ? undefined
        : this.dimTokens.has(options.fg)
          ? `${this.fgAnsi.get(options.fg)!}\x1b[2m`
          : this.fgAnsi.get(options.fg)!;
    const bgAnsi = options.bg === undefined ? undefined : this.bgAnsi.get(options.bg)!;
    return styleTextWithAnsi(text, fgAnsi, bgAnsi, options);
  }

  bold(text: string): string {
    return `\x1b[1m${text}\x1b[22m`;
  }
  italic(text: string): string {
    return `\x1b[3m${text}\x1b[23m`;
  }
  underline(text: string): string {
    return `\x1b[4m${text}\x1b[24m`;
  }
  inverse(text: string): string {
    return `\x1b[7m${text}\x1b[27m`;
  }
  strikethrough(text: string): string {
    return `\x1b[9m${text}\x1b[29m`;
  }
}

/** Generate the system theme from the terminal's reported colors. */
function createSystemTheme(mode: ReturnType<typeof getTerminalColorMode>): Theme {
  const palette = terminalColors.palette ?? [];
  const pick = (index: number, fallback: string): string => {
    const color = palette[index];
    return color === undefined
      ? fallback
      : `#${[color.r, color.g, color.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const saturation = terminalColorsPending ? 0 : 1;
  const grayscale = (hex: string): string => {
    if (saturation === 1) return hex;
    const color = parseColor(hex) as { r: number; g: number; b: number };
    const luma = Math.round(0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b);
    return `#${[luma, luma, luma].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const colors: Record<string, ColorValue> = {
    accent: grayscale(pick(4, "#4d6bfe")),
    success: grayscale(pick(2, "#50fa7b")),
    error: grayscale(pick(1, "#ff5555")),
    warning: grayscale(pick(3, "#ffb400")),
    muted: "#8a8f96",
    dim: "#5f646a",
    syntaxKeyword: grayscale(pick(5, "#ff79c6")),
    syntaxString: grayscale(pick(6, "#f1fa8c")),
    syntaxComment: "#6272a4",
    syntaxFunction: grayscale(pick(2, "#50fa7b")),
    syntaxNumber: grayscale(pick(4, "#bd93f9")),
    syntaxType: grayscale(pick(6, "#8be9fd")),
    toolDiffAdded: grayscale(pick(2, "#64ff64")),
    toolDiffRemoved: grayscale(pick(1, "#ff6464")),
    thinkingLow: grayscale(pick(2, "#50fa7b")),
    thinkingMedium: grayscale(pick(3, "#f1fa8c")),
    thinkingHigh: grayscale(pick(3, "#ffb86c")),
    thinkingXhigh: grayscale(pick(5, "#ff79c6")),
    bashMode: grayscale(pick(3, "#ffb86c")),
  };
  return new Theme(colors, mode, { name: SYSTEM_THEME });
}

// ── loading ──

function themesDir(): string {
  // `new URL(".", import.meta.url)` is already this module's directory — the
  // one holding the built-in theme JSONs (and, in the bundle, `dist/`, where
  // postbuild copies them). `fileURLToPath` decodes percent-escapes, which
  // `new URL(...).pathname` does not, so an install path containing a space or
  // a non-ASCII character used to resolve to a path that does not exist on
  // Windows and made the built-in themes unloadable there.
  return fileURLToPath(new URL(".", import.meta.url));
}

/**
 * Where user-authored themes live.
 *
 * Resolved through the shared config root so themes, keybindings, the theme
 * selection and UI settings all live under one directory (see
 * `theme-settings.ts#configDir`).
 */
export function customThemesDir(): string {
  return join(lazydshConfigDir(), "themes");
}

function loadThemeJson(name: string): unknown {
  const builtIn = path.join(themesDir(), `${name}.json`);
  if (fs.existsSync(builtIn)) return JSON.parse(fs.readFileSync(builtIn, "utf-8"));
  const custom = path.join(customThemesDir(), `${name}.json`);
  if (fs.existsSync(custom)) {
    // Built-ins ship with the app and stay unvalidated for startup cost;
    // user-authored documents are the ones that need the schema check.
    const doc = JSON.parse(fs.readFileSync(custom, "utf-8"));
    validateTheme(doc);
    return doc;
  }
  throw new Error(`Theme not found: ${name}`);
}

function createTheme(
  json: unknown,
  mode?: ReturnType<typeof getTerminalColorMode>,
  sourcePath?: string,
): Theme {
  const doc = json as {
    name?: string;
    colors: Record<string, ColorValue>;
    vars?: Record<string, ColorValue>;
    appearance?: "light" | "dark";
  };
  const resolved = withThemeTokenFallbacks(resolveThemeColors(doc.colors, doc.vars));
  const appearance = doc.appearance;
  return new Theme(resolved, mode ?? getTerminalColorMode(), {
    name: doc.name,
    sourcePath,
    ...(appearance === undefined ? {} : { appearance }),
  });
}

function loadTheme(name: string): Theme {
  if (name === SYSTEM_THEME) return createSystemTheme(getTerminalColorMode());
  return createTheme(loadThemeJson(name));
}

export interface ThemeInfo {
  name: string;
  path: string | undefined;
}

function getAvailableThemeInfos(): ThemeInfo[] {
  const result: ThemeInfo[] = [];
  const seen = new Set<string>();
  const addTheme = (themeInfo: ThemeInfo) => {
    if (seen.has(themeInfo.name)) return;
    seen.add(themeInfo.name);
    result.push(themeInfo);
  };
  // Built-in themes
  addTheme({ name: SYSTEM_THEME, path: undefined });
  try {
    for (const file of fs.readdirSync(themesDir())) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -5);
      addTheme({ name, path: path.join(themesDir(), file) });
    }
  } catch {}
  // Custom themes
  try {
    for (const file of fs.readdirSync(customThemesDir())) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -5);
      addTheme({ name, path: path.join(customThemesDir(), file) });
    }
  } catch {}
  // Sort: system theme first, then alphabetically
  result.sort((a, b) =>
    a.name === SYSTEM_THEME ? -1 : b.name === SYSTEM_THEME ? 1 : a.name.localeCompare(b.name),
  );
  return result;
}

export function getAvailableThemesWithPaths(): ThemeInfo[] {
  return getAvailableThemeInfos();
}

export function getAvailableThemes(): string[] {
  return getAvailableThemeInfos().map(({ name }) => name);
}

let currentTheme: Theme | undefined;
let currentThemeName = DEFAULT_THEME;
let changeCallback: (() => void) | undefined;

export function initTheme(themeName = DEFAULT_THEME): void {
  currentThemeName = themeName;
  try {
    currentTheme = loadTheme(themeName);
  } catch {
    currentThemeName = DEFAULT_THEME;
    currentTheme = loadTheme(DEFAULT_THEME);
  }
}

export function setTheme(
  name: string,
  _enableWatcher = false,
): { success: boolean; error?: string } {
  currentThemeName = name;
  try {
    currentTheme = loadTheme(name);
    changeCallback?.();
    return { success: true };
  } catch (error) {
    currentThemeName = DEFAULT_THEME;
    currentTheme = loadTheme(DEFAULT_THEME);
    changeCallback?.();
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function setThemeInstance(instance: Theme): void {
  currentTheme = instance;
  currentThemeName = "<in-memory>";
  changeCallback?.();
}

export function onThemeChange(callback: () => void): void {
  changeCallback = callback;
}

export function currentThemeName_(): string {
  return currentThemeName;
}

// ── global proxy ──

function active(): Theme {
  if (currentTheme === undefined) initTheme();
  return currentTheme!;
}

export const theme = new Proxy({} as Theme, {
  get(_target, prop) {
    const value: unknown = Reflect.get(active(), prop as keyof Theme);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(active())
      : value;
  },
});

/**
 * `fg` as a per-token object, for call sites that only need `fg(token, text)`.
 * Each property resolves against the active theme on every call, so a theme
 * switch is picked up without rebuilding the object.
 */
export type FgColors = {
  [K in ThemeTokenName]: (text: string) => string;
};

export const fg: FgColors = new Proxy({} as FgColors, {
  get(_target, token: string) {
    return (text: string) => active().fg(token as ThemeTokenName, text);
  },
});

/** Dark or light from what the terminal has reported so far. */
export function safeText(value: unknown): string {
  // Preserve newlines (\n) and tabs (\t); other control characters would move
  // the cursor when the string is rendered.
  return stripVTControlCharacters(String(value)).replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\b\u000b-\u001f\u007f]/gu,
    "",
  );
}

export function terminalColor(stream: { isTTY?: boolean }): boolean {
  return Boolean(stream.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb");
}

export function formatNotification(label: string, text: unknown = "", color = true): string {
  const icon = /error/i.test(label) ? "✗" : "✓";
  const prefix = String(label).toLowerCase();
  const body = String(text);
  const head = body ? prefix + ":" : prefix;
  const t = active();
  return `${color ? t.fg("accent", icon) : icon} ${color ? t.fg("dim", head) : head}${body ? " " + body : ""}`;
}

// ── component themes ──

export function getMarkdownTheme() {
  const t = active();
  return {
    heading: (text: string) => t.fg("mdHeading", text),
    link: (text: string) => t.fg("mdLink", text),
    linkUrl: (text: string) => t.fg("mdLinkUrl", text),
    code: (text: string) => t.fg("mdCode", text),
    codeBlock: (text: string) => t.fg("mdCodeBlock", text),
    codeBlockBorder: (text: string) => t.fg("mdCodeBlockBorder", text),
    quote: (text: string) => t.fg("mdQuote", text),
    quoteBorder: (text: string) => t.fg("mdQuoteBorder", text),
    hr: (text: string) => t.fg("mdHr", text),
    listBullet: (text: string) => t.fg("mdListBullet", text),
    bold: (text: string) => t.bold(text),
    italic: (text: string) => t.italic(text),
    underline: (text: string) => t.underline(text),
    strikethrough: (text: string) => t.strikethrough(text),
  };
}

export function getSelectListTheme() {
  const t = active();
  return {
    selectedPrefix: (text: string) => t.fg("accent", text),
    selectedText: (text: string) => t.fg("accent", text),
    description: (text: string) => t.fg("muted", text),
    scrollInfo: (text: string) => t.fg("muted", text),
    noMatch: (text: string) => t.fg("muted", text),
  };
}

export function getEditorTheme() {
  const t = active();
  return {
    borderColor: (text: string) => t.fg("borderMuted", text),
    selectList: getSelectListTheme(),
  };
}

export type { ThemeTokenName };
export { THEME_TOKENS };

/** Convenience functions that delegate to the active theme. */
export const accent = (text: string) => active().fg("accent", text);
export const dim = (text: string) => active().fg("dim", text);
export const bold = (text: string) => active().bold(text);
export const muted = (text: string) => active().fg("muted", text);
export const warning = (text: string) => active().fg("warning", text);
export const error = (text: string) => active().fg("error", text);
export const success = (text: string) => active().fg("success", text);
