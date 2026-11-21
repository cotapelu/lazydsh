import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { highlightCode } from "../src/interactive-mode/highlight.ts";
import {
  IncrementalHighlighter,
  type HighlightFn,
} from "../src/interactive-mode/stream-highlight.ts";

const TYPESCRIPT = [
  "/**",
  " * A block comment that spans",
  " * several lines.",
  " */",
  "export class Counter {",
  '  private readonly label = "counter";',
  "  private total = 0;",
  "",
  "  increment(by = 1): number {",
  "    this.total += by;",
  "    return this.total;",
  "  }",
  "}",
  "",
  "const banner = `",
  "  total: ${counter.increment(2)}",
  "`;",
].join("\n");

const PYTHON = [
  '"""',
  "A docstring that",
  "spans lines.",
  '"""',
  "def total(values):",
  '    return sum(values)  # "quoted" comment',
].join("\n");

const GO = [
  "func main() {",
  "\traw := `line one",
  "line two`",
  '\tfmt.Println(raw, "done")',
  "}",
].join("\n");

test("incremental highlighting matches one-shot output for every prefix", () => {
  for (const [language, source] of [
    ["ts", TYPESCRIPT],
    ["py", PYTHON],
    ["go", GO],
  ] as const) {
    const incremental = new IncrementalHighlighter(highlightCode);
    for (let end = 0; end <= source.length; end += 1) {
      const prefix = source.slice(0, end);
      assert.deepEqual(
        incremental.highlight(prefix, language),
        highlightCode(prefix, language),
        `${language} prefix of ${end} chars`,
      );
    }
  }
});

test("an open block comment is highlighted while it is still streaming", () => {
  const incremental = new IncrementalHighlighter(highlightCode);
  const lines = incremental.highlight("/* still open\n * second line", "ts");
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(line.includes("\x1b["), "expected ANSI styling");
});

test("a multi-line string keeps its highlighting across calls", () => {
  const incremental = new IncrementalHighlighter(highlightCode);
  incremental.highlight("const banner = `\n  total: 1", "ts");
  const lines = incremental.highlight("const banner = `\n  total: 1\n  more`;\n", "ts");
  const expected = highlightCode("const banner = `\n  total: 1\n  more`;\n", "ts");
  assert.deepEqual(lines, expected);
});

test("highlighting cost stays proportional to the appended text", () => {
  const source = Array.from(
    { length: 400 },
    (_, index) => `const value${index} = client.get("key-${index}", { retry: ${index % 5} });`,
  );
  let characters = 0;
  const counting: HighlightFn = (code, language) => {
    characters += code.length;
    return highlightCode(code, language);
  };

  const incremental = new IncrementalHighlighter(counting);
  let text = "";
  for (const line of source) {
    text += `${line}\n`;
    incremental.highlight(text, "ts");
  }

  const full = source.join("\n");
  assert.ok(
    characters < full.length * 4,
    `re-highlighted ${characters} chars for a ${full.length} char block`,
  );
  assert.equal(incremental.unstableOffset, text.length);
  assert.deepEqual(incremental.highlight(text, "ts"), highlightCode(text, "ts"));
});

test("a rewritten block resets the carried state", () => {
  const incremental = new IncrementalHighlighter(highlightCode);
  incremental.highlight("const a = 1;\nconst b = 2;\n", "ts");
  assert.deepEqual(
    incremental.highlight("let c = 3;\n", "ts"),
    highlightCode("let c = 3;\n", "ts"),
  );
  assert.deepEqual(
    incremental.highlight("def f():\n    return 1\n", "py"),
    highlightCode("def f():\n    return 1\n", "py"),
  );
});

test("an untagged long block still forwards every line while refreshing lazily", () => {
  const incremental = new IncrementalHighlighter(highlightCode);
  let text = "";
  for (let index = 0; index < 200; index += 1) {
    text += `const value${index} = ${index};\n`;
    const output = incremental.highlight(text);
    assert.equal(output.length, text.split("\n").length);
  }
});

test("unknown languages fall back to whole-snippet highlighting", () => {
  const incremental = new IncrementalHighlighter(highlightCode);
  const code = "const a = 1;\nconst b = 2;";
  assert.deepEqual(
    incremental.highlight(code, "not-a-language"),
    highlightCode(code, "not-a-language"),
  );
  assert.deepEqual(incremental.highlight(code), highlightCode(code));
});
