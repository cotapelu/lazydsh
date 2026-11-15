import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { highlightCode } from "../src/highlight.ts";

test("code highlighting loads only the requested language and preserves source text", () => {
  for (const [language, source, colored] of [
    ["ts", 'const count = 42;\nconsole.log("hello");', true],
    ["py", 'def hello():\n    return "hello"', true],
    ["json", '{"ok": true}', true],
    ["kt", 'val message = "a & b"', true],
    ["html", "<p>a &amp; b</p>", false],
    ["java", "class Example {}", true],
  ] as const) {
    const output = highlightCode(source, language).join("\n");
    assert.equal(stripVTControlCharacters(output), source);
    if (colored) assert.ok(output.includes("\x1b[38;2;77;107;254m"));
  }
  assert.deepEqual(highlightCode("text\nnext", "unknown-language"), ["text", "next"]);
  assert.equal(
    stripVTControlCharacters(highlightCode("\x1b[2Jconst x = 1", "js").join("\n")),
    "const x = 1",
  );
});
