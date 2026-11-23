/**
 * Kilo Gateway — route declaration for the pi-ai adapter.
 *
 * Kilo speaks the OpenAI completions protocol, so it is expressed as a
 * hand-declared route of `@deepseek-ai/dsh-llm-pi-ai` rather than as a new
 * `LlmAdapter`. Everything the route needs is configuration: endpoint,
 * credential reference, wire protocol, and the model roster.
 *
 * The roster is build-time (KILO_MODELS in ./kilo-models.ts). A route the
 * pi-ai catalog does not ship must list its models, because nothing else can
 * describe them; `llm-pi-ai`'s model discovery serves the settings surface's
 * "fetch available models" action against the same endpoint at
 * `GET {baseURL}/models`.
 */

import type { PiAiProviderProfile } from "@deepseek-ai/dsh-llm-pi-ai";
import { KILO_MODELS } from "./kilo-models.js";

/** Route key in every `providers` dict, the `Models` collection, and the UI. */
export const KILO_PROVIDER_ID = "kilo";

/** Display name shown by selectors and configuration surfaces. */
export const KILO_DISPLAY_NAME = "Kilo Gateway";

/** Endpoint of Kilo's OpenAI-compatible gateway. */
export const KILO_BASE_URL = "https://api.kilo.ai/api/gateway";

/**
 * Credential reference (an environment-variable name) resolved per request
 * through `ctx.credentials`. Store it with `KILO_API_KEY=…` in the launching
 * environment or through the credentials service; a named reference that misses
 * fails the request loudly rather than falling back to an ambient key.
 */
export const KILO_API_KEY_ENV = "KILO_API_KEY";

/**
 * The route's model roster in `llm-pi-ai`'s own vocabulary.
 *
 * Capacities are copied from the gateway listing; reasoning levels are read
 * from the model's declared `reasoningEfforts`, where the key is the level the
 * seam offers and the value is the wire spelling. A model that does not
 * reason declares `false`, which keeps the surface from offering a control
 * the endpoint cannot honour.
 */
export const KILO_MODEL_PROFILES = KILO_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  contextWindow: model.contextWindow,
  maxTokens: model.maxTokens,
  input: [...model.input] as ("text" | "image")[],
  reasoningEfforts: (model.reasoning && model.reasoningLevels.length
    ? (Object.fromEntries(
        model.reasoningLevels.map((level) => [level === "none" ? "off" : level, level]),
      ) as unknown as { [key: string]: string | null })
    : false) as unknown as false | { [key: string]: string | null },
}));

/** The `llm-pi-ai` provider profile for this route. */
export const KILO_PROVIDER_PROFILE: PiAiProviderProfile = {
  apiKeyEnv: KILO_API_KEY_ENV,
  displayName: KILO_DISPLAY_NAME,
  api: "openai-completions",
  baseURL: KILO_BASE_URL,
  models: KILO_MODEL_PROFILES,
  retryPolicy: { mode: "normal", maxRetries: 2 },
};

/** The route table this module contributes, keyed by provider. */
export function kiloRoutes(): Record<string, PiAiProviderProfile> {
  return { [KILO_PROVIDER_ID]: KILO_PROVIDER_PROFILE };
}
