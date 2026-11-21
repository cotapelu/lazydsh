/**
 * Header Component
 *
 * The startup header: whale logo, version, and dynamic keybinding hints.
 * Clicking the logo toggles between compact and expanded hints.
 * Ported from pi-coding-agent's BuiltInHeader.
 */

import { Spacer, Text, type Component } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { packageVersion } from "../../utils/version.ts";
import { keyDisplayText, keyHint, rawKeyHint } from "../keybinding-hints.ts";

/** Official deepseek.com SVG silhouette sampled into 2×4 Braille cells. */
const whale = [
  "    ⣀⣤⣤⣤⣤⣤⣴⣶⣿⠃   ⣸⣧⣀    ⢀⣀",
  " ⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄  ⢸⣿⣿⣷⣴⣶⣶⣿⡏",
  "⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄ ⠙⢿⣿⣿⣿⡿⠋",
  "⣼⣿⠉⠉⠉⠙⠛⠿⣿⣿⣿⣿⣿⡿⠛⢿⣿⣷⣦⣿⣿⡏",
  "⣿⣿⡀     ⠈⠻⣿⣿⣿⣯⣷ ⠙⣿⣿⣿⣿⠃",
  "⠸⣿⣧       ⠈⢻⣿⣿⣿⣷⣶⣿⣿⣿⠏",
  " ⠻⣿⣷⡀   ⢀⣀  ⠙⣿⣿⣿⣿⣿⣿⠋",
  "  ⠙⢿⣿⣶⣄⣀⣈⣿⣷⣦⣀⠈⠻⣿⣿⣿⣧⣄⡀",
  "    ⠙⠻⢿⣿⣿⣿⣿⣿⣿⣿⠷⠊⠉⠛⠛⠋⠁",
  "        ⠈⠉⠉⠉⠁",
];

/** The running app version, read once from the package manifest. */
function version(): string {
  return packageVersion();
}

function withLogo(hints: string): string {
  const lines = whale.map((line) => theme.fg("accent", line));
  const [first, second, third] = lines;
  return `${first} ${theme.fg("dim", `v${version()}`)}\n${second ?? ""} ${hints}\n${third ?? ""}`;
}

/** Full hint list, one per line, shown when the header is expanded. */
function expandedInstructions(): string {
  return [
    keyHint("app.interrupt", "to interrupt"),
    keyHint("app.clear", "to clear"),
    rawKeyHint(`${keyDisplayText("app.clear")} twice`, "to exit"),
    keyHint("app.exit", "to exit (empty)"),
    keyHint("app.message.followUp", "to queue follow-up"),
    keyHint("app.message.dequeue", "to edit all queued messages"),
    keyHint("app.model.select", "to select model"),
    rawKeyHint(
      `${keyDisplayText("app.model.cycleForward")}/${keyDisplayText("app.model.cycleBackward")}`,
      "to cycle models",
    ),
    keyHint("app.tools.expand", "to expand tools"),
    keyHint("app.thinking.toggle", "to expand thinking"),
    keyHint("app.editor.external", "for external editor"),
    rawKeyHint("/", "for commands"),
    rawKeyHint("!", "to run bash"),
  ].join("\n");
}

/** Condensed hint list, shown on one line by default. */
function compactInstructions(): string {
  return [
    keyHint("app.interrupt", "interrupt"),
    rawKeyHint(`${keyDisplayText("app.clear")}/${keyDisplayText("app.exit")}`, "clear/exit"),
    rawKeyHint("/", "commands"),
    rawKeyHint("!", "bash"),
    keyHint("app.tools.expand", "more"),
  ].join(theme.fg("muted", " · "));
}

function onboarding(): string {
  return theme.fg(
    "dim",
    "lazydsh is a TUI for DeepSeek Harness. Ask it how to use or extend lazydsh.",
  );
}

function compactOnboarding(): string {
  return theme.fg("dim", `Press ${keyDisplayText("app.tools.expand")} to show full startup help.`);
}

export interface HeaderOptions {
  expanded?: boolean;
  showOnboarding?: boolean;
}

/**
 * The startup header. Clicking it toggles between the compact hint line and
 * the full hint list.
 */
export class HeaderComponent implements Component {
  private expanded: boolean;
  private showOnboarding: boolean;
  private cachedWidth = -1;
  private cachedLines?: string[];

  onToggle?: (expanded: boolean) => void;

  constructor(options: HeaderOptions = {}) {
    this.expanded = options.expanded ?? false;
    this.showOnboarding = options.showOnboarding ?? true;
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.cachedWidth = -1;
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  invalidate(): void {
    this.cachedWidth = -1;
    this.cachedLines = undefined;
  }

  private content(): string {
    return this.expanded
      ? `${withLogo(expandedInstructions())}\n\n${this.showOnboarding ? onboarding() : ""}`
      : `${withLogo(compactInstructions())}\n${compactOnboarding()}\n\n${this.showOnboarding ? onboarding() : ""}`;
  }

  render(width: number): string[] {
    if (this.cachedLines !== undefined && this.cachedWidth === width) return this.cachedLines;
    const lines = [new Spacer(1), new Text(this.content(), 1, 0), new Spacer(1)].flatMap(
      (component) => component.render(width),
    );
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  handleMouse?(event: { type: string; button?: string }): { handled: boolean } | undefined {
    if (event.type !== "click" || event.button !== "left") return undefined;
    this.setExpanded(!this.expanded);
    this.onToggle?.(this.expanded);
    return { handled: true };
  }
}
