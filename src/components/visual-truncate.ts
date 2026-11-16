/**
 * Visual line truncation.
 *
 * pi-tui already owns ANSI-aware width math (`truncateToWidth`, `visibleWidth`);
 * this module only adds the line-count policy a preview needs: keep the last
 * `maxLines` lines, and note how many were dropped.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export interface TruncateResult {
  visualLines: string[];
  hiddenLines: number;
}

export function truncateToVisualLines(
  text: string,
  maxLines: number,
  width: number,
  pad = 0,
): TruncateResult {
  const availableWidth = Math.max(1, width - pad);
  const lines = text.split("\n");
  const hiddenLines = Math.max(0, lines.length - maxLines);
  const visualLines = lines
    .slice(-maxLines)
    .map((line) => truncateToWidth(line, availableWidth, "…"));
  return { visualLines, hiddenLines };
}

export function lineCount(text: string): number {
  return text.split("\n").length;
}

export function displayWidth(text: string): number {
  return visibleWidth(text);
}
