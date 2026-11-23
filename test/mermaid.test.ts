import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { createMermaidMarkdownTransformer } from "../src/interactive-mode/components/mermaid.ts";
import { theme } from "../src/interactive-mode/theme/theme.ts";

const block = "```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n";
const transform = (mode: "off" | "final" | "streaming", streaming: boolean) =>
  createMermaidMarkdownTransformer({ getMode: () => mode, theme })(block, {
    messageType: "assistant",
    isStreaming: streaming,
    availableWidth: 80,
  });

test("streaming mode renders mermaid live instead of showing raw markdown", () => {
  const live = transform("streaming", true);
  assert.doesNotMatch(live, /```mermaid/);
  // lovely-mermaid draws Unicode box art, so the fenced source is gone.
  assert.notEqual(live, block);
});

test("final and off modes keep the expected behaviour", () => {
  // `off` never renders; `final` renders only once streaming has ended.
  assert.equal(transform("off", true), block);
  assert.equal(transform("final", true), block);
  assert.doesNotMatch(transform("final", false), /```mermaid/);
});
