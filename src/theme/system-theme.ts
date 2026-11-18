/**
 * System Theme
 *
 * Generates a theme from the terminal's reported colors (DA1).
 * Ported from pi-coding-agent's system-theme.js.
 */

import {
  backgroundAnsi,
  colorToHex,
  foregroundAnsi,
  getTerminalColorMode,
  mixColors,
  parseColor,
  rgbColor,
  styleTextWithAnsi,
  type Color,
} from "@earendil-works/pi-tui";
import { THEME_TOKENS } from "./theme-tokens.js";

export const SYSTEM_THEME_NAME = "system";

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

export let terminalColors: ReportedColors = {};
export let _terminalColorsPending = false;
export let terminalColorsPending = false;
export let terminalColorScheme: "light" | "dark" | undefined;

export function setTerminalColors(colors: ReportedColors): void {
  terminalColors = { ...colors };
  _terminalColorsPending = false;
  terminalColorsPending = false;
}

export function setTerminalColorScheme(scheme: "light" | "dark"): void {
  terminalColorScheme = scheme;
}

export function markTerminalColorsPending(): void {
  _terminalColorsPending = true;
  terminalColorsPending = true;
}

export function terminalTheme(): "light" | "dark" {
  const { background } = terminalColors;
  if (background !== undefined) {
    const lightness = (0.2126 * background.r + 0.7152 * background.g + 0.0722 * background.b) / 255;
    return lightness > 0.5 ? "light" : "dark";
  }
  return terminalColorScheme ?? "dark";
}

export const GUESSED_DEFAULTS = {
  dark: { foreground: parseColor("#e5e5e7"), background: parseColor("#000000") },
  light: { foreground: parseColor("#000000"), background: parseColor("#ffffff") },
};

function resolveVarRefs(
  value: string | number,
  vars: Record<string, string | number>,
  visited = new Set<string>(),
): string | number {
  if (typeof value === "number" || value === "") return value;
  if (value.startsWith("#") || /^ok(lch|hsl)\(/i.test(value)) return value;
  if (visited.has(value)) throw new Error(`Circular variable reference detected: ${value}`);
  const next = vars[value];
  if (next === undefined) throw new Error(`Variable reference not found: ${value}`);
  visited.add(value);
  return resolveVarRefs(next, vars, visited);
}

function withThemeTokenFallbacks(
  values: Record<string, string | number>,
): Record<string, string | number> {
  const resolved = { ...values };
  for (const [name, descriptor] of Object.entries(THEME_TOKENS)) {
    if (!("fallback" in descriptor)) continue;
    if (resolved[name] !== undefined) continue;
    const fallback = descriptor.fallback;
    if (fallback === undefined) continue;
    const fallbackValue = resolved[fallback];
    if (fallbackValue === undefined) {
      throw new Error(`Theme token ${name} has unresolved fallback ${fallback}`);
    }
    resolved[name] = fallbackValue;
  }
  return resolved;
}

function resolveThemeColors(
  colors: Record<string, string | number>,
  vars: Record<string, string | number> = {},
): Record<string, string | number> {
  const resolved: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(colors)) resolved[key] = resolveVarRefs(value, vars);
  return resolved;
}

function splitThemeColors(colors: Record<string, string | number>): {
  fgColors: Record<string, string | number>;
  bgColors: Record<string, string | number>;
} {
  const fgColors: Record<string, string | number> = {};
  const bgColors: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(colors)) {
    const descriptor = THEME_TOKENS[key];
    if (descriptor?.slot === "background") {
      bgColors[key] = value;
    } else {
      fgColors[key] = value;
    }
  }
  return { fgColors, bgColors };
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export class Theme {
  readonly name: string;
  readonly sourcePath: string | undefined;
  readonly mode: ReturnType<typeof getTerminalColorMode>;
  private readonly dimTokens = new Set<string>();
  private readonly fgAnsi = new Map<string, string>();
  private readonly bgAnsi = new Map<string, string>();
  private readonly concreteColors: Record<string, unknown> = {};
  private readonly defaultForegroundTokens: string[] = [];
  private readonly defaultBackgroundTokens: string[] = [];
  private readonly ownAppearance: "light" | "dark" | undefined;
  private resolved?: { terminal: ReportedColors; colors: Record<string, unknown> };

  constructor(
    colors: Record<string, string | number>,
    mode: ReturnType<typeof getTerminalColorMode>,
    options: {
      name?: string;
      sourcePath?: string;
      appearance?: "light" | "dark";
      dim?: string[];
    } = {},
  ) {
    this.name = options.name ?? "unknown";
    this.sourcePath = options.sourcePath;
    this.mode = mode;
    this.ownAppearance = options.appearance;
    for (const token of options.dim ?? []) this.dimTokens.add(token);

    const resolved = withThemeTokenFallbacks(resolveThemeColors(colors));
    const { fgColors, bgColors } = splitThemeColors(resolved);
    const concreteForegrounds: unknown[] = [];
    const concreteBackgrounds: unknown[] = [];

    const addToken = (token: string, value: string | number, isBackground: boolean): string => {
      if (value === "") {
        (isBackground ? this.defaultBackgroundTokens : this.defaultForegroundTokens).push(token);
        return isBackground ? "\x1b[49m" : "\x1b[39m";
      }
      const color = parseColor(value);
      this.concreteColors[token] = color;
      (isBackground ? concreteBackgrounds : concreteForegrounds).push(color);
      return isBackground ? backgroundAnsi(color, mode) : foregroundAnsi(color, mode);
    };
    for (const [token, value] of Object.entries(fgColors))
      this.fgAnsi.set(token, addToken(token, value, false));
    for (const [token, value] of Object.entries(bgColors))
      this.bgAnsi.set(token, addToken(token, value, true));
  }

  get appearance(): "light" | "dark" {
    return this.ownAppearance ?? terminalTheme();
  }

  get colors(): Record<string, unknown> {
    const terminal = terminalColors;
    if (this.resolved?.terminal !== terminal) {
      const guess = GUESSED_DEFAULTS[this.appearance];
      const foreground =
        terminal.foreground !== undefined
          ? rgbColor(terminal.foreground.r, terminal.foreground.g, terminal.foreground.b)
          : guess.foreground;
      const background =
        terminal.background !== undefined
          ? rgbColor(terminal.background.r, terminal.background.g, terminal.background.b)
          : guess.background;
      const colors = { ...this.concreteColors };
      for (const token of this.defaultForegroundTokens) colors[token] = foreground;
      for (const token of this.defaultBackgroundTokens) colors[token] = background;
      for (const token of this.dimTokens) {
        const color = colors[token] as Color;
        if (color) colors[token] = mixColors(parseColor(colorToHex(color)), background, 0.4);
      }
      this.resolved = { terminal, colors: Object.freeze(colors) };
    }
    return this.resolved.colors;
  }

  style(text: string, options: { fg?: string; bg?: string; dim?: boolean }): string {
    const { fg, bg } = options;
    if (typeof fg === "string" && this.dimTokens.has(fg)) options = { ...options, dim: true };
    return styleTextWithAnsi(
      text,
      fg === undefined
        ? undefined
        : typeof fg === "string"
          ? this.tokenAnsi(this.fgAnsi, fg)
          : foregroundAnsi(fg, this.mode),
      bg === undefined
        ? undefined
        : typeof bg === "string"
          ? this.tokenAnsi(this.bgAnsi, bg)
          : backgroundAnsi(bg, this.mode),
      options,
    );
  }

  tokenAnsi(map: Map<string, string>, token: string): string {
    const ansi = map.get(token);
    if (ansi === undefined) throw new Error(`Unknown theme color: ${token}`);
    return ansi;
  }

  fg(token: string, text: string): string {
    const ansi = this.fgAnsi.get(token);
    if (ansi === undefined) throw new Error(`Unknown theme color: ${token}`);
    return this.dimTokens.has(token)
      ? `${ansi}\x1b[2m${text}\x1b[22;39m`
      : `${ansi}${text}\x1b[39m`;
  }

  bg(token: string, text: string): string {
    const ansi = this.bgAnsi.get(token);
    if (ansi === undefined) throw new Error(`Unknown theme color: ${token}`);
    return `${ansi}${text}\x1b[49m`;
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
