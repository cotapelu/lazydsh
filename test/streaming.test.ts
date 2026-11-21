import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import { stripVTControlCharacters } from "node:util";
import { StreamScanner, StreamingMarkdown } from "../src/interactive-mode/streaming.ts";
import { highlightCode } from "../src/interactive-mode/highlight.ts";

const identity = (text: string) => text;
const theme: MarkdownTheme = {
  highlightCode: (code) => code.split("\n"),
  heading: identity,
  link: identity,
  linkUrl: identity,
  code: identity,
  codeBlock: identity,
  codeBlockBorder: identity,
  quote: identity,
  quoteBorder: identity,
  hr: identity,
  listBullet: identity,
  bold: identity,
  italic: identity,
  strikethrough: identity,
  underline: identity,
};

const rendered = (text: string, width = 60) =>
  new Markdown(text, 2, 1, theme)
    .render(width)
    .map((line) => stripVTControlCharacters(line).trimEnd());

test("stream scanner only ends blocks outside fences and display math", () => {
  const fenced = "Intro\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nafter\n";
  assert.equal(new StreamScanner().update(fenced), fenced.indexOf("after"));

  const tildes = "~~~\na\n\nb\n~~~\n\nafter";
  assert.equal(new StreamScanner().update(tildes), tildes.indexOf("after"));

  const dollars = "$$\na\n\nb\n$$\n\nafter";
  assert.equal(new StreamScanner().update(dollars), dollars.indexOf("after"));

  const brackets = "\\[\na\n\nb\n\\]\n\nafter";
  assert.equal(new StreamScanner().update(brackets), brackets.indexOf("after"));
});

test("stream scanner keeps its position as text arrives in pieces", () => {
  const text = "Intro\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nafter\n";
  const scanner = new StreamScanner();
  let seen = "";
  let boundary = 0;
  for (const piece of text.match(/[\s\S]{1,3}/g) ?? []) {
    seen += piece;
    boundary = scanner.update(seen);
  }
  assert.equal(boundary, text.indexOf("after"));
});

test("streamed markdown matches a full render once the answer completes", () => {
  const text =
    "Intro paragraph.\n\n- one\n- two\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nDone.\n";
  const live = new StreamingMarkdown(theme);
  for (const piece of text.match(/[\s\S]{1,5}/g) ?? []) live.append(0, piece);

  assert.deepEqual(
    live.render(60).map((line) => stripVTControlCharacters(line).trimEnd()),
    rendered(text),
  );
  live.setFinal(text);
  assert.deepEqual(
    live.render(60).map((line) => stripVTControlCharacters(line).trimEnd()),
    rendered(text),
  );
});

test("streaming highlights a code fence before it closes", () => {
  const colored: MarkdownTheme = { ...theme, highlightCode };
  const live = new StreamingMarkdown(colored);
  live.append(0, "```ts\nconst a = 1;\n");
  const lines = live.render(80);
  assert.ok(
    lines.some((line) => line.includes("\x1b[")),
    "the open fence should already be highlighted",
  );
});

test("streaming calls the highlighter while the fence is still open", () => {
  let highlighted = 0;
  const counting: MarkdownTheme = {
    ...theme,
    highlightCode: (code) => {
      highlighted++;
      return code.split("\n");
    },
  };
  const live = new StreamingMarkdown(counting);
  live.append(0, "```ts\nconst a = 1;\n");
  live.render(80);
  assert.ok(highlighted > 0);
});

test("finishing keeps highlighting for a code block at the end", () => {
  let highlighted = 0;
  const counting: MarkdownTheme = {
    ...theme,
    highlightCode: (code) => {
      highlighted++;
      return code.split("\n");
    },
  };
  const live = new StreamingMarkdown(counting);
  const text = "```ts\nconst a = 1;\n```\n";
  live.append(0, text);
  live.render(80);
  const streamed = highlighted;

  live.setFinal(text);
  live.render(80);
  assert.ok(highlighted > streamed);
});

test("content blocks stay in index order and repeated renders are cached", () => {
  const live = new StreamingMarkdown(theme);
  live.append(1, "second");
  live.append(0, "first");
  const output = live
    .render(80)
    .map((line) => stripVTControlCharacters(line).trimEnd())
    .join("\n");
  assert.match(output, /first\s+second/);
  assert.equal(live.render(80), live.render(80));
});
