import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { StatusIndicatorContainer } from "../src/interactive-mode/components/status-container.ts";

/** The indicators only need a render pinger from the TUI. */
const tui = { requestRender: () => {} };
const plain = (container: StatusIndicatorContainer, width = 60) =>
  container.render(width).map(stripVTControlCharacters).join("\n");

test("retry shows the attempt, the ceiling, and a countdown", () => {
  const container = new StatusIndicatorContainer(tui);
  container.show("retry", { retryCount: 2, maxAttempts: 5, delayMs: 8000 });
  const shown = plain(container);
  assert.match(shown, /Retrying \(2\/5\) in \d+s/);
  assert.match(shown, /to cancel/);
});

test("working renders the given message (the stopping state relies on this)", () => {
  const container = new StatusIndicatorContainer(tui);
  container.show("working", { message: "Stopping" });
  assert.match(plain(container), /Stopping/);
  assert.doesNotMatch(plain(container), /Retrying/);
});

test("compaction renders its label for both reasons", () => {
  const container = new StatusIndicatorContainer(tui);
  container.show("compaction", { reason: "manual" });
  assert.match(plain(container), /Compacting context/);
  container.show("compaction", { reason: "overflow" });
  assert.match(plain(container), /Auto-compacting/);
});

test("idle defaults to Ready and accepts a custom message", () => {
  const container = new StatusIndicatorContainer(tui);
  container.show("idle");
  assert.match(plain(container), /Ready/);
  container.show("idle", { message: "Ready · 2 queued" });
  assert.match(plain(container), /2 queued/);
});
