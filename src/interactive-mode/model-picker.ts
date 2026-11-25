/**
 * Model picker flows
 *
 * The `/model` command: the full model selector, the plain list used when a
 * provider is already known, and persisting a chosen pair as the startup
 * default. Extracted from `ui.ts`; the orchestrator supplies the host below.
 */

import type { Component, SelectItem } from "@earendil-works/pi-tui";
import { loadModel, preferencesPath, saveModel } from "../runtime/preferences.ts";
import type { Runtime } from "../runtime/runtime.ts";
import type { Route } from "../interfaces.ts";
import type { SearchPicker } from "./picker.ts";

/** Orchestrator services the model picker flows need. */
export interface ModelPickerHost {
  readonly runtime: Runtime;
  readonly dshHome: string | undefined;
  /** TUI handle the selector component needs. */
  readonly tui: { requestRender: () => void };
  /** Append a transcript row. */
  add(label: string, text?: unknown): void;
  /** Push/pop overlay panels. */
  showPanel(panel: Component): void;
  dismissPanel(clearAll?: boolean): void;
  /** True while any overlay is open. */
  hasOverlays(): boolean;
  /** Open (or resume) a session on a route; owns all transcript state. */
  connect(route: Route, options?: { sessionId?: string; notifyModel?: boolean }): Promise<void>;
  /** Switch model/provider without clearing transcript/queue state. */
  switchModel(route: Route, options?: { sessionId?: string; notifyModel?: boolean }): Promise<void>;
  /** Search picker for the provider-scoped model list. */
  select(
    items: SelectItem[],
    title: string,
    onSelect: (value: string) => void,
    selected?: string,
    searchable?: boolean,
  ): SearchPicker;
}

/** Persist a provider/model pair as the startup default (Ctrl+S in the picker). */
export async function saveModelDefault(
  host: ModelPickerHost,
  model: { provider: string; id: string },
): Promise<void> {
  const selection = host.runtime.selection();
  const sameRoute =
    selection !== undefined &&
    selection.provider === model.provider &&
    selection.model === model.id;
  try {
    await saveModel(preferencesPath(host.dshHome), {
      provider: model.provider,
      model: model.id,
      ...(sameRoute && selection.effort !== undefined ? { effort: selection.effort } : {}),
    });
    host.add("Model", `Default: ${model.provider}/${model.id}`);
  } catch (error) {
    host.add("Error", error instanceof Error ? error.message : String(error));
  }
}

/** `/model` — the full selector: scoped models, current selection, saved default. */
export async function pickModel(
  host: ModelPickerHost,
  sessionId: string | undefined = host.runtime.session?.id,
): Promise<void> {
  const [{ ModelSelectorComponent }, { catalogModelRuntime, catalogModels }] = await Promise.all([
    import("./model-selector.ts"),
    import("./model-catalog-runtime.ts"),
  ]);
  const selection = host.runtime.selection();
  const current =
    selection === undefined
      ? undefined
      : { provider: selection.provider, id: selection.model, name: selection.model };
  // "scoped" keeps the providers the user can actually authenticate against.
  const authenticated = new Set(host.runtime.authProviders().map((provider) => provider.value));
  const scoped = catalogModels([...authenticated]);
  const saved = await loadModel(preferencesPath(host.dshHome));
  const defaultModel =
    saved === undefined
      ? undefined
      : { provider: saved.provider, id: saved.model, name: saved.model };
  const picker = new ModelSelectorComponent(
    host.tui,
    current,
    catalogModelRuntime(),
    scoped.map((model) => ({ model })),
    (model) => {
      host.dismissPanel();
      picker.dispose();
      void host.switchModel(
        { provider: model.provider, model: model.id },
        { sessionId, notifyModel: true },
      );
    },
    () => {
      host.dismissPanel();
      picker.dispose();
    },
    "",
    (model) => {
      host.dismissPanel();
      picker.dispose();
      void saveModelDefault(host, model);
    },
    defaultModel,
    async (model) => {
      try {
        host.add("Test Connection", `Testing ${model.provider}/${model.id}...`);
        await host.runtime.testModelConnection(model.provider, model.id);
        host.add("Test Connection", `✓ ${model.provider}/${model.id} connected successfully`);
      } catch (error) {
        host.add(
          "Test Connection",
          `✗ ${model.provider}/${model.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
  host.showPanel(picker);
}

/** Provider already chosen — show its models as a flat searchable list. */
export async function pickProviderModel(
  host: ModelPickerHost,
  provider: string,
  sessionId?: string,
): Promise<void> {
  const { models } = await import("../runtime/catalog.ts");
  const picker = host.select(
    models(provider).map((model) => ({
      value: model.id,
      label: model.id,
      description: model.name,
    })),
    "Models",
    (model) => {
      // Close all overlays (provider + model picker) before connecting.
      host.dismissPanel(true);
      void host.switchModel({ provider, model }, { sessionId, notifyModel: true });
    },
    undefined,
    true,
  );
  picker.onCancel = () => {
    // Close the model picker only; a parent provider picker (if any) remains.
    host.dismissPanel();
    if (!host.hasOverlays()) {
      // No parent picker, so go back to provider selection.
      void pickModel(host, sessionId);
    }
  };
}
