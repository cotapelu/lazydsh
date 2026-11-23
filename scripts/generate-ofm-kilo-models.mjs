import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = "https://api.kilo.ai/api/gateway/models";
const OUT = resolve("src/runtime/custom-providers/ofm-kilo-models.ts");

const mandatory = [/^stepfun\//, /^liquid\//, /^thinkingmachines\//];
const noDisable = new Set(["kilo-auto/free", "openrouter/free"]);

const res = await fetch(URL);
const data = await res.json();
const rows = (data.data ?? []).filter((r) => r.isFree === true);

const lines = [];
lines.push("/** OFM Kilo free models (generated from live gateway) */");
lines.push(
  "export interface OfmKiloModelConfig { id: string; name: string; reasoning: boolean; canDisable: boolean; vision: boolean; contextWindow: number; maxTokens: number; }",
);
lines.push("export const OFM_KILO_MODELS = [");
for (const r of rows) {
  const id = r.id;
  const name = String(r.name || id).replace(/'/g, "\\'");
  const vision = (r.architecture?.input_modalities ?? []).includes("image");
  const ctx = r.context_length ?? r.top_provider?.context_length ?? 200000;
  const maxt = r.top_provider?.max_completion_tokens ?? r.top_provider?.max_tokens ?? 32000;
  const params = r.supported_parameters ?? [];
  const reasoning = params.includes("reasoning") || params.includes("reasoning_effort");
  const canDisable = !mandatory.some((p) => p.test(id)) && !noDisable.has(id);
  lines.push(
    `  { id: ${JSON.stringify(id)}, name: '${name}', reasoning: ${reasoning}, canDisable: ${canDisable}, vision: ${vision}, contextWindow: ${ctx}, maxTokens: ${maxt} },`,
  );
}
lines.push("];");
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`wrote ${rows.length} models to ${OUT}`);
