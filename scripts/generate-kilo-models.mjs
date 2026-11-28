import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = "https://api.kilo.ai/api/gateway/models";
const KILO_OUT = resolve("src/runtime/custom-providers/kilo-models.ts");
const OFM_KILO_OUT = resolve("src/runtime/custom-providers/ofm-kilo-models.ts");

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function strArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function fmtNum(value) {
  const n = num(value);
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  // Convert tiny decimals (e.g. 2e-7) to plain decimal notation so prettier
  // does not need to reformat them afterwards.
  const str = n.toString();
  if (str.includes("e")) {
    const [coeff, exp] = str.split("e");
    const [intPart, fracPart = ""] = coeff.split(".");
    const e = Number(exp);
    let digits = intPart + fracPart;
    if (e < 0) {
      digits = "0".repeat(-e - 1) + digits;
      return "0." + digits;
    }
    return digits + "0".repeat(e);
  }
  return str;
}

const mandatory = [/^stepfun\//, /^liquid\//, /^thinkingmachines\//];
const noDisable = new Set(["kilo-auto/free", "openrouter/free"]);

const res = await fetch(URL);
if (!res.ok) throw new Error(`Kilo gateway fetch failed: ${res.status} ${res.statusText}`);
const data = await res.json();
const rows = data.data ?? [];

if (!Array.isArray(rows)) throw new Error("Kilo gateway response 'data' is not an array");

const kiloModels = [];
const ofmModels = [];
const seenIds = new Set();

for (const r of rows) {
  const id = r.id ?? "";
  if (!id || seenIds.has(id)) continue;
  seenIds.add(id);

  const name = String(r.name ?? id);

  const supportedParams = strArray(r.supported_parameters);
  const reasoningOptions = r.reasoning_options ?? [];
  let reasoningLevels = [];
  if (reasoningOptions.length > 0) {
    reasoningLevels = strArray(reasoningOptions[0].values);
  } else if (
    supportedParams.includes("reasoning") ||
    supportedParams.includes("reasoning_effort")
  ) {
    reasoningLevels = ["low", "medium", "high"];
  }

  const inputModalities = strArray(r.architecture?.input_modalities);

  // DSH only accepts "text" and "image" as input modalities
  const inputModalitiesClean = inputModalities.filter((m) => m === "text" || m === "image");

  const pricing = r.pricing ?? {};
  const topProvider = r.top_provider ?? {};

  const contextWindow = num(topProvider.context_length);
  const maxTokens = num(topProvider.max_completion_tokens);

  // Skip models with missing or invalid core limits
  if (contextWindow <= 0 || maxTokens <= 0) continue;

  const costInput = Math.max(0, num(pricing.prompt));
  const costOutput = Math.max(0, num(pricing.completion));
  const costCacheRead = Math.max(0, num(pricing.input_cache_read));
  const costCacheWrite = Math.max(0, num(pricing.input_cache_write));

  const vision = inputModalitiesClean.includes("image");
  const reasoning = reasoningLevels.length > 0;
  const canDisable = !mandatory.some((p) => p.test(id)) && !noDisable.has(id);

  const modelEntry = {
    id,
    name,
    reasoning,
    reasoningLevels,
    input: inputModalitiesClean,
    cost: {
      input: costInput,
      output: costOutput,
      cacheRead: costCacheRead,
      cacheWrite: costCacheWrite,
    },
    contextWindow,
    maxTokens,
  };

  kiloModels.push(modelEntry);

  if (r.isFree === true) {
    ofmModels.push({
      id,
      name,
      reasoning,
      canDisable,
      vision,
      contextWindow,
      maxTokens,
    });
  }
}

function formatModelArray(models) {
  const lines = [];
  lines.push("export const KILO_MODELS: readonly KiloModelConfig[] = [");
  for (const m of models) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(m.id)},`);
    lines.push(`    name: ${JSON.stringify(m.name)},`);
    lines.push(`    reasoning: ${m.reasoning},`);
    lines.push(
      `    reasoningLevels: [${m.reasoningLevels.map((l) => JSON.stringify(l)).join(", ")}],`,
    );
    lines.push(`    input: [${m.input.map((l) => JSON.stringify(l)).join(", ")}],`);
    lines.push("    cost: {");
    lines.push(`      input: ${fmtNum(m.cost.input)},`);
    lines.push(`      output: ${fmtNum(m.cost.output)},`);
    lines.push(`      cacheRead: ${fmtNum(m.cost.cacheRead)},`);
    lines.push(`      cacheWrite: ${fmtNum(m.cost.cacheWrite)},`);
    lines.push("    },");
    lines.push(`    contextWindow: ${m.contextWindow},`);
    lines.push(`    maxTokens: ${m.maxTokens},`);
    lines.push("  },");
  }
  lines.push("];");
  return lines.join("\n");
}

function formatOfmModelArray(models) {
  const lines = [];
  lines.push("export const OFM_KILO_MODELS = [");
  for (const m of models) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(m.id)},`);
    lines.push(`    name: ${JSON.stringify(m.name)},`);
    lines.push(`    reasoning: ${m.reasoning},`);
    lines.push(`    canDisable: ${m.canDisable},`);
    lines.push(`    vision: ${m.vision},`);
    lines.push(`    contextWindow: ${m.contextWindow},`);
    lines.push(`    maxTokens: ${m.maxTokens},`);
    lines.push("  },");
  }
  lines.push("];");
  return lines.join("\n");
}

const kiloContent = [
  "/**",
  " * Kilo Provider Models",
  " *",
  " * Auto-generated from live Kilo gateway at build time.",
  " * Run: npm run gen-custom-kilo-models",
  " *",
  " * DO NOT EDIT BY HAND — your changes will be overwritten.",
  " */",
  "",
  "export interface KiloModelConfig {",
  "  id: string;",
  "  name: string;",
  "  reasoning: boolean;",
  "  reasoningLevels: readonly string[];",
  "  input: readonly string[];",
  "  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };",
  "  contextWindow: number;",
  "  maxTokens: number;",
  "}",
  "",
  formatModelArray(kiloModels),
  "",
].join("\n");

const ofmContent = [
  "/** OFM Kilo free models (generated from live gateway) */",
  "export interface OfmKiloModelConfig {",
  "  id: string;",
  "  name: string;",
  "  reasoning: boolean;",
  "  canDisable: boolean;",
  "  vision: boolean;",
  "  contextWindow: number;",
  "  maxTokens: number;",
  "}",
  formatOfmModelArray(ofmModels),
  "",
].join("\n");

writeFileSync(KILO_OUT, kiloContent);
writeFileSync(OFM_KILO_OUT, ofmContent);

console.log(
  `wrote ${kiloModels.length} models to ${KILO_OUT} and ${ofmModels.length} free models to ${OFM_KILO_OUT}`,
);
