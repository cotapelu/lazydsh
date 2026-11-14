import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadModel, saveModel } from "../src/preferences.ts";

test("model preference survives reload and ignores malformed preferences", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-preference-"));
  const path = join(directory, "nested", "model.json");
  try {
    assert.equal(await loadModel(path), undefined);
    const route = { provider: "openai-codex", model: "gpt-5.4" };
    await saveModel(path, route);
    assert.deepEqual(await loadModel(path), route);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), route);
    await writeFile(path, "null");
    assert.equal(await loadModel(path), undefined);
    await writeFile(path, "broken");
    assert.equal(await loadModel(path), undefined);
    await writeFile(path, '{"provider": 42, "model": "test"}');
    assert.equal(await loadModel(path), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
