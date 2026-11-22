/**
 * Model Catalog Runtime
 *
 * The interactive model selector was ported against pi-coding-agent's
 * `ModelRuntime` surface (`getAvailableSnapshot` / `getModel` / `refresh`),
 * which the DSH `llm` service does not expose. This adapter presents
 * lazydsh's own catalog (the same one `--list` and `/model` validate
 * against) in that shape, so the selector runs unchanged.
 */

import { models, providers } from "../runtime/catalog.ts";
import type { CatalogModel, ModelRuntime } from "../interfaces.ts";

function toModel(provider: string, model: { id: string; name?: string }): CatalogModel {
  return { provider, id: model.id, name: model.name ?? model.id };
}

/** Every catalog model, optionally narrowed to a provider subset. */
export function catalogModels(providerIds?: readonly string[]): CatalogModel[] {
  const list = providerIds ?? providers;
  return list.flatMap((provider) => models(provider).map((model) => toModel(provider, model)));
}

/**
 * The pi-shaped runtime the selector expects. There is no live catalog
 * service to refresh here (the static table ships in the bundle), so
 * `refresh` is absent: the coordinator treats it as already fresh.
 */
export function catalogModelRuntime(): ModelRuntime {
  return {
    getAvailableSnapshot: () => catalogModels(),
    getModel: (provider: string, id: string) =>
      catalogModels([provider]).find((model) => model.id === id),
    getError: () => undefined,
  };
}
