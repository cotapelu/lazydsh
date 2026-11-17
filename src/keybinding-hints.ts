/**
 * Keybinding Hint Helpers
 *
 * Dynamic key display formatting for hints and shortcuts.
 * Ported from pi-coding-agent's keybinding-hints.js.
 */

import { fg } from "./theme/theme.ts";

/** Raw key text without formatting */
export function keyText(key: string): string {
  return key.replace(/^(ctrl|shift|alt|meta)\+/i, (m) => m.toUpperCase().replace("+", ""));
}

/** Format key with theme styling */
export function formatKeyText(key: string, options: { capitalize?: boolean } = {}): string {
  const text = keyText(key);
  return options.capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Raw key hint without theme */
export function rawKeyHint(keybinding: string, description: string): string {
  return `${keyText(keybinding)} ${description}`;
}

/** Themed key hint: key in accent, description in dim */
export function keyHint(keybinding: string, description: string): string {
  return `${fg.accent(keyText(keybinding))} ${fg.dim(description)}`;
}

/** Themed key display text for hints */
export function keyDisplayText(keybinding: string): string {
  return fg.accent(keyText(keybinding));
}
