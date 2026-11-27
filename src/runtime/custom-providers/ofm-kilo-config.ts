import type { PiAiProviderProfile } from "./types.ts";
import { OFM_KILO_MODELS } from "./ofm-kilo-models.js";

export const OFM_KILO_PROVIDER_ID = "ofm-kilo";
export const OFM_KILO_API_KEY_ENV = "OFM_KILO_API_KEY";
export const OFM_KILO_DISPLAY_NAME = "OFM Kilo Free";
export const OFM_KILO_BASE_URL = "https://api.kilo.ai/api/gateway";

export const OFM_KILO_MODEL_PROFILES = OFM_KILO_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  contextWindow: model.contextWindow,
  maxTokens: model.maxTokens,
  input: model.vision
    ? (["text", "image"] as ("text" | "image")[])
    : (["text"] as ("text" | "image")[]),
  reasoningEfforts: model.canDisable
    ? ({ off: "none", low: "low", medium: "medium", high: "high" } as const)
    : ({ low: "low", medium: "medium", high: "high" } as const),
  compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
}));

export const OFM_KILO_PROVIDER_PROFILE: PiAiProviderProfile = {
  apiKeyEnv: "OFM_KILO_API_KEY",
  displayName: OFM_KILO_DISPLAY_NAME,
  api: "openai-completions",
  baseURL: OFM_KILO_BASE_URL,
  models: OFM_KILO_MODEL_PROFILES,
  retryPolicy: {
    mode: "normal",
    maxRetries: 5,
    // Kilo's free gateway returns 429 with code "PROMOTION_MODEL_LIMIT_REACHED"
    // which doesn't match the standard "rate limit" text. Add it explicitly so
    // the retry policy treats it as transient and backs off.
    retryableCodes: [
      "RATE_LIMIT",
      "PROMOTION_MODEL_LIMIT_REACHED",
      "SERVER",
      "TIMEOUT",
      "TRANSPORT",
    ],
    backoff: { initialDelayMs: 1000, maxDelayMs: 30000, jitterRatio: 0.2 },
  },
};

export function ofmKiloRoutes(): Record<string, PiAiProviderProfile> {
  return { [OFM_KILO_PROVIDER_ID]: OFM_KILO_PROVIDER_PROFILE };
}
