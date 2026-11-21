export function formatDuration(seconds: number): string {
  let remaining = Math.max(0, Math.floor(seconds));
  const parts: string[] = [];
  for (const [unit, size] of [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ] as const) {
    const amount = Math.floor(remaining / size);
    remaining %= size;
    if (amount || unit === "s") parts.push(amount + unit);
  }
  return parts.join(" ");
}

const tokenFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatTokens(tokens: number): string {
  return tokenFormat.format(tokens);
}
