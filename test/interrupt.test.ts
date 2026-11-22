import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ctrlCAction } from "../src/interactive-mode/interrupt.ts";

test("Ctrl+C clears drafts, interrupts live turns, then exits", () => {
  assert.equal(ctrlCAction({ draft: true, active: false }), "clear");
  assert.equal(ctrlCAction({ draft: true, active: true }), "clear");
  assert.equal(ctrlCAction({ draft: false, active: true }), "interrupt");
  assert.equal(ctrlCAction({ draft: false, active: false }), "exit");
});
