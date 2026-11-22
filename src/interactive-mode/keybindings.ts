/**
 * Keybindings
 *
 * pi-tui owns the key table and the matching engine (`TUI_KEYBINDINGS`,
 * `KeybindingsManager`). lazydsh only adds its own app actions on top, reads an
 * optional user config, and keeps it in sync with the file. Ported from
 * pi-coding-agent's `core/keybindings.ts`.
 */

import {
  TUI_KEYBINDINGS,
  KeybindingsManager as TuiKeybindingsManager,
  type KeybindingDefinitions,
  type KeyId,
} from "@earendil-works/pi-tui";
import { existsSync, readFileSync, unwatchFile, watchFile } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const windowsKeybindings =
  process.platform === "win32" ||
  (process.platform === "linux" && Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP));

/** Build a key list with `KeyId` inference, so `as const` stays available for `keyof typeof`. */
const keys = (...ids: KeyId[]): KeyId[] => ids;

/** lazydsh's own actions. Keys are `app.*`; tui.* stays pi-tui's. */
export const APP_KEYBINDINGS = {
  "app.interrupt": { defaultKeys: "escape", description: "Cancel or abort" },
  "app.clear": { defaultKeys: "ctrl+c", description: "Clear editor" },
  "app.exit": { defaultKeys: "ctrl+d", description: "Exit when editor is empty" },
  "app.suspend": {
    defaultKeys: process.platform === "win32" ? keys() : "ctrl+z",
    description: "Suspend to background",
  },
  "app.thinking.cycle": { defaultKeys: "shift+tab", description: "Cycle thinking level" },
  "app.thinking.save": { defaultKeys: "ctrl+s", description: "Save thinking level" },
  "app.model.cycleForward": { defaultKeys: "ctrl+p", description: "Cycle to next model" },
  "app.model.cycleBackward": {
    defaultKeys: windowsKeybindings ? "alt+p" : "shift+ctrl+p",
    description: "Cycle to previous model",
  },
  "app.model.select": { defaultKeys: "ctrl+l", description: "Open model selector" },
  "app.tools.expand": { defaultKeys: "ctrl+o", description: "Toggle tool output" },
  "app.thinking.toggle": { defaultKeys: "ctrl+t", description: "Toggle thinking blocks" },
  "app.session.toggleNamedFilter": {
    defaultKeys: "ctrl+n",
    description: "Toggle named session filter",
  },
  "app.editor.external": { defaultKeys: "ctrl+g", description: "Open external editor" },
  "app.message.copy": {
    defaultKeys: "ctrl+x",
    description: "Copy selection or last assistant message",
  },
  "app.message.followUp": {
    defaultKeys: windowsKeybindings ? "ctrl+q" : "alt+enter",
    description: "Queue follow-up message",
  },
  "app.message.dequeue": {
    defaultKeys: windowsKeybindings ? "alt+q" : "alt+up",
    description: "Restore queued messages",
  },
  "app.clipboard.pasteImage": {
    defaultKeys: windowsKeybindings ? keys("alt+v", "ctrl+v") : "ctrl+v",
    description: "Paste images or text from clipboard",
  },
  "app.session.new": { defaultKeys: keys(), description: "Start a new session" },
  "app.session.resume": { defaultKeys: keys(), description: "Resume a session" },
  "app.session.togglePath": { defaultKeys: "ctrl+p", description: "Toggle session path display" },
  "app.session.toggleSort": { defaultKeys: "ctrl+s", description: "Toggle session sort mode" },
  "app.session.rename": { defaultKeys: "ctrl+r", description: "Rename session" },
  "app.session.delete": { defaultKeys: "ctrl+d", description: "Delete session" },
  "app.session.deleteNoninvasive": {
    defaultKeys: "ctrl+backspace",
    description: "Delete session when query is empty",
  },
  "app.models.save": { defaultKeys: "ctrl+s", description: "Save model selection" },
} as const;

export type AppKeybinding = keyof typeof APP_KEYBINDINGS;

export type AppKeybindings = {
  [K in AppKeybinding]: true;
};

declare module "@earendil-works/pi-tui" {
  interface Keybindings extends AppKeybindings {}
}

export const KEYBINDINGS: KeybindingDefinitions = {
  ...TUI_KEYBINDINGS,
  "tui.editor.undo": {
    ...TUI_KEYBINDINGS["tui.editor.undo"],
    defaultKeys: process.platform === "win32" ? "ctrl+z" : windowsKeybindings ? "alt+z" : "ctrl+-",
  },
  "tui.altScreen.previousPrompt": {
    ...TUI_KEYBINDINGS["tui.altScreen.previousPrompt"],
    defaultKeys: windowsKeybindings ? "ctrl+up" : keys("ctrl+shift+up", "ctrl+up"),
  },
  "tui.altScreen.nextPrompt": {
    ...TUI_KEYBINDINGS["tui.altScreen.nextPrompt"],
    defaultKeys: windowsKeybindings ? "ctrl+down" : keys("ctrl+shift+down", "ctrl+down"),
  },
  "tui.altScreen.search": {
    ...TUI_KEYBINDINGS["tui.altScreen.search"],
    defaultKeys: windowsKeybindings ? "ctrl+f" : "ctrl+shift+f",
  },
  ...APP_KEYBINDINGS,
};

/** Legacy pi keybinding names → current names, so old configs keep working. */
const KEYBINDING_NAME_MIGRATIONS: Record<string, string> = {
  cursorUp: "tui.editor.cursorUp",
  cursorDown: "tui.editor.cursorDown",
  cursorLeft: "tui.editor.cursorLeft",
  cursorRight: "tui.editor.cursorRight",
  cursorWordLeft: "tui.editor.cursorWordLeft",
  cursorWordRight: "tui.editor.cursorWordRight",
  cursorLineStart: "tui.editor.cursorLineStart",
  cursorLineEnd: "tui.editor.cursorLineEnd",
  jumpForward: "tui.editor.jumpForward",
  jumpBackward: "tui.editor.jumpBackward",
  pageUp: "tui.editor.pageUp",
  pageDown: "tui.editor.pageDown",
  deleteCharBackward: "tui.editor.deleteCharBackward",
  deleteCharForward: "tui.editor.deleteCharForward",
  deleteWordBackward: "tui.editor.deleteWordBackward",
  deleteWordForward: "tui.editor.deleteWordForward",
  deleteToLineStart: "tui.editor.deleteToLineStart",
  deleteToLineEnd: "tui.editor.deleteToLineEnd",
  yank: "tui.editor.yank",
  yankPop: "tui.editor.yankPop",
  undo: "tui.editor.undo",
  newLine: "tui.input.newLine",
  submit: "tui.input.submit",
  tab: "tui.input.tab",
  copy: "tui.input.copy",
  selectUp: "tui.select.up",
  selectDown: "tui.select.down",
  selectPageUp: "tui.select.pageUp",
  selectPageDown: "tui.select.pageDown",
  selectConfirm: "tui.select.confirm",
  selectCancel: "tui.select.cancel",
  interrupt: "app.interrupt",
  clear: "app.clear",
  exit: "app.exit",
  suspend: "app.suspend",
  cycleThinkingLevel: "app.thinking.cycle",
  saveThinkingLevel: "app.thinking.save",
  cycleModelForward: "app.model.cycleForward",
  cycleModelBackward: "app.model.cycleBackward",
  selectModel: "app.model.select",
  expandTools: "app.tools.expand",
  toggleThinking: "app.thinking.toggle",
  toggleSessionNamedFilter: "app.session.toggleNamedFilter",
  externalEditor: "app.editor.external",
  followUp: "app.message.followUp",
  dequeue: "app.message.dequeue",
  pasteImage: "app.clipboard.pasteImage",
  newSession: "app.session.new",
  resume: "app.session.resume",
  toggleSessionPath: "app.session.togglePath",
  toggleSessionSort: "app.session.toggleSort",
  renameSession: "app.session.rename",
  deleteSession: "app.session.delete",
  deleteSessionNoninvasive: "app.session.deleteNoninvasive",
};

function isKeybindingValue(value: unknown): value is KeyId | KeyId[] {
  if (typeof value === "string") return true;
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function toKeybindingsConfig(value: unknown): Record<string, KeyId | KeyId[]> {
  const config: Record<string, KeyId | KeyId[]> = {};
  if (value === null || typeof value !== "object") return config;
  for (const [key, binding] of Object.entries(value as Record<string, unknown>)) {
    if (key === "$schema") continue;
    if (isKeybindingValue(binding)) config[key] = binding;
  }
  return config;
}

export function migrateKeybindingsConfig(rawConfig: Record<string, unknown>): {
  config: Record<string, unknown>;
  migrated: boolean;
} {
  const config: Record<string, unknown> = {};
  let migrated = false;
  for (const [key, value] of Object.entries(rawConfig)) {
    const nextKey = KEYBINDING_NAME_MIGRATIONS[key] ?? key;
    if (nextKey !== key) migrated = true;
    if (key !== nextKey && Object.hasOwn(rawConfig, nextKey)) {
      migrated = true;
      continue;
    }
    config[nextKey] = value;
  }
  return { config, migrated };
}

function loadRawConfig(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    if (parsed === null || typeof parsed !== "object") return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function keybindingsConfigPath(configDir?: string): string {
  return join(configDir ?? join(homedir(), ".config", "lazydsh"), "keybindings.json");
}

let sharedManager: KeybindingsManager | undefined;

/**
 * The process-wide manager carrying the app-level bindings. pi-tui's own
 * `getKeybindings()` only knows the TUI bindings, so app actions (Ctrl+C,
 * Ctrl+T, …) must resolve through this manager instead.
 */
export function getAppKeybindings(): KeybindingsManager {
  sharedManager ??= KeybindingsManager.create();
  return sharedManager;
}

export class KeybindingsManager extends TuiKeybindingsManager {
  private readonly configPath: string;
  private watching = false;

  constructor(userBindings: Record<string, KeyId | KeyId[]> = {}, configPath: string) {
    super(KEYBINDINGS, userBindings);
    this.configPath = configPath;
  }

  static create(configDir?: string): KeybindingsManager {
    const configPath = keybindingsConfigPath(configDir);
    return new KeybindingsManager(KeybindingsManager.loadFromFile(configPath), configPath);
  }

  static loadFromFile(path: string): Record<string, KeyId | KeyId[]> {
    const rawConfig = loadRawConfig(path);
    if (!rawConfig) return {};
    return toKeybindingsConfig(migrateKeybindingsConfig(rawConfig).config);
  }

  /** Re-read the config file. Safe to call while running. */
  reload(): void {
    this.setUserBindings(KeybindingsManager.loadFromFile(this.configPath));
  }

  getEffectiveConfig(): Record<string, KeyId | KeyId[] | undefined> {
    return this.getResolvedBindings();
  }

  startWatching(): void {
    if (this.watching) return;
    this.watching = true;
    watchFile(this.configPath, { persistent: true }, () => this.reload());
  }

  dispose(): void {
    if (!this.watching) return;
    this.watching = false;
    unwatchFile(this.configPath);
  }
}
