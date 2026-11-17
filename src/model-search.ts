/**
 * Model Search Utilities
 * Ported from pi-coding-agent's model-search.js
 */

export interface ModelInfo {
  id: string;
  provider: string;
  name?: string;
}

/**
 * Returns the search text for a model item, used by fuzzy filter.
 * The /model selector search should rank exact provider-prefixed queries
 * before proxy-provider IDs like openrouter/openai/gpt-5.
 */
export function getModelSelectorSearchText(item: ModelInfo): string {
  const { id, provider } = item;
  const name = item.name ? ` ${item.name}` : "";
  return `${provider} ${provider}/${id} ${provider} ${id}${name}`;
}

/**
 * Split a label into words for comparison.
 */
const splitModelLabel = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Returns the model name when it has words the ID does not,
 * e.g. a renamed override like "MiniMax M3 [rasmus@openrouter, parasail]"
 * for "minimax/minimax-m3". Names that only restate the ID with different
 * casing, separators, or a dropped namespace/version suffix return undefined.
 */
export function getDistinctModelName(item: ModelInfo): string | undefined {
  const name = item.name?.trim();
  if (!name) return undefined;
  const idWords = splitModelLabel(item.id);
  const idTokens = new Set(idWords);
  const compactId = idWords.join("");
  // Single-character words must match a whole ID token: "4" is not covered by "mistral-small-2603".
  const isCovered = (word: string) =>
    idTokens.has(word) || (word.length > 1 && compactId.includes(word));
  return splitModelLabel(name).every(isCovered) ? undefined : name;
}
