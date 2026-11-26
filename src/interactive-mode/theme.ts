/**
 * Theme entry point — re-export từ theme/theme.ts
 */

export {
  DEFAULT_THEME,
  SYSTEM_THEME,
  fg,
  formatNotification,
  getEditorTheme,
  getMarkdownTheme,
  getSelectListTheme,
  initTheme,
  readThemeSetting,
  writeThemeSetting,
  safeText,
  terminalColor,
  theme,
  Theme,
  ThemeController,
  type ThemeTokenName,
  THEME_TOKENS,
  currentThemeName_,
  setTheme,
  lazydshConfigDir,
} from "./theme/theme.ts";

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
export const success = (text: string) => fgColors.success(text);
export const error = (text: string) => fgColors.error(text);
export const bold = (text: string) => activeTheme.bold(text);
export const italic = (text: string) => activeTheme.italic(text);
export const inverse = (text: string) => activeTheme.inverse(text);
export const underline = (text: string) => activeTheme.underline(text);
export const strikethrough = (text: string) => activeTheme.strikethrough(text);
