import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { PluginOptions } from "./plugin.ts";

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
          name: fileURLToPath(
            new URL(
              existsSync(new URL("./plugin.ts", import.meta.url)) ? "./plugin.ts" : "./plugin.mjs",
              import.meta.url,
            ),
          ),
          config,
        },
      ],
    },
  ];
}
