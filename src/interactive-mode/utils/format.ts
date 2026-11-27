/**
 * TUI-only formatting helpers.
 * formatDuration stays in src/utils/ (shared with runtime via limits.ts, stats.ts).
 */

const tokenFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatTokens(tokens: number): string {
  return tokenFormat.format(tokens);
}
