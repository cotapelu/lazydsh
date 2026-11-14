import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { ToolLog } from "../src/tools.ts";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import { eventText } from "../src/runtime.ts";

function emit(log: ToolLog, type: string, data: unknown, sessionId = "root") {
  const output = eventText({
    method: "session.event",
    params: { sessionId, event: { type, data } as SessionEvent },
  });
  assert.ok(output && output.kind !== "assistant");
  return log.record(output);
}
const call = (id: string, path: string) => ({
  name: "read",
  callId: id,
  arguments: JSON.stringify({ path }),
});
const result = (id: string, text: string, isError = false) => ({
  message: { toolCallId: id, isError, content: [{ type: "text", text }] },
});

test("large read output updates one collapsed row without dumping arguments or contents", () => {
  const log = new ToolLog();
  const row = emit(log, "tool/call", call("a", "src/main.ts"));
  assert.ok(row);
  assert.equal(String(row.summary), "· read src/main.ts");
  const contents = "private file contents\n".repeat(10000);
  assert.equal(emit(log, "tool/result", result("a", contents)), undefined);
  assert.equal(String(row.summary), "✓ read src/main.ts");
  assert.ok(!row.summary.includes(contents));
  assert.equal(log.entries.size, 0);
  for (const width of [1, 20, 80]) {
    assert.equal(row.render(width).length, 1);
    assert.ok(visibleWidth(row.render(width)[0]) <= width);
  }
});

test("interleaved root and child calls stay paired; empty success and errors are visible", () => {
  const log = new ToolLog();
  const root = emit(log, "tool/call", call("a", "root.txt"));
  const child = emit(log, "tool/call", call("a", "child.txt"), "child");
  emit(log, "tool/result", result("a", ""));
  emit(log, "tool/result", result("a", "permission denied\nlong details", true), "child");
  assert.equal(root?.summary, "✓ read root.txt");
  assert.equal(child?.summary, "✗ read child.txt — permission denied");
  assert.equal(log.entries.size, 0);
});
