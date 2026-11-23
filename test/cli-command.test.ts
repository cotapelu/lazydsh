// Keep the notifications plain so the assertions below match their text.
process.env.NO_COLOR = "1";

import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { AuthorizationDeclinedError } from "@deepseek-ai/dsh-authorization";
import { cliLogin, cliLogout } from "../src/interactive-mode/cli-auth.ts";
import type { Runtime } from "../src/runtime/runtime.ts";

/** Capture what the flow reported, and keep the test log clean. */
function capture() {
  const out = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  // The terminal pickers write their lists straight to stdout.
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  return {
    text: () =>
      [
        ...out.mock.calls.map((call) => call.join(" ")),
        ...write.mock.calls.map((call) => String(call[0])),
      ].join("\n"),
    error: () => err.mock.calls.map((call) => call.join(" ")).join("\n"),
    restore: () => {
      out.mockRestore();
      err.mockRestore();
      write.mockRestore();
    },
  };
}

/** A stdin the picker can read numbered answers from. */
function answerStdin(...lines: string[]) {
  const stream = new PassThrough();
  // The flows gate on a terminal, so the stream has to look like one.
  Object.defineProperty(stream, "isTTY", { value: true, configurable: true });
  for (const line of lines) stream.write(`${line}\n`);
  return stream;
}

function useStdin(stream: unknown) {
  const original = process.stdin;
  Object.defineProperty(process, "stdin", { value: stream, configurable: true });
  return () => Object.defineProperty(process, "stdin", { value: original, configurable: true });
}

/** Stand in for a terminal so the prompts are allowed to run. */
function pretendTty() {
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  return () =>
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
}

function mockRuntime(overrides: Record<string, unknown> = {}): Runtime {
  return {
    authProviders: () => [
      { value: "opencode-go", label: "OpenCode Go", description: "opencode-go · API key" },
      { value: "openai-codex", label: "OpenAI Codex", description: "openai-codex · OAuth" },
    ],
    hasCredentials: async () => false,
    authenticate: async () => undefined,
    logout: async () => undefined,
    ...overrides,
  } as unknown as Runtime;
}

test("login authenticates the requested provider and reports success", async () => {
  const restore = pretendTty();
  const log = capture();
  const restoreStdin = useStdin(answerStdin());
  try {
    const calls: unknown[] = [];
    await cliLogin(
      mockRuntime({
        authenticate: async (_signal: unknown, options: unknown) => {
          calls.push(options);
        },
      }),
      "opencode-go",
      new AbortController().signal,
    );
    assert.equal(calls.length, 1);
    assert.equal((calls[0] as { provider: string }).provider, "opencode-go");
    assert.match(log.text(), /logged in: opencode-go/);
  } finally {
    restoreStdin();
    log.restore();
    restore();
  }
});

test("login reports a declined flow as cancelled instead of throwing", async () => {
  const restore = pretendTty();
  const log = capture();
  const restoreStdin = useStdin(answerStdin());
  try {
    await cliLogin(
      mockRuntime({
        authenticate: async () => {
          throw new AuthorizationDeclinedError("Login cancelled");
        },
      }),
      "opencode-go",
      new AbortController().signal,
    );
    assert.match(log.text(), /login: Cancelled\./);
  } finally {
    restoreStdin();
    log.restore();
    restore();
  }
});

test("login without a terminal fails before any prompt", async () => {
  Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
  await assert.rejects(
    cliLogin(mockRuntime(), "opencode-go", new AbortController().signal),
    /interactive terminal/,
  );
});

test("login without a provider reads the choice from the terminal", async () => {
  const restore = pretendTty();
  const log = capture();
  const restoreStdin = useStdin(answerStdin("2"));
  try {
    const calls: unknown[] = [];
    await cliLogin(
      mockRuntime({
        authenticate: async (_signal: unknown, options: unknown) => {
          calls.push(options);
        },
      }),
      undefined,
      new AbortController().signal,
    );
    assert.equal((calls[0] as { provider: string }).provider, "openai-codex");
  } finally {
    restoreStdin();
    log.restore();
    restore();
  }
});

test("logout reports providers that were never logged in", async () => {
  const log = capture();
  try {
    await cliLogout(mockRuntime({ logout: async () => undefined }), "opencode-go");
    assert.match(log.text(), /logout: Not logged in to opencode-go\./);
    assert.equal(log.error(), "");
  } finally {
    log.restore();
  }
});

test("logout removes the credential and names the environment refs that remain", async () => {
  const log = capture();
  try {
    const removed: string[] = [];
    await cliLogout(
      mockRuntime({
        logout: async (provider: string) => (removed.push(provider), ["OPENCODE_API_KEY"]),
      }),
      "opencode-go",
    );
    assert.deepEqual(removed, ["opencode-go"]);
    assert.match(log.text(), /logged out: opencode-go/);
    assert.match(log.error(), /Credentials are still available from OPENCODE_API_KEY/);
  } finally {
    log.restore();
  }
});

test("logout without a provider lists only stored credentials", async () => {
  const restore = pretendTty();
  const log = capture();
  const restoreStdin = useStdin(answerStdin("1"));
  try {
    const removed: string[] = [];
    await cliLogout(
      mockRuntime({
        hasCredentials: async (provider: string) => provider === "opencode-go",
        logout: async (provider: string) => (removed.push(provider), undefined),
      }),
      undefined,
    );
    assert.deepEqual(removed, ["opencode-go"]);
    assert.match(log.text(), /Choose a provider to log out of:/);
    assert.match(log.text(), /OpenCode Go/);
    // A provider without stored credentials never appears in the picker.
    assert.doesNotMatch(log.text(), /OpenAI Codex/);
  } finally {
    restoreStdin();
    log.restore();
    restore();
  }
});

test("logout explains that nothing is stored when no provider has credentials", async () => {
  const restore = pretendTty();
  const log = capture();
  const restoreStdin = useStdin(answerStdin());
  try {
    await cliLogout(mockRuntime({ hasCredentials: async () => false }), undefined);
    assert.match(log.text(), /No stored credentials to remove/);
  } finally {
    restoreStdin();
    log.restore();
    restore();
  }
});
