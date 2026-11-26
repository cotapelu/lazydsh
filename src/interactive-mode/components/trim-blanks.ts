/**
 * TrimBlanks Component
 *
 * Wraps a component and removes trailing blank lines from its render output.
 * Useful when stacking multiple Markdown components to avoid double-spacing.
 */

import { type Component } from "@earendil-works/pi-tui";
import { stripVTControlCharacters } from "node:util";

export class TrimBlanks implements Component {
  private readonly child: Component;

  constructor(child: Component) {
    this.child = child;
  }

  invalidate(): void {
    this.child.invalidate?.();
  }

  render(width: number): string[] {
    const lines = this.child.render(width);
    // Remove trailing blank lines
    let end = lines.length;
    while (end > 0 && !stripVTControlCharacters(lines[end - 1]).trim()) {
      end--;
    }
    return lines.slice(0, end);
  }
}