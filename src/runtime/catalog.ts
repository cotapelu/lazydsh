import { getBuiltinModels, getBuiltinProviders } from "@earendil-works/pi-ai/providers/all";
import { normalizeProvider } from "./provider.ts";
import { KILO_MODELS } from "./custom-providers/kilo-models.js";
import { KILO_PROVIDER_ID, kiloRoutes } from "./custom-providers/kilo-config.js";
import { OFM_KILO_MODELS } from "./custom-providers/ofm-kilo-models.js";
import { OFM_KILO_PROVIDER_ID, ofmKiloRoutes } from "./custom-providers/ofm-kilo-config.js";
import { OFM_OPENCODE_MODELS } from "./custom-providers/ofm-opencode-models.js";
import {
  OFM_OPENCODE_PROVIDER_ID,
  ofmOpenencodeRoutes,
} from "./custom-providers/ofm-opencode-config.js";

export { normalizeProvider } from "./provider.ts";

/** Routes mounted by our own provider declarations rather than pi-ai's catalog. */
export const CUSTOM_PROVIDERS = [KILO_PROVIDER_ID, OFM_KILO_PROVIDER_ID, OFM_OPENCODE_PROVIDER_ID];

const preferred = ["deepseek-official", "opencode-go", "opencode", "openai-codex", "kilo"];
export const providers = [
  "deepseek-official",
  ...CUSTOM_PROVIDERS,
  ...getBuiltinProviders().filter((id) => getBuiltinModels(id).length),
].sort((a, b) => {
  const rank = (id: string) => (preferred.includes(id) ? preferred.indexOf(id) : preferred.length);
  return rank(a) - rank(b) || a.localeCompare(b);
});

export function models(provider: string) {
  if (provider === KILO_PROVIDER_ID) {
    return KILO_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      inputModalities: [...model.input],
    }));
  }
  if (provider === OFM_KILO_PROVIDER_ID) {
    return OFM_KILO_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      inputModalities: model.vision ? ["text", "image"] : ["text"],
    }));
  }
  if (provider === OFM_OPENCODE_PROVIDER_ID) {
    return OFM_OPENCODE_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      inputModalities: model.vision ? ["text", "image"] : ["text"],
    }));
  }
  return getBuiltinModels(
    (provider === "deepseek-official" ? "deepseek" : provider) as Parameters<
      typeof getBuiltinModels
    >[0],
  );
}

export function providerPatch() {
  // Custom-provider routes are declared in `custom-providers/` and handed to
  // `llm-pi-ai` as configuration, exactly like the built-in pi-ai catalog
  // routes. A shallow merge would drop one set, so the two tables union by key.
  return [
    {
      id: "llm-pi-ai",
      config: {
        providers: {
          ...Object.fromEntries(
            providers
              .filter((id) => id !== "deepseek-official" && !CUSTOM_PROVIDERS.includes(id))
              .map((id) => [id, {}]),
          ),
          ...kiloRoutes(),
          ...ofmKiloRoutes(),
          ...ofmOpenencodeRoutes(),
        },
      },
    },
  ];
}

export function validateRoute(provider: string, model: string, customPatches: string[] = []) {
  provider = normalizeProvider(provider);
  if (!providers.includes(provider) && !customPatches.length) {
    throw new Error(`Unknown provider: ${provider}. Use --list or configure a route with --patch.`);
  }
  if (!model?.trim()) throw new Error("A model ID is required. Use --list to see the catalog.");
  // Exact model validation belongs to dsh: a user --patch can add models newer
  // than this catalog, so we only require a non-empty model id here.
  return { provider, model };
}
