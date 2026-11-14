import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { highlightCode } from "../src/highlight.ts";

test("code highlighting supports language aliases, preserves multiline source and uses blue", () => {
  for (const [language, source] of [
    ["ts", 'const count = 42;\nconsole.log("hello");'],
    ["py", 'def hello():\n    return "hello"'],
    ["json", '{"ok": true}'],
  ]) {
    const output = highlightCode(source, language).join("\n");
    assert.equal(stripVTControlCharacters(output), source);
    assert.ok(output.includes("\x1b[38;2;77;107;254m"));
  }
  assert.deepEqual(highlightCode("text\nnext", "unknown-language"), ["text", "next"]);
  assert.equal(
    stripVTControlCharacters(highlightCode("\x1b[2Jconst x = 1", "js").join("\n")),
    "const x = 1",
  );
});
