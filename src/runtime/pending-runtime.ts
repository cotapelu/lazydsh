import type { Runtime } from "./runtime.ts";

export interface PendingRuntime {
  /** A `Runtime`-shaped object usable before the real instance exists. */
  runtime: Runtime;
  /** Forward every later call to the real instance. */
  attach(runtime: Runtime): void;
}

/**
 * Placeholder passed to the TUI shell before the core plugins are loaded.
 *
 * The shell only reads `session` (for autocomplete) before the real Runtime is
 * attached, and the editor is kept non-submittable until then. Closing the
 * placeholder during startup is a no-op so Ctrl+C can always tear the process
 * down cleanly.
 */
export function createPendingRuntime(): PendingRuntime {
  let target: Runtime | undefined;
  const runtime = new Proxy({} as Runtime, {
    get(_placeholder, property) {
      if (target !== undefined) {
        const value: unknown = Reflect.get(target, property);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      }
      if (property === "session") return undefined;
      if (property === "close") return async () => {};
      if (property === "then") return undefined;
      return () => {
        throw new Error("lazydsh is still starting");
      };
    },
  });
  return {
    runtime,
    attach(next) {
      target = next;
    },
  };
}
