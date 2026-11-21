import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { bashContextBlock, parseBashMode } from "../src/interactive-mode/bash-mode.ts";

test("single bang runs locally and stays in context", () => {
  const intent = parseBashMode("!ls -la");
  assert.deepEqual(intent, { command: "ls -la", prefix: "!", excludeFromContext: false });
});

test("double bang excludes the output from context", () => {
  const intent = parseBashMode("!!ls -la");
  assert.equal(intent?.excludeFromContext, true);
  assert.equal(intent?.command, "ls -la");
});

test("whitespace after the prefix is trimmed and prompts pass through", () => {
  assert.equal(parseBashMode("!   echo  hi ")?.command, "echo  hi");
  assert.equal(parseBashMode("hello"), undefined);
  assert.equal(parseBashMode("!"), undefined); // no command
  assert.equal(parseBashMode("/model"), undefined);
  assert.equal(parseBashMode(" !ls")?.command, "ls"); // leading whitespace is fine
  assert.equal(parseBashMode("echo !ls"), undefined); // only a line-leading bang counts
});

test("the context block carries the command, exit status, and output", () => {
  const intent = parseBashMode("!make build")!;
  const block = bashContextBlock(intent, {
    exitCode: 2,
    stdout: "done",
    stderr: "warning: x",
  });
  assert.match(block, /\[! make build — exit 2\]/);
  assert.match(block, /done/);
  assert.match(block, /warning: x/);
});

test("excluded runs contribute nothing to the context", () => {
  const intent = parseBashMode("!!secret-cli")!;
  assert.equal(bashContextBlock(intent, { exitCode: 0, stdout: "token" }), "");
});
