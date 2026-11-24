import { perMillion } from "./merge-rosters.js";

/**
 * Map one Kilo gateway listing row onto pi's model config.
 * Ported from src/providers/kilo-provider.ts (kiloRowToModel).
 * Paid rows only (free rows belong to ofm-kilo).
 */
export function kiloRowToModel(row: Record<string, unknown>): null | {
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  reasoning: boolean;
  input: string[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
} {
  if (!row || typeof row.id !== "string" || row.id.trim() === "") return null;
  if (row.isFree === true) return null;

  const arch = (row as Record<string, unknown>)?.architecture as
    | Record<string, unknown>
    | undefined;
  const inputMods: string[] = Array.isArray(arch?.input_modalities)
    ? (arch.input_modalities as string[])
    : [];
  const vision = inputMods.includes("image");
  const supported = (row as Record<string, unknown>)?.supported_parameters;
  const params: string[] = Array.isArray(supported) ? (supported as string[]) : [];
  const reasoning = params.includes("reasoning") || params.includes("reasoning_effort");

  const top = (row as Record<string, unknown>)?.top_provider as Record<string, unknown> | undefined;
  const pricing =
    ((row as Record<string, unknown>)?.pricing as Record<string, unknown> | undefined) ?? {};
  const contextWindow =
    (typeof row?.context_length === "number" && row.context_length) ||
    (typeof top?.context_length === "number" && top.context_length) ||
    4096;
  const maxTokens =
    (typeof top?.max_completion_tokens === "number" && top.max_completion_tokens) ||
    (typeof top?.max_tokens === "number" && top.max_tokens) ||
    4096;

  return {
    id: row.id,
    name: typeof row.name === "string" && row.name ? row.name : row.id,
    baseUrl: "https://api.kilo.ai/api/gateway",
    api: "openai-completions",
    reasoning,
    input: vision ? (["text", "image"] as any) : (["text"] as any),
    cost: {
      input: perMillion(pricing.prompt),
      output: perMillion(pricing.completion),
      cacheRead: perMillion(pricing.input_cache_read),
      cacheWrite: perMillion(pricing.input_cache_write),
    },
    contextWindow,
    maxTokens,
  };
}
