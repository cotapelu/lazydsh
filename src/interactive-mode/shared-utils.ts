/**
 * Shared utilities for interactive-mode layer.
 * Pure functions with no dependencies on pi-tui or DSH.
 */

/** Sanitize text for single-line status display */
export function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}
