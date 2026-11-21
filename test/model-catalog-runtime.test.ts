import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { catalogModelRuntime, catalogModels } from "../src/interactive-mode/model-catalog-runtime.ts";
import { providers } from "../src/runtime/catalog.ts";

test("the adapter lists every catalog model and narrows by provider", () => {
  const all = catalogModels();
  assert.ok(all.length > 0);
  assert.ok(all.every((model) => model.provider && model.id && model.name));
  const first = providers[0]!;
  const scoped = catalogModels([first]);
  assert.ok(scoped.length > 0);
  assert.ok(scoped.every((model) => model.provider === first));
  assert.equal(catalogModels(["not-a-provider"]).length, 0);
});

test("the runtime surface answers snapshot and lookup queries", () => {
  const runtime = catalogModelRuntime();
  const snapshot = runtime.getAvailableSnapshot();
  assert.ok(snapshot.length > 0);
  const sample = snapshot[0]!;
  const found = runtime.getModel(sample.provider, sample.id);
  assert.equal(found?.id, sample.id);
  assert.equal(found?.provider, sample.provider);
  assert.equal(runtime.getModel(sample.provider, "no-such-model"), undefined);
  // No live catalog service exists here; the coordinator treats that as fresh.
  assert.equal(runtime.refresh, undefined);
  assert.equal(runtime.getError?.(), undefined);
});