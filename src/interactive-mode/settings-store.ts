/**
 * UI Settings Persistence
 *
 * TUI-side preferences that survive restarts, stored beside the keybindings
 * and theme files. Only settings the UI can actually honour belong here;
 * anything owned by DSH (context policy, sandbox) stays out.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** When Mermaid code blocks render as Unicode diagrams. */
export type MermaidMode = "off" | "final" | "streaming";

/** The persisted UI preferences. */
export interface UiSettings {
  /** Ask before exiting from a key-driven exit (Ctrl+D / idle Ctrl+C). */
  confirmExit: boolean;
  /** Mermaid diagram rendering mode. */
  mermaidMode: MermaidMode;
}

export const DEFAULT_UI_SETTINGS: UiSettings = { confirmExit: false, mermaidMode: "streaming" };

/** `$XDG_CONFIG_HOME/lazydsh/settings.json` (default `~/.config/lazydsh/settings.json`). */
export function uiSettingsPath(configDir?: string): string {
  return join(configDir ?? join(homedir(), ".config", "lazydsh"), "settings.json");
}

/** Read the persisted preferences, falling back per-field on anything unreadable. */
export function readUiSettings(configDir?: string): UiSettings {
  try {
    const doc = JSON.parse(readFileSync(uiSettingsPath(configDir), "utf-8")) as {
      confirmExit?: unknown;
      mermaidMode?: unknown;
    };
    const mode = doc.mermaidMode;
    return {
      confirmExit:
        typeof doc.confirmExit === "boolean" ? doc.confirmExit : DEFAULT_UI_SETTINGS.confirmExit,
      mermaidMode:
        mode === "off" || mode === "final" || mode === "streaming"
          ? mode
          : DEFAULT_UI_SETTINGS.mermaidMode,
    };
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

/** Persist the preferences; an unwritable path must never break the UI. */
export function writeUiSettings(settings: UiSettings, configDir?: string): void {
  try {
    const path = uiSettingsPath(configDir);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
  } catch {}
}
