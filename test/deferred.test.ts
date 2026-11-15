import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { selectDeferredPlugins } from "../src/deferred.ts";

test("deferred selection keeps enabled rows with their module and config", () => {
  const entries = [
    { id: "plugin-manager", name: "@deepseek-ai/dsh-plugin-manager" },
    { id: "tool-web", name: "@deepseek-ai/dsh-tool-web", config: { pageSize: 2 } },
    { id: "llm", name: "@deepseek-ai/dsh-llm" },
  ];
  assert.deepEqual(selectDeferredPlugins(entries), [
    { id: "plugin-manager", name: "@deepseek-ai/dsh-plugin-manager", config: undefined },
    { id: "tool-web", name: "@deepseek-ai/dsh-tool-web", config: { pageSize: 2 } },
  ]);
});

test("deferred selection respects disabled rows and platform expressions", () => {
  const entries = [
    {
      id: "plugin-manager",
      name: "plugin-manager",
      disabled: { js: "!ctx.get('profileContext')" },
    },
    { id: "otel", name: "otel", disabled: true },
    { id: "tool-bash", name: "tool-bash", disabled: { js: "process.platform === 'win32'" } },
  ];
  assert.deepEqual(selectDeferredPlugins(entries), [
    { id: "plugin-manager", name: "plugin-manager", config: undefined },
  ]);
});
