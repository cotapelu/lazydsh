/**
 * Theme Settings Persistence
 *
 * The chosen theme (a name, or the `"<light>/<dark>"` auto pair) lives in
 * `~/.config/lazydsh/theme.json` as `{ "theme": "dark" }`. The controller
 * resolves it at startup and the picker writes it on selection, so a choice
 * survives a restart; a missing or unreadable file simply falls back to the
 * default theme.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * The lazydsh config directory.
 *
 * `customThemesDir()` honours `XDG_CONFIG_HOME`, so every other config file
 * must resolve through the same root: reading themes from `$XDG_CONFIG_HOME`
 * while keybindings, the theme selection and UI settings stayed in
 * `~/.config/lazydsh` split one user's configuration across two trees.
 *
 * Named for what it returns rather than `configDir`, so call sites that accept
 * a `configDir` override parameter can still call the default.
 */
export function lazydshConfigDir(): string {
  const root = (process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config")).replace(
    /\/+$/,
    "",
  );
  return join(root, "lazydsh");
}

/** Where the theme setting lives (`$XDG_CONFIG_HOME/lazydsh/theme.json`). */
export function themeSettingsPath(configDir?: string): string {
  return join(configDir ?? lazydshConfigDir(), "theme.json");
}

/** The persisted setting, or undefined when absent/unreadable. */
export function readThemeSetting(configDir?: string): string | undefined {
  try {
    const doc = JSON.parse(readFileSync(themeSettingsPath(configDir), "utf-8")) as {
      theme?: unknown;
    };
    return typeof doc.theme === "string" && doc.theme.trim() ? doc.theme.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Persist the setting; a failure (read-only home) must never break the UI. */
export function writeThemeSetting(setting: string, configDir?: string): void {
  try {
    const path = themeSettingsPath(configDir);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ theme: setting }, null, 2)}\n`);
  } catch {}
}
