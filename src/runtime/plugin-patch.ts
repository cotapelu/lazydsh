import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PluginOptions } from "../plugin.ts";

/**
 * The plugin entry, resolved from this module's location rather than a fixed
 * relative path: source runs live at `src/plugin.ts` next to the launcher,
 * the bundle ships `dist/plugin.mjs` beside `dist/cli.mjs`, and both must
 * resolve no matter which directory this file is loaded from.
 */
function pluginEntryPath(): string {
  let dir = fileURLToPath(new URL(".", import.meta.url));
  for (let depth = 0; depth < 4; depth += 1) {
    for (const name of ["plugin.ts", "plugin.mjs"]) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(fileURLToPath(new URL(".", import.meta.url)), "plugin.mjs");
}

// Mount the SDK app services without its Office dependencies.
export function profilePatch(appService: string) {
  return [
    {
      id: "system-prompt",
      config: { personaPrefix: "You are a coding agent powered by the {{model}} model." },
    },
    { id: "session-title-llm", disabled: true },
    { id: "hmr", disabled: true },
    { id: "tool-plugin-manager", disabled: false },
    {
      insert: [
        { id: "connection", name: "@deepseek-ai/dsh-client-connection" },
        { id: "file-upload", name: "@deepseek-ai/dsh-client-file-upload" },
        { id: "workspace", name: "@deepseek-ai/dsh-workspace" },
        { id: "schedule", name: "@deepseek-ai/dsh-schedule", inject: [appService] },
        { id: "time-context", name: "@deepseek-ai/dsh-time-context" },
        { id: "tool-schedule", name: "@deepseek-ai/dsh-tool-schedule" },
        { id: "tool-ask-user", name: "@deepseek-ai/dsh-tool-ask-user" },
        { id: "present", name: "@deepseek-ai/dsh-tool-present" },
        { id: "file-reference-local", name: "@deepseek-ai/dsh-file-reference-local" },
        {
          id: "deliverable-file-references",
          name: "@deepseek-ai/dsh-deliverable-file-references",
        },
      ],
    },
  ];
}

export function pluginPatch(config: PluginOptions = {}) {
  return [
    ...profilePatch("lazydshApp"),
    {
      insert: [
        {
          id: "lazydsh",
          name: pluginEntryPath(),
          config,
        },
      ],
    },
  ];
}
