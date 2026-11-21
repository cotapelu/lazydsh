/**
 * Dynamic Border
 *
 * A horizontal rule whose color follows the owning component's theme token.
 * Ported from pi-coding-agent's DynamicBorder.
 */

import { type Component } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

export class DynamicBorder implements Component {
  private readonly colorFn: (text: string) => string;
  private cachedWidth = -1;
  private cachedLines?: string[];

  constructor(colorFn: (text: string) => string = (text) => theme.fg("borderMuted", text)) {
    this.colorFn = colorFn;
  }

  invalidate(): void {
    this.cachedWidth = -1;
    this.cachedLines = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines !== undefined && this.cachedWidth === width) return this.cachedLines;
    const line = "─".repeat(Math.max(1, width));
    this.cachedWidth = width;
    this.cachedLines = [this.colorFn(line)];
    return this.cachedLines;
  }
}
