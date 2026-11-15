/** Resolve the short provider aliases accepted by the CLI. */
export function normalizeProvider(provider: string) {
  return provider === "codex" ? "openai-codex" : provider;
}
