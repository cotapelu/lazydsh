import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import {
  applyDeferredPatches,
  canDeferEveryRow,
  selectAllDeferredPlugins,
  selectDeferredPlugins,
} from "../src/deferred.ts";

test("deferred selection keeps enabled rows with their module and config", () => {
  const entries = [
    { id: "plugin-manager", name: "@deepseek-ai/dsh-plugin-manager" },
    { id: "tool-web", name: "@deepseek-ai/dsh-tool-web", config: { pageSize: 2 } },
    { id: "llm", name: "@deepseek-ai/dsh-llm" },
  ];
  assert.deepEqual(selectDeferredPlugins(entries), [
    { id: "plugin-manager", name: "@deepseek-ai/dsh-plugin-manager" },
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
    { id: "plugin-manager", name: "plugin-manager" },
  ]);
});

test("full deferral selects every enabled row except the launcher", () => {
  const expression = { js: "process.platform" };
  const entries = [
    { id: "lazydsh", name: "./plugin.ts" },
    { id: "llm", name: "@deepseek-ai/dsh-llm" },
    { id: "schedule", name: "@deepseek-ai/dsh-schedule", inject: ["lazydshApp"] },
    { id: "otel", name: "@deepseek-ai/dsh-otel", disabled: true },
    { id: "plugin-manager", name: "@deepseek-ai/dsh-plugin-manager", disabled: expression },
    { id: "tool-bash", name: "@deepseek-ai/dsh-tool-bash", disabled: expression },
    { id: "tool-pwsh", name: "@deepseek-ai/dsh-tool-pwsh", disabled: expression },
  ];
  const selected = selectAllDeferredPlugins(entries);
  assert.deepEqual(
    selected.map((plugin) => plugin.id).sort(),
    [
      "llm",
      "plugin-manager",
      "schedule",
      process.platform === "win32" ? "tool-pwsh" : "tool-bash",
    ].sort(),
  );
  assert.deepEqual(selected.find((plugin) => plugin.id === "schedule")?.inject, ["lazydshApp"]);
});

test("deferred config patches leave user-provided values in control", () => {
  const rows = [
    { id: "llm-pi-ai", name: "llm-pi-ai" },
    {
      id: "other",
      name: "other",
      config: { provided: true, nested: { keep: 1 } },
    },
  ];
  const patched = applyDeferredPatches(rows, [
    { id: "llm-pi-ai", config: { providers: { deepseek: {} } } },
    { id: "other", config: { provided: false, added: 2 } },
  ]);
  assert.deepEqual(patched, [
    { id: "llm-pi-ai", name: "llm-pi-ai", config: { providers: { deepseek: {} } } },
    {
      id: "other",
      name: "other",
      config: { provided: true, nested: { keep: 1 }, added: 2 },
    },
  ]);
});

test("full deferral falls back when the composition uses Loader-only features", () => {
  assert.equal(
    canDeferEveryRow([
      { id: "llm", name: "@deepseek-ai/dsh-llm" },
      { id: "settings", name: "@deepseek-ai/dsh-settings", disabled: { js: "profileContext" } },
    ]),
    true,
  );
  assert.equal(canDeferEveryRow([{ id: "group", name: "group", group: true }]), false);
  assert.equal(
    canDeferEveryRow([{ id: "mystery", name: "mystery", disabled: { js: "something" } }]),
    false,
  );
});
