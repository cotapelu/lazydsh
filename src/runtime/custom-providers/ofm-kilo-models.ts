/** OFM Kilo free models (live fetched) */
export interface OfmKiloModelConfig { id: string; name: string; reasoning: boolean; canDisable: boolean; vision: boolean; contextWindow: number; maxTokens: number; }
export const OFM_KILO_MODELS = [
  { id: 'kilo-auto/free', name: 'Auto Free', reasoning: true, canDisable: false, vision: false, contextWindow: 256000, maxTokens: 32768 },
  { id: 'inclusionai/ling-3.2-flash:free', name: 'inclusionAI: Ling 3.2 Flash (free)', reasoning: true, canDisable: true, vision: true, contextWindow: 1048576, maxTokens: 262144 },
  { id: 'baidu/ernie-5.5-flash-preview:free', name: 'Baidu: ERNIE-5.5-Flash-Preview (free)', reasoning: true, canDisable: true, vision: false, contextWindow: 1024000, maxTokens: 921600 },
  { id: 'liquid/lfm-3-1.7b:free', name: 'LiquidAI: LFM3-1.7B (free)', reasoning: true, canDisable: false, vision: false, contextWindow: 262144, maxTokens: 8192 },
  { id: 'particle-ai/particle-1:free', name: 'Particle AI: Particle-1 (free)', reasoning: true, canDisable: true, vision: true, contextWindow: 1048576, maxTokens: 131072 },
  { id: 'recursive/flint-v1.0:free', name: 'Recursive: Flint (free)', reasoning: true, canDisable: true, vision: false, contextWindow: 262144, maxTokens: 235929 },
  { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'NVIDIA: Nemotron 3.5 Super VL (free)', reasoning: true, canDisable: true, vision: true, contextWindow: 1000000, maxTokens: 131072 },
  { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots Studio: Dots3-Note Preview (free)', reasoning: true, canDisable: true, vision: true, contextWindow: 512000, maxTokens: 460800 },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA: Nemotron 3.5 Lightning (free)', reasoning: true, canDisable: true, vision: false, contextWindow: 1000000, maxTokens: 65536 },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'NVIDIA: Nemotron 3 Ultra (free)', reasoning: true, canDisable: true, vision: false, contextWindow: 1000000, maxTokens: 65536 },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'NVIDIA: Nemotron 3 Nano Omni (free)', reasoning: true, canDisable: true, vision: true, contextWindow: 256000, maxTokens: 65536 },
  { id: 'openrouter/free', name: 'OpenRouter Free Models Router', reasoning: true, canDisable: false, vision: true, contextWindow: 200000, maxTokens: 32000 },
  { id: 'reflection/beam-free', name: 'Reflection: Beam 1.0 (Free)', reasoning: true, canDisable: true, vision: false, contextWindow: 1048576, maxTokens: 131072 },
  { id: 'stealth/glyph-cluster', name: 'Glyph Cluster', reasoning: true, canDisable: true, vision: false, contextWindow: 256000, maxTokens: 256000 },
];
