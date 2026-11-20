/**
 * Model Catalog Refresh Coordinator
 *
 * Shares concurrent interactive all-catalog refreshes while keeping each
 * caller's cancellation independent.
 * Ported from pi-coding-agent's model-catalog-refresh.js
 */

import type { ModelRuntime } from "./interfaces.ts";

interface RefreshResult {
  aborted: boolean;
  errors: Map<string, Error>;
}

class ModelCatalogRefreshCoordinator {
  private activeByRuntime = new WeakMap<ModelRuntime, RefreshState>();

  async refresh(modelRuntime: ModelRuntime, signal: AbortSignal): Promise<RefreshResult> {
    signal.throwIfAborted();
    let active = this.activeByRuntime.get(modelRuntime);
    if (!active) {
      const controller = new AbortController();
      const operation = modelRuntime.refresh?.({ signal: controller.signal });
      if (!operation) {
        return { aborted: false, errors: new Map() };
      }
      const promise = this.raceWithAbortSignal(
        operation as Promise<RefreshResult>,
        controller.signal,
      ).finally(() => {
        const current = this.activeByRuntime.get(modelRuntime);
        if (current && current.controller === controller) {
          this.activeByRuntime.delete(modelRuntime);
        }
      });
      const created: RefreshState = { controller, promise, waiters: 0 };
      active = created;
      this.activeByRuntime.set(modelRuntime, active);
    }
    active.waiters++;
    return this.raceWithAbortSignal(active.promise, signal).finally(() => {
      active!.waiters--;
      if (active!.waiters === 0 && this.activeByRuntime.get(modelRuntime) === active) {
        active!.controller.abort();
      }
    });
  }

  private async raceWithAbortSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  }
}

interface RefreshState {
  controller: AbortController;
  promise: Promise<RefreshResult>;
  waiters: number;
}

const modelCatalogRefreshCoordinator = new ModelCatalogRefreshCoordinator();

/** Share concurrent interactive all-catalog refreshes while keeping each caller's cancellation independent. */
export function refreshModelCatalogs(
  modelRuntime: ModelRuntime,
  signal: AbortSignal,
): Promise<RefreshResult> {
  return modelCatalogRefreshCoordinator.refresh(modelRuntime, signal);
}
