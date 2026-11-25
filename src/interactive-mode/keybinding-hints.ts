/**
 * Keybinding Hint Helpers
 *
 * Dynamic key display formatting for hints and shortcuts.
 * Reads from the user's configured keybindings (pi-tui's KeybindingsManager).
 * Ported from pi-coding-agent's keybinding-hints.js.
 */

import { getAppKeybindings } from "./keybindings.ts";
import type { Keybinding } from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";

function formatKeyPart(part: string, options: { capitalize?: boolean } = {}): string {
  const displayPart =
    process.platform === "darwin" && part.toLowerCase() === "alt" ? "option" : part;
  return options.capitalize
    ? displayPart.charAt(0).toUpperCase() + displayPart.slice(1)
    : displayPart;
}

function formatKeyText(key: string, options: { capitalize?: boolean } = {}): string {
  return key
    .split("/")
    .map((k) =>
      k
        .split("+")
        .map((part) => formatKeyPart(part, options))
        .join("+"),
    )
    .join("/");
}

function formatKeys(keys: string[], options: { capitalize?: boolean } = {}): string {
  if (keys.length === 0) return "";
  return formatKeyText(keys.join("/"), options);
}

/** The key text for a keybinding, reading from the user's configured keys */
export function keyText(keybinding: Keybinding): string {
  return formatKeys(getAppKeybindings().getKeys(keybinding));
}

/** The key display text (capitalized) for a keybinding */
export function keyDisplayText(keybinding: Keybinding): string {
  return formatKeys(getAppKeybindings().getKeys(keybinding), { capitalize: true });
}

/** Themed key hint: key in dim, description in muted */
export function keyHint(keybinding: Keybinding, description: string): string {
  return theme.fg("dim", keyText(keybinding)) + theme.fg("muted", ` ${description}`);
}

/** Raw key hint without looking up keybindings */
export function rawKeyHint(key: string, description: string): string {
  return theme.fg("dim", formatKeyText(key)) + theme.fg("muted", ` ${description}`);
}

export { formatKeyText };
