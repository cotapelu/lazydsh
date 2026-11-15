import type { Context, Plugin } from "@deepseek-ai/cordis";
import { interpolate } from "@deepseek-ai/cordis-plugin-loader";

/**
 * Plugin rows the interactive TUI does not need before its first frame.
 *
 * Everything here is a tool, a tool's private service, or an optional
 * transport. Deferred rows are disabled for the initial boot and applied once
 * the startup screen is visible, before the first session opens, so the agent
 * still sees the complete tool set.
 */
export const DEFERRED_ENTRY_IDS: readonly string[] = [
  // Plugin management: only the plugin-manager tools consume this stack.
  "plugin-manager",
  "tool-plugin-manager",
  // Telemetry: only the feedback exporter consumes it.
  "otel",
  "session-telemetry-otel",
  // Remote API transport: the terminal UI does not expose an HTTP endpoint.
  "typert",
  "typert-loader",
  "typert-gateway",
  "remote-access",
  // Agent tools and the services only those tools consume.
  "mcp-resources",
  "workflow-ptc",
  "ptc-runtime",
  "tool-workflow",
  "web",
  "web-search-deepseek",
  "web-deepseek-api",
  "web-fetch-http",
  "tool-web",
  "tool-bash",
  "tool-pwsh",
  "tool-jobs",
  "tool-fs",
  "tool-fs-search",
  "tool-working-directory",
  "tool-skill",
  "tool-schedule",
  "tool-ask-user",
  "tool-todo",
  "tool-goal",
  "tool-subagent",
  "tool-subagent-control",
  "tool-subagent-fork",
  "tool-agent-team",
  "present",
];

interface EntryState {
  id: string;
  name: string;
  config?: unknown;
  disabled?: unknown;
}

/** One row to mount after the first frame instead of during boot. */
export interface DeferredPlugin {
  id: string;
  name: string;
  config?: unknown;
}

/**
 * Pick the rows that are effectively enabled and safe to load late.
 *
 * A row the user disabled stays disabled and is never activated. Rows whose
 * `disabled` is a `!!js` expression cannot be judged before the Loader exists;
 * the only one that matters here is `plugin-manager`, whose expression asks for
 * `profileContext`, which this launcher always provides. The platform-selected
 * shell tools use the same mechanism, so they are skipped rather than risking
 * a tool for the wrong platform.
 */
export function selectDeferredPlugins(entries: readonly EntryState[]): DeferredPlugin[] {
  const selected: DeferredPlugin[] = [];
  for (const entry of entries) {
    if (!DEFERRED_ENTRY_IDS.includes(entry.id)) continue;
    if (entry.disabled === true) continue;
    if (
      typeof entry.disabled !== "boolean" &&
      entry.disabled !== undefined &&
      entry.disabled !== null &&
      entry.id !== "plugin-manager"
    )
      continue;
    selected.push({ id: entry.id, name: entry.name, config: entry.config });
  }
  return selected;
}

/** A late plugin that never becomes ready must not block the first session. */
const ACTIVATION_TIMEOUT_MS = 5_000;

async function withinTimeout<T>(promise: PromiseLike<T>, id: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`deferred plugin ${id} timed out`)),
          ACTIVATION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Import and apply the deferred plugins on the root context, mirroring what the
 * Loader would have done, and wait until their services and tools settle.
 * Failures are reported but do not take down the TUI: the rest of the app
 * remains usable and the failing subsystem stays inactive.
 */
export async function activateDeferredPlugins(
  ctx: Context,
  plugins: readonly DeferredPlugin[],
): Promise<void> {
  if (plugins.length === 0) return;
  const root = ctx.root;
  const results = await Promise.allSettled(
    plugins.map(async (plugin) => {
      const namespace = await import(plugin.name);
      const module = (namespace as { default?: Plugin }).default ?? (namespace as Plugin);
      await withinTimeout(root.plugin(module, interpolate(root, plugin.config)), plugin.id);
    }),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected")
      ctx.logger.warn(`lazydsh: deferred plugin ${plugins[index].id} did not start`, result.reason);
  });
}
