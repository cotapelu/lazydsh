/**
 * TUI Renderer
 *
 * Creates the interactive TUI (fullscreen alt-screen or regular main screen)
 * with search styling, scroll indicators, URL opening, and clipboard support.
 * Also provides a stable proxy reference so components keep working while the
 * active renderer is replaced on mode switches.
 * Ported from pi-coding-agent's `tui-renderer.js`.
 */

import { ProcessTerminal, TuiAltScreen, TuiMainScreen, type TUI } from "@earendil-works/pi-tui";
import { keyDisplayText } from "./keybinding-hints.ts";
import { theme } from "./theme/theme.ts";

/** Open a URL in the platform browser without invoking a shell. */
function openBrowser(target: string): void {
  // Delegate to the "open" package, which is already a dependency.
  void import("open").then(({ default: open }) => open(target)).catch(() => {});
}

export interface InteractiveTuiOptions {
  tuiMode?: "fullscreen" | "regular";
  showHardwareCursor?: boolean;
  logDirectory?: string;
  terminal?: ProcessTerminal;
  /** Capture mouse events (clicks, wheel, selection); off by default. */
  mouse?: boolean;
  onRightClickPaste?: () => void;
  fullscreenCopyOnSelect?: boolean;
  fullscreenWheelScrollLines?: number | "auto";
}

/**
 * Creates the interactive TUI for the requested mode. Fullscreen gets the
 * alt-screen renderer with transcript search, selection copy, and URL support.
 */
export function createInteractiveTui(options: InteractiveTuiOptions = {}): TUI {
  const terminal = options.terminal ?? new ProcessTerminal();
  if (options.tuiMode === "fullscreen") {
    const styleSearchMatch = (text: string) =>
      theme.bg("searchMatchBg", theme.fg("searchMatchText", text));
    return new TuiAltScreen(terminal, options.showHardwareCursor, options.logDirectory, {
      searchMatchStyle: (text: string) => theme.underline(styleSearchMatch(text)),
      searchCurrentMatchStyle: (text: string) => theme.bold(theme.inverse(styleSearchMatch(text))),
      searchNavigationButtonStyle: (text: string, hovered: boolean) =>
        hovered ? theme.underline(text) : text,
      scrollToEndIndicator: () => {
        const shortcut = keyDisplayText("tui.altScreen.bottom");
        const label = ` ↓ Jump to latest message${shortcut ? ` · ${shortcut}` : ""} `;
        return theme.bg("selectedBg", theme.fg("text", label));
      },
      ...(options.mouse === undefined ? {} : { mouse: options.mouse }),
      openUrl: openBrowser,
      onRightClickPaste: options.onRightClickPaste,
      copyOnSelect: options.fullscreenCopyOnSelect,
      wheelScrollLines: options.fullscreenWheelScrollLines ?? "auto",
      copySelection: async (text: string) => {
        try {
          const { copyToClipboard } = await import("./clipboard.ts");
          await copyToClipboard(text);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });
  }
  return new TuiMainScreen(terminal, options.showHardwareCursor, options.logDirectory);
}

/**
 * Stable reference for components while InteractiveMode replaces the active
 * renderer. Methods re-resolve against the current renderer on every call, so a
 * component holding this reference survives a fullscreen↔regular mode switch.
 */
export function createInteractiveTuiReference(getTui: () => TUI): TUI {
  return new Proxy({} as TUI, {
    get: (_target, property) => {
      const tui = getTui();
      const value = Reflect.get(tui, property, tui);
      if (typeof value !== "function") return value;
      let methodTui = tui;
      let method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const currentTui = getTui();
        if (currentTui !== methodTui) {
          const currentMethod = Reflect.get(currentTui, property, currentTui);
          if (typeof currentMethod !== "function") {
            throw new TypeError(`TUI property ${String(property)} is not callable`);
          }
          methodTui = currentTui;
          method = currentMethod as (...args: unknown[]) => unknown;
        }
        return Reflect.apply(method, methodTui, args);
      };
    },
    set: (_target, property, value) => {
      const tui = getTui();
      return Reflect.set(tui, property, value, tui);
    },
    has: (_target, property) => Reflect.has(getTui(), property),
    getPrototypeOf: () => Reflect.getPrototypeOf(getTui()),
  });
}
