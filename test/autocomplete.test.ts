import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Autocomplete } from "../src/interactive-mode/autocomplete.ts";

test("@ completion combines native references and preserves quoted paths, skills, and subagent text", async () => {
  const queries: string[] = [];
  const items = [
    { value: '@"folder with spaces/file.ts"', label: "@folder with spaces/file.ts" },
    { value: "@src/", label: "@src/" },
    { value: "/test-skill", label: "@skill:test-skill" },
    { value: "@worker", label: "@worker", description: "Subagent" },
  ];
  const provider = new Autocomplete(
    [{ name: "ps", description: "List jobs" }],
    process.cwd(),
    async (query) => {
      queries.push(query);
      return items;
    },
  );
  const options = { signal: new AbortController().signal };
  const line = 'Read @"folder with';
  const suggestions = await provider.getSuggestions([line], 0, line.length, options);
  assert.equal(suggestions?.prefix, '@"folder with');
  assert.deepEqual(queries, ["folder with"]);
  assert.deepEqual(suggestions?.items, items);
  assert.ok(
    (await provider.getSuggestions(["/p"], 0, 2, options))?.items.some(
      (item) => item.value === "ps",
    ),
  );
  await provider.getSuggestions(["user@example.com"], 0, 16, options);
  assert.equal(queries.length, 1);
  assert.equal(await provider.getSuggestions(["@"], 0, 1, { signal: AbortSignal.abort() }), null);
});
