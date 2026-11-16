/**
 * UI Command Helpers
 *
 * Shared command validation functions extracted from ui.ts
 * to avoid circular dependencies.
 */
export function canRunDuringTurn(text: string): boolean {
  return (
    /^\/plan(?:\s+off)?$/.test(text.trim()) ||
    /^\/(?:status|session|ps|stop|effort|permission|cd|file|clear|quit)(?:\s|$)/.test(text.trim())
  );
}

export function shouldQueueDuringTurn(text: string): boolean {
  return Boolean(text.trim()) && !/^\s*\//.test(text) && !canRunDuringTurn(text);
}
