/**
 * Custom Entry Component
 *
 * Renders a custom session entry from extensions. The host owns transcript
 * spacing; renderer output should provide only its content. A renderer that
 * throws is replaced by an error box naming the custom type.
 * Ported from pi-coding-agent's `custom-entry.js`.
 */

import { Box, Container, Spacer, Text } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.js";
import { keyHint, keyText } from "../keybinding-hints.js";

export interface CustomEntry {
  customType: string;
  [key: string]: unknown;
}

type CustomEntryRenderer = (
  entry: CustomEntry,
  options: { expanded: boolean; keyText: typeof keyText; keyHint: typeof keyHint },
  theme: typeof import("../theme/theme.js").theme,
) => unknown;

/**
 * Component that renders a custom session entry from extensions.
 */
export class CustomEntryComponent extends Container {
  private entry: CustomEntry;
  private renderer: CustomEntryRenderer;
  private customComponent: unknown;
  private _expanded = false;
  private outputPad: number;

  constructor(entry: CustomEntry, renderer: CustomEntryRenderer, outputPad = 1) {
    super();
    this.entry = entry;
    this.renderer = renderer;
    this.outputPad = outputPad;
    this.rebuild();
  }

  hasContent(): boolean {
    return this.customComponent !== undefined;
  }

  setExpanded(expanded: boolean): void {
    if (this._expanded !== expanded) {
      this._expanded = expanded;
      this.rebuild();
    }
  }

  setOutputPad(outputPad: number): void {
    this.outputPad = outputPad;
    this.rebuild();
  }

  invalidate(): void {
    super.invalidate();
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.customComponent = undefined;
    let component: unknown;
    try {
      component = this.renderer(this.entry, { expanded: this._expanded, keyText, keyHint }, theme);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const box = new Box(this.outputPad, 1, (text) => theme.bg("customMessageBg", text));
      box.addChild(
        new Text(theme.fg("error", `[${this.entry.customType}] renderer failed: ${message}`), 0, 0),
      );
      component = box;
    }
    if (!component) {
      return;
    }
    this.customComponent = component;
    this.addChild(new Spacer(1));
    this.addChild(component as never);
  }
}
