#!/usr/bin/env node

/**
 * Kilo Provider Registration
 *
 * Registers Kilo Gateway as an API key provider.
 * Users can authenticate via /login → "Use an API key" → kilo.
 *
 * Environment variable: KILO_API_KEY
 * API endpoint: https://api.kilo.ai/v1
 *
 * Two sources are combined:
 *   1. Build-time generated roster from models.dev (KILO_MODELS_ALL) — always
 *      available, even offline.
 *   2. Live fetch from Kilo's own gateway listing (https://api.kilo.ai/api/gateway/models)
 *      at runtime, so models added after the last build are present and pricing /
 *      context limits stay current. Live rows are merged on top of the build-time
 *      roster (new ids added, existing ids updated).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";
import { KILO_MODELS_ALL } from "./models/index.js";

export const KILO_BASE_URL = "https://api.kilo.ai/api/gateway";
export const KILO_MODELS_URL = `${KILO_BASE_URL}/models`;

/** Convert a per-token pricing string (e.g. "0.000004") into a per-1M figure. */
function perMillion(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n * 1_000_000;
}

/** Map one Kilo gateway listing row onto pi's model config. Paid rows only. */
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
  if (row.isFree === true) return null; // free pool belongs to ofm-kilo, not here

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
    baseUrl: KILO_BASE_URL,
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
  } satisfies ReturnType<typeof kiloRowToModel>;
}

/** Fetch the paid roster live from Kilo's gateway. Throws on failure. */
export async function fetchKiloModels(signal?: AbortSignal): Promise<any[]> {
  const response = await fetch(KILO_MODELS_URL, {
    headers: { accept: "application/json" },
    signal: signal ?? AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`listing was not JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok)
    throw new Error(`listing answered HTTP ${response.status}: ${text.slice(0, 200)}`);
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map(kiloRowToModel).filter(Boolean) as any[];
}

/** Merge build-time roster with live rows: add new ids, update existing ones. */
function mergeRosters(base: any[], live: any[]): any[] {
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

export async function registerKiloProvider(api: ExtensionAPI): Promise<void> {
  // 1. Build-time roster (original behaviour).
  const baseModels: any[] = (KILO_MODELS_ALL ?? []).map((m: any) => ({
    ...m,
    baseUrl: m.baseUrl || "https://api.kilo.ai/api/gateway",
  }));

  // 2. Live fetch from Kilo's own API (additive).
  let liveModels: any[] = [];
  try {
    liveModels = await fetchKiloModels();
  } catch {
    liveModels = [];
  }

  // 3. Combine both.
  const models = mergeRosters(baseModels, liveModels);

  const baseUrl = models[0]?.baseUrl || "https://api.kilo.ai/api/gateway";

  const config: ProviderConfig = {
    baseUrl,
    apiKey: "$KILO_API_KEY",
    api: "openai-completions",
    models,
    refreshModels: async (context: { signal?: AbortSignal }) => {
      try {
        const next = await fetchKiloModels(context?.signal);
        if (next.length > 0) return mergeRosters(baseModels, next);
      } catch {
        /* fall through */
      }
      return models;
    },
  };

  api.registerProvider("kilo", config);
}
