import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { runCommand } from "../src/command-runner.ts";
import type { Callbacks, Runtime } from "../src/runtime.ts";

test("ask cancels and fails rather than waiting for human approval or questions", async () => {
  for (const question of [false, true]) {
    let callbacks: Callbacks = {};
    let cancelled = 0,
      closed = 0;
    const output = vi.spyOn(process.stdout, "write");
    const runtime = {
      open: async (_route: unknown, next: Callbacks) => {
        callbacks = next;
      },
      run: async () => {
        if (question)
          await callbacks.onUserQuestion!(
            { questions: [] },
            { signal: new AbortController().signal },
          );
        else await callbacks.onApproval!({});
        return { finishReason: "aborted", finalResponse: "" };
      },
      cancel: async () => {
        cancelled++;
      },
      close: async () => {
        closed++;
      },
    } as unknown as Runtime;
    try {
      await assert.rejects(
        runCommand(
          runtime,
          { command: "ask", provider: "test", model: "test", prompt: "hello" },
          new AbortController().signal,
        ),
        question ? /Interactive questions/ : /Approval is required/,
      );
      assert.equal(cancelled, 1);
      assert.equal(closed, 1);
      assert.equal(output.mock.calls.length, 0);
    } finally {
      output.mockRestore();
    }
  }
});
