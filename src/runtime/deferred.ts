import type { Context, Plugin } from "@deepseek-ai/cordis";
import { interpolate } from "@deepseek-ai/cordis-plugin-loader";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  group?: unknown;
  inject?: unknown;
}

/** Rows and mode handed to the app plugin for the two-phase boot. */
export interface DeferredPlan {
  rows: DeferredPlugin[];
  full: boolean;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lazydshDeferred: DeferredPlan;
  }
}

/** One row to mount after the first frame instead of during boot. */
export interface DeferredPlugin {
  id: string;
  name: string;
  config?: unknown;
  inject?: unknown;
}

function toDeferredPlugin(entry: EntryState): DeferredPlugin {
  const plugin: DeferredPlugin = { id: entry.id, name: entry.name };
  if (entry.config !== undefined) plugin.config = entry.config;
  if (entry.inject !== undefined) plugin.inject = entry.inject;
  return plugin;
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
    selected.push(toDeferredPlugin(entry));
  }
  return selected;
}

/**
 * Rows whose `disabled` is a `!!js` expression but which are enabled in this
 * launcher's composition. `profileContext` is provided before the include
 * mounts; the platform rows are the ones the expression selects.
 */
const KNOWN_EXPRESSION_IDS = new Set([
  "plugin-manager",
  "config-editor",
  "settings",
  "hmr",
  "bash-sandbox",
  "tool-bash",
  "pwsh-sandbox",
  "tool-pwsh",
]);

function expressionEnabled(id: string): boolean {
  if (id === "plugin-manager" || id === "config-editor" || id === "settings" || id === "hmr")
    return true;
  return process.platform === "win32"
    ? id === "pwsh-sandbox" || id === "tool-pwsh"
    : id === "bash-sandbox" || id === "tool-bash";
}

/**
 * Whether every row can be applied directly after the first frame. Groups and
 * rows with `!!js` expressions this launcher does not understand need the
 * Loader's composition, so those profiles keep the selective boot path.
 */
export function canDeferEveryRow(entries: readonly EntryState[]): boolean {
  for (const entry of entries) {
    if (entry.id === "lazydsh") continue;
    if (entry.group === true) return false;
    if (typeof entry.name !== "string") return false;
    if (
      entry.disabled !== true &&
      typeof entry.disabled !== "boolean" &&
      entry.disabled !== undefined &&
      entry.disabled !== null &&
      !KNOWN_EXPRESSION_IDS.has(entry.id)
    )
      return false;
  }
  return true;
}

/**
 * Select every enabled plugin row for the two-phase TUI. The launcher plugin
 * itself stays eager because it paints the shell and owns the app lifecycle;
 * every other row is applied after that first frame.
 */
export function selectAllDeferredPlugins(
  entries: readonly EntryState[],
  baseDir?: string,
): DeferredPlugin[] {
  const selected: DeferredPlugin[] = [];
  for (const entry of entries) {
    if (entry.id === "lazydsh" || entry.group === true) continue;
    if (typeof entry.name !== "string") continue;
    if (entry.disabled === true) continue;
    if (
      typeof entry.disabled !== "boolean" &&
      entry.disabled !== undefined &&
      entry.disabled !== null &&
      !expressionEnabled(entry.id)
    )
      continue;
    const plugin = toDeferredPlugin(entry);
    if (baseDir !== undefined && (entry.name.startsWith(".") || isAbsolute(entry.name)))
      plugin.name = pathToFileURL(resolve(baseDir, entry.name)).href;
    selected.push(plugin);
  }
  return selected;
}

/** Apply config patches (for example the pi-ai provider table) to deferred rows. */
export function applyDeferredPatches(
  rows: readonly DeferredPlugin[],
  patches: readonly { id?: string; config?: unknown }[],
): DeferredPlugin[] {
  const byId = new Map<string, { id?: string; config?: unknown }>();
  for (const patch of patches) if (patch.id !== undefined) byId.set(patch.id, patch);
  return rows.map((row) => {
    const patch = byId.get(row.id);
    if (patch?.config === undefined) return row;
    const config =
      row.config !== null && typeof row.config === "object" && !Array.isArray(row.config)
        ? {
            ...(patch.config as Record<string, unknown>),
            ...(row.config as Record<string, unknown>),
          }
        : patch.config;
    return { ...row, config };
  });
}

/** Merge a row-level inject list with the plugin's own static dependencies. */
function withRowInject(module: Plugin, inject: unknown): Plugin {
  if (!Array.isArray(inject)) return module;
  const base = (module as { inject?: unknown }).inject;
  const merged = Array.isArray(base) ? [...base] : [];
  for (const name of inject)
    if (typeof name === "string" && !merged.includes(name)) merged.push(name);
  if (merged.length === 0) return module;
  return { ...(module as object), inject: merged } as Plugin;
}

/** Services the interactive Runtime needs before it can open a session. */
export const RUNTIME_SERVICE_NAMES = [
  "agents",
  "workingDirectory",
  "commands",
  "attachments",
  "sessionProjections",
  "llm",
  "authorization",
  "credentials",
  "userQuestions",
  "sessionTitle",
  "workspaceRegistry",
  "jobs",
  "fileReferences",
  "skills",
] as const;

/** Wait for deferred plugins to publish every service the Runtime uses. */
export async function waitForRuntimeServices(ctx: Context, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const missing = RUNTIME_SERVICE_NAMES.filter((name) => ctx.get(name) === undefined);
    if (missing.length === 0) return;
    if (Date.now() >= deadline)
      throw new Error(`lazydsh: services did not start: ${missing.join(", ")}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
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
  onProgress?: (loaded: number, total: number, id: string) => void,
): Promise<void> {
  if (plugins.length === 0) return;
  const root = ctx.root;
  const total = plugins.length;
  let loaded = 0;
  const results = await Promise.allSettled(
    plugins.map(async (plugin) => {
      const namespace = await import(plugin.name);
      const module = (namespace as { default?: Plugin }).default ?? (namespace as Plugin);
      const pluginModule = withRowInject(module, plugin.inject);
      await withinTimeout(root.plugin(pluginModule, interpolate(root, plugin.config)), plugin.id);
      loaded += 1;
      onProgress?.(loaded, total, plugin.id);
    }),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected")
      ctx.logger.warn(`lazydsh: deferred plugin ${plugins[index].id} did not start`, result.reason);
  });
}
