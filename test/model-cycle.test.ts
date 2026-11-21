import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { nextProvider } from "../src/interactive-mode/model-cycle.ts";

test("cycling walks forward and backward around the provider list", () => {
  const order = ["a", "b", "c"];
  assert.equal(nextProvider(order, "a", 1), "b");
  assert.equal(nextProvider(order, "b", 1), "c");
  assert.equal(nextProvider(order, "c", 1), "a"); // wraps
  assert.equal(nextProvider(order, "a", -1), "c"); // wraps backwards
  assert.equal(nextProvider(order, "b", -1), "a");
});

test("a single provider stays put and an unknown current starts at the top", () => {
  assert.equal(nextProvider(["only"], "only", 1), "only");
  assert.equal(nextProvider(["a", "b"], "not-listed", 1), "b");
  assert.equal(nextProvider(["a", "b"], "not-listed", -1), "b");
});

test("an empty order has no destination", () => {
  assert.equal(nextProvider([], "a", 1), undefined);
});
