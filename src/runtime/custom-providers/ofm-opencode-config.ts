import type { PiAiProviderProfile } from "./types.ts";
import { OFM_OPENCODE_MODELS } from "./ofm-opencode-models.js";

export const OFM_OPENCODE_PROVIDER_ID = "ofm-opencode";
export const OFM_OPENCODE_DISPLAY_NAME = "OFM OpenCode Free";
export const OFM_OPENCODE_BASE_URL = "https://opencode.ai/inference/openai/v1";

/** OpenCode free lane needs no credential at all — the gate is a client fingerprint, not an API key. */
export const OFM_OPENCODE_MODEL_PROFILES = OFM_OPENCODE_MODELS.map((model) => {
  const base = {
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    input: model.vision
      ? (["text", "image"] as ("text" | "image")[])
      : (["text"] as ("text" | "image")[]),
    reasoning: model.reasoning,
    compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
  };
  if (!model.reasoning) {
    return base;
  }
  return {
    ...base,
    reasoningEfforts: { off: "none", low: "low", medium: "medium", high: "high" } as const,
  };
});

/**
 * Static part of the OpenCode free-lane fingerprint. The dynamic per-turn
 * session headers (minted `ses_…` id, the four matching session headers) are
 * injected per request by the `llm-pi-ai/request-headers` hook in `runtime.ts`.
 */
export const OFM_OPENCODE_FINGERPRINT_HEADERS = {
  "user-agent": "opencode/latest/2.2.5/cli",
  "x-opencode-client": "cli",
  "x-opencode-project": "global",
  authorization: "Bearer public",
} as const;

export const OFM_OPENCODE_PROVIDER_PROFILE: PiAiProviderProfile = {
  apiKeyEnv: undefined,
  displayName: OFM_OPENCODE_DISPLAY_NAME,
  api: "openai-completions",
  baseURL: OFM_OPENCODE_BASE_URL,
  models: OFM_OPENCODE_MODEL_PROFILES,
  headers: { ...OFM_OPENCODE_FINGERPRINT_HEADERS },
  retryPolicy: { mode: "normal", maxRetries: 2 },
};

export function ofmOpenencodeRoutes(): Record<string, PiAiProviderProfile> {
  return { [OFM_OPENCODE_PROVIDER_ID]: OFM_OPENCODE_PROVIDER_PROFILE };
}
