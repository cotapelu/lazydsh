import type { PiAiProviderProfile } from "@deepseek-ai/dsh-llm-pi-ai";
import { staticOpencodeModels } from "./ofm-provider/catalog.js";

export const OFM_OPENCODE_PROVIDER_ID = "ofm-opencode";
export const OFM_OPENCODE_DISPLAY_NAME = "OpenCode Free";
export const OFM_OPENCODE_BASE_URL = "https://opencode.ai/inference/openai/v1";

/** OpenCode free lane needs no credential at all — the gate is a client fingerprint, not an API key. */
export const OFM_OPENCODE_MODEL_PROFILES = staticOpencodeModels().map((model: any) => {
  const base = {
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    input: model.input as ("text" | "image")[],
    reasoning: model.reasoning === true,
    compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
  };
  if (model.reasoning !== true || model.thinkingLevelMap === undefined) {
    return base;
  }
  const efforts = Object.fromEntries(
    Object.entries(model.thinkingLevelMap as Record<string, string | null>).filter(
      ([, v]) => v !== null,
    ),
  );
  return { ...base, reasoningEfforts: efforts };
});

export const OFM_OPENCODE_PROVIDER_PROFILE: PiAiProviderProfile = {
  apiKeyEnv: undefined,
  displayName: OFM_OPENCODE_DISPLAY_NAME,
  api: "openai-completions",
  baseURL: OFM_OPENCODE_BASE_URL,
  models: OFM_OPENCODE_MODEL_PROFILES,
  retryPolicy: { mode: "normal", maxRetries: 2 },
};

export function ofmOpenencodeRoutes(): Record<string, PiAiProviderProfile> {
  return { [OFM_OPENCODE_PROVIDER_ID]: OFM_OPENCODE_PROVIDER_PROFILE };
}
