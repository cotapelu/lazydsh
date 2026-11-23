import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ProcessTerminal, TuiMainScreen, visibleWidth } from "@earendil-works/pi-tui";
import { stripVTControlCharacters } from "node:util";
import { BashExecutionComponent } from "../src/interactive-mode/bash-execution.ts";

const ui = new TuiMainScreen(new ProcessTerminal());

const plain = (lines: string[]) => stripVTControlCharacters(lines.join("\n"));

test("an excluded (!!) run still renders its command and output in the card", () => {
  const card = new BashExecutionComponent("secret-cli --token", ui, true);
  card.appendOutput("token: abc123");
  card.setComplete(0, false, undefined, undefined);
  const text = plain(card.render(80));
  assert.match(text, /secret-cli --token/);
  // The output stays visible in the transcript even though the model never sees it.
  assert.match(text, /token: abc123/);
});

test("a failed run shows its exit code and a long output collapses to a preview", () => {
  const card = new BashExecutionComponent("make build", ui, false);
  for (let line = 1; line <= 40; line++) card.appendOutput(`line ${line}\n`);
  card.setComplete(2, false, undefined, undefined);
  const text = plain(card.render(80));
  assert.match(text, /\(exit 2\)/);
  assert.match(text, /more lines/);
  // The preview keeps the newest lines and drops the oldest.
  assert.match(text, /line 40/);
  assert.doesNotMatch(text, /\bline 1\b/);
});

test("a cancelled run is reported instead of showing a completion status", () => {
  const card = new BashExecutionComponent("sleep 10", ui, false);
  card.setComplete(undefined, true, undefined, undefined);
  assert.match(plain(card.render(80)), /\(cancelled\)/);
});

test("the card never overflows the terminal width", () => {
  const card = new BashExecutionComponent("a-very-long-command-line ".repeat(8), ui, true);
  card.appendOutput("x".repeat(200));
  card.setComplete(0, false, undefined, undefined);
  for (const width of [20, 40, 80]) {
    for (const line of card.render(width))
      assert.ok(visibleWidth(line) <= width, `overflow at ${width}`);
  }
});
