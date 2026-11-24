/**
 * Merge build-time roster with live fetch rows.
 *
 * Ported from `src/providers/kilo-provider.ts` (mergeRosters).
 * Adds new ids, updates existing ones, never drops models already known.
 */
export function mergeRosters(base: any[], live: any[]): any[] {
  const merged = base.map((m) => ({ ...m }));
  const byId = new Map(merged.map((m) => [m.id, m]));
  for (const lm of live) {
    const existing = byId.get(lm.id);
    if (existing) {
      Object.assign(existing, {
        name: lm.name,
        baseUrl: lm.baseUrl || existing.baseUrl,
        reasoning: lm.reasoning,
        input: lm.input,
        cost: lm.cost,
        contextWindow: lm.contextWindow,
        maxTokens: lm.maxTokens,
      });
    } else {
      merged.push({ ...lm });
      byId.set(lm.id, merged[merged.length - 1]);
    }
  }
  return merged;
}

/**
 * Convert a per-token pricing string (e.g. "0.000004") into a per-1M figure.
 * Ported from `src/providers/kilo-provider.ts` (perMillion).
 */
export function perMillion(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n * 1_000_000;
}
