/**
 * Custom Providers Index
 *
 * Provider routes that pi-ai does not ship, declared as `llm-pi-ai`
 * configuration so the existing adapter serves them. To add one: write a
 * `<name>-config.ts` exporting a route table, list it here, and register its id
 * in `../catalog.ts` so the UI can offer it.
 */

export {
  KILO_PROVIDER_ID,
  KILO_DISPLAY_NAME,
  KILO_BASE_URL,
  KILO_API_KEY_ENV,
  KILO_MODEL_PROFILES,
  KILO_PROVIDER_PROFILE,
  kiloRoutes,
} from "./kilo-config.js";
export { KILO_MODELS, type KiloModelConfig } from "./kilo-models.js";
