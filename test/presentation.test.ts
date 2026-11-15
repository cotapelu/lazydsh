import { ToolRow } from "../src/tools.ts";
import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { ProcessTerminal, TuiMainScreen, Text, visibleWidth } from "@earendil-works/pi-tui";
import { stripVTControlCharacters } from "node:util";
import {
  StartupBanner,
  StatusPanel,
  PromptEditor,
  SentMessage,
  Notification,
  SecretInput,
  Transcript,
  ThinkingView,
  editorBorder,
} from "../src/presentation.ts";

const identity = (text: string) => text;
const theme = {
  borderColor: editorBorder,
  selectList: {
    selectedPrefix: identity,
    selectedText: identity,
    description: identity,
    scrollInfo: identity,
    noMatch: identity,
  },
};

test("startup whale stays within narrow and wide terminal widths using DeepSeek blue", () => {
  const banner = new StartupBanner();
  for (const width of [1, 20, 48, 63, 64, 80, 120]) {
    const lines = banner.render(width);
    assert.ok(
      lines.every((line) => visibleWidth(line) <= width),
      `overflow at ${width}`,
    );
    assert.ok(lines.join("\n").includes("\x1b[38;2;77;107;254m"));
  }
  assert.match(banner.render(80).join("\n"), /lazydsh/);
});

test("shell prompt removes only editor borders, preserving multiline input and cursor", () => {
  const editor = new PromptEditor(new TuiMainScreen(new ProcessTerminal()), theme);
  editor.focused = true;
  editor.setText("日本語\nsecond line");
  for (const width of [1, 2, 6, 20, 80]) {
    const lines = editor.render(width);
    assert.ok(
      lines.every((line) => visibleWidth(line) <= width),
      `overflow at ${width}`,
    );
    assert.ok(lines.every((line) => !line.includes("\0border:")));
  }
  const text = editor.render(80).map(stripVTControlCharacters).join("\n");
  assert.match(text, /┃ 日本語/);
  assert.match(text, /┃ second line/);
  assert.doesNotMatch(text, /─/);
  assert.equal(editor.getText(), "日本語\nsecond line");
});

test("status uses gray labels and numeric cache hits and fits narrow terminals", () => {
  const panel = new StatusPanel({
    context: { projectedTokens: 500, contextWindow: 1000 },
    latest: { inputTokens: 50, outputTokens: 20, cacheReadTokens: 50 },
  });
  for (const width of [20, 48, 80])
    assert.ok(panel.render(width).every((line) => visibleWidth(line) <= width));
  const output = panel.render(80).join("\n");
  assert.ok(output.includes("\x1b[38;2;160;166;172mContext window:"));
  assert.doesNotMatch(output, /[█░]/);
  assert.ok(!output.includes("\x1b[38;2;77;107;254m"));
  const lines = panel.render(80).map(stripVTControlCharacters);
  assert.match(lines.join("\n"), /50% left \(500 used \/ 1K\)/);
  const context = lines.find((line) => line.includes("Context window:"))!;
  const cache = lines.find((line) => line.includes("Cache hit:"))!;
  assert.equal(context.indexOf("50%"), cache.indexOf("50.0%"));
  panel.updateStats({ limits: { plan: "plus", windows: [] } });
  const updated = panel.render(80).map(stripVTControlCharacters).join("\n");
  assert.match(updated, /Plan: +plus/);
  assert.doesNotMatch(updated, /Context window:|Cache hit:/);
});

test("sent messages keep the prompt rail on wrapped and multiline text", () => {
  const message = new SentMessage(
    "hello\n日本語 and a longer message that wraps across several rows",
  );
  for (const width of [1, 6, 20, 80])
    assert.ok(message.render(width).every((line) => visibleWidth(line) <= width));
  const lines = message
    .render(20)
    .map(stripVTControlCharacters)
    .filter((line) => line.trim());
  assert.equal(lines[0].trimEnd(), "  ┃ hello");
  assert.ok(lines.every((line) => line.startsWith("  ┃ ")));
});

test("submitted commands use the accent color without a prompt rail", () => {
  const message = new SentMessage("/status");
  const output = message.render(80).join("\n");
  assert.ok(output.includes("\x1b[38;2;77;107;254m/status"));
  assert.deepEqual(
    message.render(80).map((line) => stripVTControlCharacters(line).trimEnd()),
    ["", "  /status", ""],
  );
  const long = new SentMessage("/resume session-with-a-long-id");
  for (const width of [1, 6, 20, 80]) {
    const lines = long.render(width);
    assert.ok(lines.every((line) => visibleWidth(line) <= width));
    assert.doesNotMatch(lines.join("\n"), /┃/);
  }
});

test("Thinking shows elapsed time and usage, then only frozen metrics", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  const tui = new TuiMainScreen(new ProcessTerminal());
  tui.requestRender = () => {};
  const view = new ThinkingView(tui);
  try {
    now.mockReturnValue(2400);
    assert.match(view.render(80).map(stripVTControlCharacters).join("\n"), /Thinking \(1s\)/);
    assert.doesNotMatch(view.render(80).map(stripVTControlCharacters).join("\n"), /↑|↓/);
    view.setTokens(2, 13);
    assert.match(
      view.render(80).map(stripVTControlCharacters).join("\n"),
      /Thinking \(1s\) \(↑2 ↓13\)/,
    );
    view.setTokens(1200, 3200000);
    assert.match(
      view.render(80).map(stripVTControlCharacters).join("\n"),
      /Thinking \(1s\) \(↑1.2K ↓3.2M\)/,
    );
    now.mockReturnValue(4000);
    view.finish();
    now.mockReturnValue(9000);
    view.finish();
    assert.deepEqual(
      view.render(80).map((line) => stripVTControlCharacters(line).trimEnd()),
      ["  3s (↑1.2K ↓3.2M)"],
    );
  } finally {
    view.finish();
    now.mockRestore();
  }
});

test("tool and Thinking groups keep one empty row before the composer and chat", () => {
  const transcript = new Transcript();
  assert.deepEqual(transcript.render(80), []);
  transcript.addChild(new ToolRow("✓ read src/main.ts"));
  let lines = transcript.render(80).map(stripVTControlCharacters);
  assert.match(lines.at(-2)!, /read src\/main.ts/);
  assert.equal(lines.at(-1), "");
  transcript.addChild(new Text("assistant answer", 2, 1));
  lines = transcript.render(80).map(stripVTControlCharacters);
  const answer = lines.findIndex((line) => line.includes("assistant answer"));
  assert.equal(lines[answer - 1].trim(), "");
  assert.match(lines[answer - 2], /read src\/main.ts/);
  assert.equal(lines.at(-1), "");
  assert.ok(lines.at(-2)?.trim());
  const tui = new TuiMainScreen(new ProcessTerminal());
  tui.requestRender = () => {};
  const view = new ThinkingView(tui);
  try {
    const activity = new Transcript();
    activity.addChild(new SentMessage("hello"));
    activity.addChild(view);
    view.finish();
    const rendered = activity.render(80).map(stripVTControlCharacters);
    const thought = rendered.findIndex((line) => /\d+s/.test(line));
    assert.equal(rendered[thought - 1].trim(), "");
    assert.match(rendered[thought - 2], /┃ hello/);
    assert.equal(rendered.at(-1), "");
  } finally {
    view.finish();
  }
});

test("notifications use icons and labels; adjacent message boundaries have one blank row", () => {
  const transcript = new Transcript();
  transcript.addChild(new SentMessage("hello"));
  transcript.addChild(new Notification("Error", "Could not connect"));
  transcript.addChild(new Notification("Resumed", "session 123"));
  transcript.addChild(new Text("First paragraph\n\nSecond paragraph", 2, 1));
  const lines = transcript.render(80).map((line) => stripVTControlCharacters(line).trimEnd());
  assert.match(lines.join("\n"), /✗ error: Could not connect/);
  assert.match(lines.join("\n"), /✓ resumed: session 123/);
  const message = lines.findIndex((line) => line.includes("┃ hello"));
  const error = lines.findIndex((line) => line.includes("✗ error:"));
  assert.equal(error - message, 2);
  const resumed = lines.findIndex((line) => line.includes("✓ resumed:"));
  assert.equal(resumed - error, 2);
  assert.match(lines.join("\n"), /First paragraph\n\s*\n\s*Second paragraph/);
});

test("authentication input never renders its secret", () => {
  const input = new SecretInput();
  input.focused = true;
  input.handleInput("private-api-key");
  for (const width of [20, 80]) {
    const output = input.render(width).join("\n");
    assert.ok(!output.includes("private-api-key"));
    assert.ok(output.includes("•"));
  }
  assert.equal(input.getValue(), "private-api-key");
});

test("active Thinking remains below new tools, answers and notifications", () => {
  const tui = new TuiMainScreen(new ProcessTerminal());
  tui.requestRender = () => {};
  const transcript = new Transcript();
  const thinking = new ThinkingView(tui);
  try {
    transcript.addChild(thinking);
    transcript.addChild(new ToolRow("✓ read file"));
    transcript.addChild(new Text("answer", 2, 1));
    transcript.addChild(new Notification("Model", "provider / model"));
    const lines = transcript.render(80).map(stripVTControlCharacters);
    assert.match(lines.at(-2)!, /Thinking/);
    assert.equal(lines.at(-1), "");
    assert.deepEqual(
      transcript.children.slice(0, 3).map((item) => item.constructor.name),
      ["ToolRow", "Text", "Notification"],
    );
    thinking.finish();
    transcript.addChild(new SentMessage("next message"));
    assert.equal(transcript.children.at(-2), thinking);
    assert.ok(transcript.children.at(-1) instanceof SentMessage);
  } finally {
    thinking.finish();
  }
});

test("tools and Thinking have exactly one blank row; unknown tokens stay hidden after completion", () => {
  const tui = new TuiMainScreen(new ProcessTerminal());
  tui.requestRender = () => {};
  const transcript = new Transcript();
  const thinking = new ThinkingView(tui);
  transcript.addChild(new ToolRow("✓ read file"));
  transcript.addChild(thinking);
  try {
    let lines = transcript.render(80).map((line) => stripVTControlCharacters(line).trimEnd());
    const index = lines.findIndex((line) => line.includes("Thinking"));
    assert.equal(lines[index - 1], "");
    assert.match(lines[index - 2], /read file/);
    thinking.finish();
    lines = transcript.render(80).map((line) => stripVTControlCharacters(line).trimEnd());
    assert.match(lines.at(-2)!, /^  \d+s$/);
    assert.equal(lines.at(-3), "");
    assert.doesNotMatch(lines.join("\n"), /↑|↓/);
  } finally {
    thinking.finish();
  }
});

test("mentions and pasted paths are highlighted without changing text or cursor markers", () => {
  const text = 'Read @src/main.ts @"folder with spaces/file.ts" and ./notes.md user@example.com';
  const sent = new SentMessage(text);
  const output = sent.render(120).join("\n");
  assert.ok(output.includes("\x1b[38;2;77;107;254m@src/main.ts"));
  assert.ok(output.includes('\x1b[38;2;77;107;254m@"folder with spaces/file.ts"'));
  assert.ok(output.includes("\x1b[38;2;77;107;254m./notes.md"));
  assert.ok(!output.includes("\x1b[38;2;77;107;254muser@example.com"));
  assert.ok(stripVTControlCharacters(output).includes(text));

  const editor = new PromptEditor(new TuiMainScreen(new ProcessTerminal()), theme);
  editor.focused = true;
  editor.setText('@src/main.ts "/tmp/folder with spaces/file.ts" [paste #1 +20 lines]');
  const original = editor.getText();
  for (let i = 0; i < original.length - 5; i++) editor.handleInput("\x1b[D");
  const cursor = editor.getCursor();
  const rendered = editor.render(120).join("\n");
  assert.ok(rendered.includes("\x1b[38;2;77;107;254m@src/"));
  assert.ok(rendered.includes('\x1b[38;2;77;107;254m"/tmp/folder with spaces/file.ts"'));
  assert.ok(rendered.includes("\x1b[38;2;77;107;254m[paste #1 +20 lines]"));
  assert.ok(rendered.includes("\x1b_pi:c\x07"));
  assert.equal(editor.getText(), original);
  assert.deepEqual(editor.getCursor(), cursor);
  assert.ok(editor.render(30).every((line) => visibleWidth(line) <= 30));
});

test("finished rows reuse their rendered lines instead of re-truncating every frame", () => {
  const message = new SentMessage("hello @src/main.ts");
  assert.equal(message.render(80), message.render(80));
  assert.notEqual(message.render(79), message.render(80));
  message.invalidate();
  assert.equal(message.render(80), message.render(80));

  const row = new ToolRow("✓ read src/main.ts");
  assert.equal(row.render(80), row.render(80));
  row.setSummary("✗ read src/main.ts — denied");
  assert.match(row.render(80).join(""), /denied/);
});

test("the transcript never mutates a child's cached line array", () => {
  const cached = ["", "hello ", ""];
  const child = {
    invalidate() {},
    render: () => cached,
  };
  const transcript = new Transcript();
  transcript.addChild(new SentMessage("first"));
  transcript.addChild(child);
  const first = transcript.render(80);
  const second = transcript.render(80);
  assert.deepEqual(cached, ["", "hello ", ""]);
  assert.deepEqual(first, second);
  assert.equal(first.filter((line) => line.includes("hello")).length, 1);
});
