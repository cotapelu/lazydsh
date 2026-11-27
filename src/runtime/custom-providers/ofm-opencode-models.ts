/**
 * OFM OpenCode free models — the OpenCode Zen *gateway* free pool, direct to
 * cloud. Verified against the live `opencode serve` listing filtered to
 * `providerID === "opencode"` (the keyless free gateway, NOT `opencode-go`,
 * NOT `kilo`), every row cost 0.
 *
 * The `ofm-opencode` route speaks these straight to
 * `https://opencode.ai/inference/openai/v1` through DSH's llm-pi-ai, so DSH
 * owns tool execution. See `ofm-opencode-config.ts` for the fingerprint headers.
 *
 * @module pi-extension/ofm-opencode-models.js
 */
export interface OfmOpencodeModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  vision: boolean;
  contextWindow: number;
  maxTokens: number;
}

export const OFM_OPENCODE_MODELS: OfmOpencodeModelConfig[] = [
  {
    id: "seaglass-alpha-free",
    name: "Seaglass Alpha Free",
    reasoning: true,
    vision: false,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  {
    id: "tidepool-alpha-free",
    name: "Tidepool Alpha Free",
    reasoning: true,
    vision: false,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  {
    id: "hy4-flash-free",
    name: "Hy4 Flash Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 65536,
  },
  {
    id: "iceman-free",
    name: "Iceman Free",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 131072,
  },
  {
    id: "flint-40b-free",
    name: "Flint 40B Free",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 65536,
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek V4.1 Flash Free",
    reasoning: true,
    vision: true,
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  {
    id: "beam-free",
    name: "Beam Free",
    reasoning: true,
    vision: false,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  {
    id: "mimo-v2.6-flash-free",
    name: "MiMo-V2.6-Flash Free",
    reasoning: true,
    vision: true,
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning Free",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 262144,
  },
  {
    id: "big-pickle",
    name: "Big Pickle",
    reasoning: true,
    vision: false,
    contextWindow: 200000,
    maxTokens: 32000,
  },
];
