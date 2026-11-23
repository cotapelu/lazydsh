import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { askLine, askSecret, resolveChoice } from "../src/interactive-mode/cli-auth.ts";

const options = [
  { value: "deepseek-official", label: "DeepSeek" },
  { value: "opencode-go", label: "OpenCode Go" },
  { value: "openrouter", label: "OpenRouter" },
];

test("a typed number, id, or trimmed text resolves to one option", () => {
  assert.equal(resolveChoice("1", options)?.value, "deepseek-official");
  assert.equal(resolveChoice("3", options)?.value, "openrouter");
  assert.equal(resolveChoice("opencode-go", options)?.value, "opencode-go");
  assert.equal(resolveChoice("  openrouter  ", options)?.value, "openrouter");
});

test("numbers outside the list, unknown ids, and empty input resolve to nothing", () => {
  assert.equal(resolveChoice("0", options), undefined);
  assert.equal(resolveChoice("4", options), undefined);
  assert.equal(resolveChoice("-1", options), undefined);
  assert.equal(resolveChoice("unknown-provider", options), undefined);
  assert.equal(resolveChoice("", options), undefined);
  assert.equal(resolveChoice("   ", options), undefined);
  // Text that is not a number must not index the list (NaN lookup).
  assert.equal(resolveChoice("two", options), undefined);
});

/** A stdin stand-in the terminal prompts can read raw keystrokes from. */
function mockStdin() {
  const listeners = new Set<(chunk: Buffer) => void>();
  const rawModes: boolean[] = [];
  return {
    isTTY: true,
    setRawMode(value: boolean) {
      rawModes.push(value);
    },
    resume() {},
    pause() {},
    on(event: string, listener: (chunk: Buffer) => void) {
      if (event === "data") listeners.add(listener);
    },
    removeListener(event: string, listener: (chunk: Buffer) => void) {
      if (event === "data") listeners.delete(listener);
    },
    emit(text: string) {
      // Iterating the set directly is safe: a listener only removes itself.
      for (const listener of listeners) listener(Buffer.from(text));
    },
    get rawModes() {
      return rawModes;
    },
  };
}

/** Run `body` with `stdin` swapped in, restoring the real one afterwards. */
async function withStdin<T>(stdin: unknown, body: () => Promise<T>): Promise<T> {
  const original = process.stdin;
  const output = process.stdout.write.bind(process.stdout);
  // Keep the prompt out of the test log while still recording what was echoed.
  const written: string[] = [];
  process.stdout.write = ((chunk: string) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
  try {
    return await body();
  } finally {
    Object.defineProperty(process, "stdin", { value: original, configurable: true });
    process.stdout.write = output;
  }
}

test("a secret prompt returns the typed key without echoing it", async () => {
  const stdin = mockStdin();
  await withStdin(stdin, async () => {
    const pending = askSecret("API key: ");
    stdin.emit("sec");
    stdin.emit("ret\r");
    assert.equal(await pending, "secret");
    // The key never reaches the terminal: only the prompt was written.
    assert.deepEqual(stdin.rawModes, [true, false]);
  });
});

test("a secret prompt handles backspace and abandons on Ctrl+C", async () => {
  const removed = mockStdin();
  await withStdin(removed, async () => {
    const pending = askSecret("API key: ");
    removed.emit("ab");
    removed.emit("\u007f");
    removed.emit("c\r");
    assert.equal(await pending, "ac");
  });
  const interrupted = mockStdin();
  await withStdin(interrupted, async () => {
    const pending = askSecret("API key: ");
    interrupted.emit("abc\u0003");
    assert.equal(await pending, null);
  });
});

test("control characters carry no key material and empty input is no answer", async () => {
  const stdin = mockStdin();
  await withStdin(stdin, async () => {
    const pending = askSecret("API key: ");
    stdin.emit("\u0001\u009b");
    stdin.emit("\r");
    assert.equal(await pending, null);
  });
});

test("a plain prompt reads one line and reports EOF as no answer", async () => {
  const input = new PassThrough();
  await withStdin(input, async () => {
    const pending = askLine("Name: ");
    input.write("hello\n");
    assert.equal(await pending, "hello");
  });
  const ended = new PassThrough();
  await withStdin(ended, async () => {
    const pending = askLine("Name: ");
    ended.end();
    assert.equal(await pending, null);
  });
});
