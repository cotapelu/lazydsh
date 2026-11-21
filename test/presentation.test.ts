import { AssistantMessageComponent } from "../src/interactive-mode/components/assistant-message.ts";
import { ToolRow } from "../src/interactive-mode/tools.ts";
import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ProcessTerminal, TuiMainScreen, visibleWidth } from "@earendil-works/pi-tui";
import { stripVTControlCharacters } from "node:util";
import {
  StartupBanner,
  StatusPanel,
  PromptEditor,
  SentMessage,
  QueuedMessage,
  QueueView,
  Notification,
  Transcript,
  editorBorder,
} from "../src/interactive-mode/presentation.ts";

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

test("queued messages use a gray prompt rail and gray text", () => {
  const message = new QueuedMessage("follow up on @src/main.ts");
  for (const width of [1, 6, 20, 80])
    assert.ok(message.render(width).every((line) => visibleWidth(line) <= width));
  const output = message.render(80).join("\n");
  assert.ok(output.includes("\x1b[38;2;160;166;172m┃"));
  assert.ok(output.includes("\x1b[38;2;160;166;172mfollow up on @src/main.ts"));
  assert.ok(!output.includes("\x1b[38;2;77;107;254m"));
  const lines = message
    .render(80)
    .map(stripVTControlCharacters)
    .filter((line) => line.trim());
  assert.equal(lines[0].trimEnd(), "  ┃ follow up on @src/main.ts");
});

test("queued prompts stack below the transcript with one blank row between", () => {
  const queue = new QueueView();
  assert.deepEqual(queue.render(80), []);
  queue.addChild(new QueuedMessage("first"));
  queue.addChild(new QueuedMessage("second"));
  const lines = queue.render(80).map((line) => stripVTControlCharacters(line).trimEnd());
  assert.deepEqual(lines, ["  ┃ first", "", "  ┃ second", ""]);
  queue.removeChild(queue.children[0]!);
  assert.deepEqual(
    queue.render(80).map((line) => stripVTControlCharacters(line).trimEnd()),
    ["  ┃ second", ""],
  );
});

test("the transcript keeps rows in order with one blank between them", () => {
  const transcript = new Transcript();
  transcript.addChild(new SentMessage("hello"));
  transcript.addChild(
    new AssistantMessageComponent({ content: [{ type: "text", text: "answer" }] }),
  );
  transcript.addChild(new Notification("Model", "provider / model"));
  const lines = transcript.render(80).map(stripVTControlCharacters);
  const answer = lines.findIndex((line) => line.includes("answer"));
  assert.equal(lines[answer - 1].trim(), "");
  assert.match(lines[answer - 2], /hello/);
  assert.equal(lines.at(-1), "");
  assert.deepEqual(
    transcript.children.map((item) => item.constructor.name),
    ["SentMessage", "AssistantMessageComponent", "Notification"],
  );
});

test("a finished assistant message keeps its reasoning label hidden by default", () => {
  const message = new AssistantMessageComponent(
    {
      content: [
        { type: "thinking", thinking: "private reasoning" },
        { type: "text", text: "final answer" },
      ],
    },
    true,
  );
  const lines = message.render(80).map(stripVTControlCharacters);
  assert.ok(lines.join("\n").includes("Thinking"));
  assert.ok(lines.join("\n").includes("final answer"));
  assert.doesNotMatch(lines.join("\n"), /private reasoning|\(|↑|↓/);
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
