/** OpenCode free lane models (static snapshot from catalog) */
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
    id: "big-pickle",
    name: "Big Pickle",
    reasoning: true,
    vision: true,
    contextWindow: 262144,
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
    id: "flint-40b-free",
    name: "Flint 40B Free",
    reasoning: true,
    vision: false,
    contextWindow: 262144,
    maxTokens: 65536,
  },
  {
    id: "mimo-v2.6-flash-free",
    name: "MiMo V2.6 Flash Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 131072,
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
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning Free",
    reasoning: true,
    vision: false,
    contextWindow: 128000,
    maxTokens: 32768,
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek V4.1 Flash Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 384000,
  },
  {
    id: "glm-5.3-flash-free",
    name: "GLM 5.3 Flash Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  {
    id: "pulse-alpha-free",
    name: "Pulse Alpha Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
  {
    id: "space-bunny-free",
    name: "Space Bunny Free",
    reasoning: true,
    vision: true,
    contextWindow: 1048576,
    maxTokens: 524288,
  },
  {
    id: "longcat-2.5-preview-free",
    name: "Longcat 2.5 Preview Free",
    reasoning: false,
    vision: false,
    contextWindow: 1048576,
    maxTokens: 131072,
  },
];
