import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureConsole } from "../src/interactive-mode/tui-console.ts";

function currentConsole() {
  return {
    debug: console.debug,
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
}

function restoreConsole(original: ReturnType<typeof currentConsole>) {
  console.debug = original.debug;
  console.log = original.log;
  console.info = original.info;
  console.warn = original.warn;
  console.error = original.error;
}

test("TUI console capture logs diagnostics and restores the console", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-console-"));
  const original = currentConsole();
  let restore: (() => void) | undefined;
  try {
    const logFile = join(directory, "nested", "tui.log");
    restore = captureConsole(logFile);
    assert.notEqual(console.warn, original.warn);
    console.warn("[tag]", "listing failed");
    console.error("plain error");
    restore();
    restore = undefined;
    assert.equal(console.warn, original.warn);
    assert.equal(console.log, original.log);
    const text = await readFile(logFile, "utf8");
    assert.match(text, /WARN \[tag\] listing failed/);
    assert.match(text, /ERROR plain error/);
  } finally {
    restore?.();
    restoreConsole(original);
    await rm(directory, { recursive: true, force: true });
  }
});

test("TUI console capture never writes over the screen when the log is unavailable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-console-"));
  const original = currentConsole();
  let restore: (() => void) | undefined;
  try {
    const blocker = join(directory, "not-a-directory");
    await writeFile(blocker, "x");
    restore = captureConsole(join(blocker, "tui.log"));
    assert.doesNotThrow(() => console.warn("dropped"));
    restore();
    restore = undefined;
    assert.equal(console.warn, original.warn);
  } finally {
    restore?.();
    restoreConsole(original);
    await rm(directory, { recursive: true, force: true });
  }
});
