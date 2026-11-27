/** OFM OpenCode SDK free models (static snapshot for offline boot) */

export interface OfmOpencodeSdkModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  vision: boolean;
  contextWindow: number;
  maxTokens: number;
}

/** Static snapshot from opencode v2.2.5 free tier listing (live fetch) */
export const OFM_OPENCODE_SDK_MODELS: OfmOpencodeSdkModelConfig[] = [
  // Reflection models
  {
    id: "reflection/beam-free",
    name: "Reflection: Beam (Free)",
    reasoning: true,
    vision: false,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  // Beam models
  {
    id: "beam-free",
    name: "Beam (Free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // Kilo auto router
  {
    id: "kilo-auto/free",
    name: "Kilo Auto Free (router)",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 32768,
  },
  // NVIDIA Nemotron free models
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA: Nemotron 3.5 Super VL (free)",
    reasoning: true,
    vision: true,
    contextWindow: 1000000,
    maxTokens: 131072,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA: Nemotron 3.5 Lightning (free)",
    reasoning: true,
    vision: false,
    contextWindow: 1000000,
    maxTokens: 65536,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA: Nemotron 3 Ultra (free)",
    reasoning: true,
    vision: false,
    contextWindow: 1000000,
    maxTokens: 65536,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "NVIDIA: Nemotron 3 Nano Omni (free)",
    reasoning: true,
    vision: true,
    contextWindow: 256000,
    maxTokens: 65536,
  },
  // Nemotron free aliases
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL (free)",
    reasoning: true,
    vision: true,
    contextWindow: 1000000,
    maxTokens: 131072,
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning (free)",
    reasoning: true,
    vision: false,
    contextWindow: 1000000,
    maxTokens: 65536,
  },
  // Qwen models
  {
    id: "qwen-2.5-coder",
    name: "Qwen 2.5 Coder",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // GLM models
  {
    id: "glm-5.2",
    name: "GLM 5.2",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  {
    id: "glm-5.3",
    name: "GLM 5.3",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // MiniMax models
  {
    id: "minimax-m3",
    name: "MiniMax M3",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // Hunyuan models
  {
    id: "hy3",
    name: "Hunyuan 3",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  {
    id: "hy4",
    name: "Hunyuan 4",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  {
    id: "hy4-preview",
    name: "Hunyuan 4 Preview",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // Mimo models
  {
    id: "mimo-v2.6-flash-free",
    name: "Mimo v2.6 Flash (free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // Dots Studio
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots Studio: Dots 3 Note Preview (free)",
    reasoning: true,
    vision: true,
    contextWindow: 512000,
    maxTokens: 460800,
  },
  // Particle AI
  {
    id: "particle-ai/particle-1:free",
    name: "Particle AI: Particle-1 (free)",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  // Iceman
  {
    id: "iceman-free",
    name: "Iceman (free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  {
    id: "iceman-contributor-free",
    name: "Iceman Contributor (free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // Liquid AI
  {
    id: "liquid/lfm-3-1.7b:free",
    name: "LiquidAI: LFM3-1.7B (free)",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 8192,
  },
  // Recursive
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive: Flint (free)",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 235929,
  },
  // Dots Studio
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots Studio: Dots3-Note Preview (free)",
    reasoning: true,
    vision: true,
    contextWindow: 512000,
    maxTokens: 460800,
  },
  // DeepSeek
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek v4.1 Flash (free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // InclusionAI
  {
    id: "inclusionai/ling-3.2-flash:free",
    name: "inclusionAI: Ling 3.2 Flash (free)",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 262144,
  },
  // Baidu
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    name: "Baidu: ERNIE-5.5-Flash-Preview (free)",
    reasoning: true,
    vision: false,
    contextWindow: 1024000,
    maxTokens: 921600,
  },
  // Hungerg
  {
    id: "hungerg-free",
    name: "Hungerg (free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // Tidepool
  {
    id: "tidepool-alpha-free",
    name: "Tidepool Alpha (free)",
    reasoning: true,
    vision: false,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  // OpenRouter
  {
    id: "openrouter/free",
    name: "OpenRouter Free Models Router",
    reasoning: true,
    vision: true,
    contextWindow: 200000,
    maxTokens: 32000,
  },
  // Flint
  {
    id: "flint-40b-free",
    name: "Flint 40B (free)",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 235929,
  },
  // Nemotron free aliases (from live listing)
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL (free)",
    reasoning: true,
    vision: true,
    contextWindow: 1000000,
    maxTokens: 131072,
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning (free)",
    reasoning: true,
    vision: false,
    contextWindow: 1000000,
    maxTokens: 65536,
  },
  // OpenRouter free
  {
    id: "openrouter/free",
    name: "OpenRouter Free Models Router",
    reasoning: true,
    vision: true,
    contextWindow: 200000,
    maxTokens: 32000,
  },
  // Kilo auto variants
  {
    id: "kilo-auto/free",
    name: "Kilo Auto Free (router)",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 32768,
  },
  {
    id: "kilo-auto/frontier",
    name: "Kilo Auto Frontier",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 32768,
  },
  {
    id: "kilo-auto/balanced",
    name: "Kilo Auto Balanced",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 32768,
  },
  {
    id: "kilo-auto/small",
    name: "Kilo Auto Small",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 32768,
  },
  {
    id: "kilo-auto/efficient",
    name: "Kilo Auto Efficient",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 32768,
  },
  // Gemina 4 Argon
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 32768,
  },
  // Stealth
  {
    id: "stealth/glyph-cluster",
    name: "Glyph Cluster",
    reasoning: true,
    vision: false,
    contextWindow: 256000,
    maxTokens: 256000,
  },
];
