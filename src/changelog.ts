import { Container, Text, Spacer, matchesKey } from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";
import { accent, dim } from "./theme/theme.ts";
import { keyHint } from "./keybinding-hints.ts";
import { DynamicBorder } from "./components/dynamic-border.js";

/** Changelog entry. */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/** Hardcoded changelog for now. In production, this could be fetched from GitHub releases. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    date: "2025-01-15",
    changes: [
      "Added /bug command for reporting issues with crash details",
      "Added /share command to generate session share links",
      "Implemented status indicators (working/retry/compaction/idle)",
      "Added Header component with logo, version, and keybinding hints",
      "Implemented Login Dialog for OAuth/API key authentication",
      "Added Program Status (OSC 7501) shell integration",
      "Implemented External Editor integration (Ctrl+G)",
      "Added Copy Message to clipboard (Ctrl+X)",
      "Added Thinking Selector (Ctrl+T) to cycle reasoning effort",
      "Improved Assistant/User message components with OSC133 zones",
      "Fixed theme system with DA1 terminal color query and live reload",
      "Added Keybinding hints throughout UI",
    ],
  },
  {
    version: "0.1.0",
    date: "2024-12-01",
    changes: [
      "Initial release of lazydsh",
      "Core TUI layout with header, transcript, pending queue, status, editor, footer",
      "Tool execution cards with expandable output",
      "Bash execution streaming with ANSI support",
      "Model selector with fuzzy search",
      "Session selector with threaded tree view",
      "Configurable keybindings with hot reload",
      "Theme system with token-based theming",
      "Deferred plugin loading for fast startup (<500ms)",
    ],
  },
];

/** Changelog display component. */
export class ChangelogComponent extends Container {
  readonly capturesViewportInput = true;
  private expanded = true;
  private _focused = false;

  constructor() {
    super();
    this.rebuild();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    this.addChild(new Spacer(1));

    if (this.expanded) {
      // Full changelog
      this.addChild(new Text(accent("lazydsh Changelog"), 0, 0));
      this.addChild(new Spacer(1));

      for (const entry of CHANGELOG) {
        this.addChild(new Text(`${accent(`v${entry.version}`)} ${dim(`(${entry.date})`)}`, 0, 0));
        for (const change of entry.changes) {
          this.addChild(new Text(`  • ${change}`, 0, 0));
        }
        this.addChild(new Spacer(1));
      }
    } else {
      // Collapsed - just show latest version
      const latest = CHANGELOG[0];
      this.addChild(new Text(`${accent("lazydsh Changelog")} ${dim(`v${latest.version}`)}`, 0, 0));
      this.addChild(new Text(dim(`  ${latest.changes.length} changes • ${latest.date}`), 0, 0));
    }

    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        dim(
          `${keyHint("tui.select.confirm", "toggle")} ${keyHint("tui.select.cancel", "dismiss")}`,
        ),
        0,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
  }

  handleInput(data: string): void {
    if (matchesKey(data, "enter") || matchesKey(data, "space")) {
      this.setExpanded(!this.expanded);
      return;
    }
    if (matchesKey(data, "escape")) {
      this.onCancel?.();
      return;
    }
  }

  onCancel?: () => void;
}
