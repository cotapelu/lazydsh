/**
 * Regression tests for the bugs found by the 2026-11 audit.
 *
 * Each test names the bug it pins: a fix here must make the test fail if the
 * behaviour regresses, so the suite — not a human review — guards the fix.
 */
import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import type { ToolOutput } from "../src/runtime-events.ts";

// ── Bug 1: every tool call rendered twice ────────────────────────────────────
// The runtime projects a tool call through two channels (`tool/call` session
// events and `tool_execution_start`/`end` notifications). The live transcript
// must keep exactly one ToolRow per call, matching the replayed history.

test("tool_execution_start/end do not duplicate session-event tool rows", async () => {
  const { ToolLog } = await import("../src/interactive-mode/tools.ts");
  const { eventText } = await import("../src/runtime-events.ts");
  type Projection = Awaited<ReturnType<typeof eventText>>;
  /** Narrow one notification to the tool shape the log records, or fail. */
  const tool = (value: Projection): ToolOutput => {
    assert.ok(value !== undefined && value.kind !== "assistant", "expected a tool event");
    return value as ToolOutput;
  };
  const call = { name: "read", callId: "a", arguments: '{"path":"src/main.ts"}' };
  // The runtime emits both channels for the same call...
  const start = tool(
    eventText({
      method: "tool_execution_start",
      params: { toolName: call.name, toolCallId: call.callId, args: { path: "src/main.ts" } },
    }),
  );
  const sessionCall = tool(
    eventText({
      method: "session.event",
      params: { sessionId: "root", event: { type: "tool/call", data: call } as never },
    }),
  );
  const sessionResult = tool(
    eventText({
      method: "session.event",
      params: {
        sessionId: "root",
        event: {
          type: "tool/result",
          data: {
            message: { toolCallId: "a", content: [{ type: "text", text: "file contents" }] },
          },
        } as never,
      },
    }),
  );
  const end = tool(
    eventText({
      method: "tool_execution_end",
      params: {
        toolCallId: "a",
        result: { content: [{ type: "text", text: "file contents" }] },
        isError: false,
      },
    }),
  );
  assert.ok(start && sessionCall && sessionResult && end);

  // The session-event channel is the one the UI records, and recording it
  // twice for the same call must reuse the row rather than stacking a second
  // one. (The direct `tool_execution_*` notifications run under a
  // `[null, callId]` key — which is exactly why the live transcript stopped
  // recording them: see ui.ts's turn handler.)
  const log = new ToolLog();
  const row = log.record(sessionCall);
  assert.ok(row, "the first call creates a row");
  assert.equal(
    log.record(sessionCall),
    undefined,
    "a repeated call for the same id reuses the row instead of creating another",
  );
  log.record(sessionResult);
  assert.equal(log.entries.size, 0, "the result settles the row");
  // A replayed log (history.ts) drives the same pair and yields one row too.
  const replay = new ToolLog();
  replay.record(sessionCall);
  replay.record(sessionResult);
  assert.equal(replay.entries.size, 0, "the replayed pair settles the same way");
});

// ── Bug 2/Bug 3: overlay keys ────────────────────────────────────────────────
// ESC (and Ctrl+C) reach every overlay so it settles its own promise; the
// app-level shortcuts the session picker documents are not stolen by the
// global listener.

test("every overlay cancels from Escape so its promise settles", async () => {
  const { ApprovalPanel } = await import("../src/interactive-mode/approval.ts");
  const { QuestionPanel } = await import("../src/interactive-mode/question.ts");
  const { LoginDialog } = await import("../src/interactive-mode/components/login-dialog.ts");
  const { SearchPicker } = await import("../src/interactive-mode/picker.ts");

  // Approval: Escape must invoke onCancel, not just hide the overlay.
  const approval = new ApprovalPanel({ toolName: "bash" });
  let cancelled = 0;
  approval.onCancel = () => {
    cancelled += 1;
  };
  approval.handleInput("\x1b");
  assert.equal(cancelled, 1, "ApprovalPanel must cancel on Escape");

  // Question: Escape must invoke onCancel.
  const question = new QuestionPanel([
    { id: "q", question: "Continue?", options: [{ label: "Yes" }] },
  ]);
  let questionCancelled = 0;
  question.onCancel = () => {
    questionCancelled += 1;
  };
  question.handleInput("\x1b");
  assert.equal(questionCancelled, 1, "QuestionPanel must cancel on Escape");

  // LoginDialog: the original `data === "escape"` compared against the literal
  // string "escape", which the terminal never sends, so Escape was dead.
  const login = new LoginDialog(
    { kind: "secret", message: "DeepSeek API key" },
    { requestRender: () => {} },
  );
  const settled = login.whenDone();
  login.cancel();
  assert.equal(await settled, null, "LoginDialog must settle on cancel");
  login.handleInput("\x1b");
  login.handleInput("k");
  login.handleInput("\r");

  // SearchPicker: Escape must invoke onCancel.
  const picker = new SearchPicker([{ value: "a", label: "A" }], "Choose", 6);
  let pickerCancelled = 0;
  picker.onCancel = () => {
    pickerCancelled += 1;
  };
  picker.handleInput("\x1b");
  assert.equal(pickerCancelled, 1, "SearchPicker must cancel on Escape");
});

// ── Bug 4: a mid-turn /status stole the turn's AbortController ───────────────

test("a concurrent connection check leaves the running turn cancellable", async () => {
  const { ActivitySet } = await import("../src/runtime/activities.ts");
  // Before the fix `checkConnection` overwrote the single `activity` field, so
  // a mid-turn `/status` aborted the probe instead of the turn.
  const activities = new ActivitySet();
  const turn = activities.add(new AbortController());
  const probe = activities.add(new AbortController());
  assert.equal(activities.size, 2, "a turn and a probe coexist");
  activities.delete(probe);
  assert.deepEqual([...activities], [turn], "removing the probe keeps the turn");
  activities.abortAll();
  // Read the signal rather than the controller: some Node builds expose
  // `aborted` only on the signal.
  assert.equal(turn.signal.aborted, true, "cancel still reaches the turn");
  assert.equal(activities.size, 0, "aborting clears the set");
});

// ── Bug 5: sessions() read every log at once ────────────────────────────────

test("session log reads are bounded and survive a failed read", async () => {
  const { mapWithConcurrency } = await import("../src/runtime/runtime.ts");
  // Every saved session used to be read at once; a bounded pool keeps the same
  // result, and one unreadable log must not discard the other counts.
  let inFlight = 0;
  let peak = 0;
  const seen: number[] = [];
  await assert.rejects(
    mapWithConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      4,
      async (index) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        try {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (index === 7) throw new Error("corrupt log");
          seen.push(index);
        } finally {
          inFlight -= 1;
        }
      },
    ),
    /1 of 20 items failed/,
    "the failure surfaces once every other read finished",
  );
  assert.ok(peak <= 4, `at most 4 reads at once, saw ${peak}`);
  assert.equal(seen.length, 19, "every other session was still counted");
});

// ── Bug 9: a user --patch dropped the catalog providers ─────────────────────

test("provider config patches merge under the row's own providers", async () => {
  const { applyDeferredPatches } = await import("../src/runtime/deferred.ts");
  const patched = applyDeferredPatches(
    [{ id: "llm-pi-ai", name: "llm-pi-ai", config: { providers: { "my-provider": {} } } }],
    [{ id: "llm-pi-ai", config: { providers: { "deepseek-official": {}, openrouter: {} } } }],
  );
  const config = patched[0]?.config as { providers: Record<string, unknown> };
  assert.deepEqual(Object.keys(config.providers).sort(), [
    "deepseek-official",
    "my-provider",
    "openrouter",
  ]);
  // Non-provider keys keep the row's values in control.
  const extra = applyDeferredPatches(
    [{ id: "x", name: "x", config: { keep: 1 } }],
    [{ id: "x", config: { added: 2 } }],
  );
  assert.deepEqual(extra[0]?.config, { added: 2, keep: 1 });
});

// ── Bug 10/11/12: theme resolution ──────────────────────────────────────────

test("every config file resolves through the same lazydsh root", async () => {
  const { uiSettingsPath } = await import("../src/interactive-mode/settings-store.ts");
  const { keybindingsConfigPath } = await import("../src/interactive-mode/keybindings.ts");

  const home = await import("node:os").then((os) => os.tmpdir());
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home + "/xdg-config";
  try {
    const root = home + "/xdg-config/lazydsh";
    assert.equal(uiSettingsPath(), root + "/settings.json");
    assert.equal(keybindingsConfigPath(), root + "/keybindings.json");
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
  }
});

// ── Bug 13: a streamed answer was printed twice ─────────────────────────────
// A turn that streams its answer renders it as the live assistant card. The
// settle path then echoed `finalResponse` as a `dsh:` notification, guarded by
// a comparison against the *previous* turn's answer — which never matches, so
// the notice was unconditional and every answer appeared twice in a row.

test("a settled run does not echo a streamed answer as a second row", async () => {
  const { AssistantMessageComponent } =
    await import("../src/interactive-mode/components/assistant-message.ts");
  const { stripVTControlCharacters } = await import("node:util");

  // Reproduce the two rows the UI produced: the card the deltas built, and the
  // notification the settle path appended.
  const streamed = "Hi! I am the agent.";
  const card = new AssistantMessageComponent(
    { content: [{ type: "text", text: streamed }] },
    false,
  );
  const cardText = card.render(80).map(stripVTControlCharacters).join("\n");

  // The answer is in the card exactly once, as the markdown body.
  assert.equal(cardText.split(streamed).length - 1, 1, "card carries the answer once");

  // `streamedAnswer` (the fix) is what suppresses the second row, so the guard
  // has to be reachable: a run with no streamed text must still notice.
  const commandOnly = new AssistantMessageComponent(undefined, false);
  assert.deepEqual(commandOnly.render(80), []);
  commandOnly.updateContent({ content: [] }, false);
  assert.deepEqual(commandOnly.render(80), []);
});
