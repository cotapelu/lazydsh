/**
 * Theme entry point.
 *
 * The theme system lives in `./theme/` (tokens, JSON, and the controller). This
 * module re-exports it so components can import from a single place, and keeps
 * the named helpers the older call sites use.
 */

export {
  DEFAULT_THEME,
  SYSTEM_THEME,
  customThemesDir,
  fg,
  formatNotification,
  getEditorTheme,
  getMarkdownTheme,
  getSelectListTheme,
  initTheme,
  onThemeChange,
  safeText,
  setTerminalColorScheme,
  setTerminalColors,
  setTheme,
  setThemeInstance,
  terminalColor,
  terminalTheme,
  theme,
  Theme,
} from "./theme/theme.ts";
export { THEME_TOKENS, type ThemeTokenName } from "./theme/theme-tokens.ts";
export { ThemeController, type ThemeControllerOptions } from "./theme/theme-controller.ts";

import { fg as fgColors, theme as activeTheme } from "./theme/theme.ts";

/** `bg(token, text)` in the same shape as `fg`, for tool-card backgrounds. */
export const bg = {
  toolPendingBg: (text: string) => activeTheme.bg("toolPendingBg", text),
  toolSuccessBg: (text: string) => activeTheme.bg("toolSuccessBg", text),
  toolErrorBg: (text: string) => activeTheme.bg("toolErrorBg", text),
};

/** Text attributes, kept for call sites that colorize by hand. */
export const accent = (text: string) => fgColors.accent(text);
export const gray = (text: string) => fgColors.muted(text);
export const dim = (text: string) => fgColors.dim(text);
export const bold = (text: string) => activeTheme.bold(text);
export const italic = (text: string) => activeTheme.italic(text);
export const inverse = (text: string) => activeTheme.inverse(text);
export const underline = (text: string) => activeTheme.underline(text);
export const strikethrough = (text: string) => activeTheme.strikethrough(text);
