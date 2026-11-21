/**
 * Extension Selector Component
 *
 * Generic selector for extensions: displays a list of string options with
 * keyboard navigation. Supports an optional description, a countdown timer,
 * and hooks into `app.tools.expand`.
 * Ported from pi-coding-agent's `extension-selector.js`.
 */

import { Container, getKeybindings, Spacer, Text } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { DynamicBorder } from "./dynamic-border.ts";
import { keyHint, rawKeyHint } from "../keybinding-hints.ts";

export interface ExtensionSelectorOptions {
  tui?: { requestRender: () => void };
  description?: string;
  timeout?: number;
  onToggleToolsExpanded?: () => void;
}

/**
 * Component that renders an extension selector.
 */
export class ExtensionSelectorComponent extends Container {
  private options: string[];
  private selectedIndex = 0;
  private listContainer: Container;
  private onSelectCallback: (value: string) => void;
  private onCancelCallback: () => void;
  private titleText: Text;
  private baseTitle: string;
  private countdown: CountdownTimer | undefined;
  private onToggleToolsExpanded: (() => void) | undefined;

  constructor(
    title: string,
    options: string[],
    onSelect: (value: string) => void,
    onCancel: () => void,
    opts?: ExtensionSelectorOptions,
  ) {
    super();
    this.options = options;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;
    this.onToggleToolsExpanded = opts?.onToggleToolsExpanded;
    this.baseTitle = title;

    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    this.titleText = new Text(theme.fg("accent", theme.bold(title)), 1, 0);
    this.addChild(this.titleText);
    if (opts?.description) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(theme.fg("text", opts.description), 1, 0));
    }
    this.addChild(new Spacer(1));
    if (opts?.timeout && opts.timeout > 0 && opts.tui) {
      this.countdown = new CountdownTimer(
        opts.timeout,
        opts.tui,
        (s) => this.titleText.setText(theme.fg("accent", theme.bold(`${this.baseTitle} (${s}s)`))),
        () => this.onCancelCallback(),
      );
    }
    this.listContainer = new Container();
    this.addChild(this.listContainer);
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        rawKeyHint("↑↓", "navigate") +
          "  " +
          keyHint("tui.select.confirm", "select") +
          "  " +
          keyHint("tui.select.cancel", "cancel"),
        1,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
    this.updateList();
  }

  private updateList(): void {
    this.listContainer.clear();
    const maxVisible = 10;
    // Center the window on the selection, then clamp it to the list boundaries.
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.options.length - maxVisible),
    );
    const endIndex = Math.min(startIndex + maxVisible, this.options.length);
    for (let i = startIndex; i < endIndex; i++) {
      const isSelected = i === this.selectedIndex;
      const option = this.options[i] ?? "";
      const text = isSelected
        ? theme.fg("accent", "→ ") + theme.fg("accent", option)
        : `  ${theme.fg("text", option)}`;
      this.listContainer.addChild(new Text(text, 1, 0));
    }
    if (startIndex > 0 || endIndex < this.options.length) {
      const scrollInfo = theme.fg("muted", `  (${this.selectedIndex + 1}/${this.options.length})`);
      this.listContainer.addChild(new Text(scrollInfo, 0, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    if (kb.matches(keyData, "app.tools.expand")) {
      this.onToggleToolsExpanded?.();
    } else if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
      this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      const selected = this.options[this.selectedIndex];
      if (selected) this.onSelectCallback(selected);
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    }
  }

  dispose(): void {
    this.countdown?.dispose();
  }
}
