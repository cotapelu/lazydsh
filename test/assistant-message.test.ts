import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { AssistantMessageComponent } from "../src/interactive-mode/components/assistant-message.ts";

const plain = (component: AssistantMessageComponent, width = 80) =>
  component.render(width).map(stripVTControlCharacters).join("\n");

test("assistant messages fold reasoning in, hidden until Ctrl+T expands", () => {
  const component = new AssistantMessageComponent(
    {
      content: [
        { type: "thinking", thinking: "private reasoning" },
        { type: "text", text: "final answer" },
      ],
    },
    true,
    undefined,
    "Thinking…",
  );
  const hidden = plain(component);
  // Hidden reasoning shows as one quiet label above the answer.
  assert.match(hidden, /Thinking/);
  assert.doesNotMatch(hidden, /private reasoning/);
  assert.match(hidden, /final answer/);
  // Ctrl+T (setHideThinkingBlock) reveals the reasoning in place.
  component.setHideThinkingBlock(false);
  const shown = plain(component);
  assert.match(shown, /private reasoning/);
  assert.match(shown, /final answer/);
  component.setHideThinkingBlock(true);
  assert.doesNotMatch(plain(component), /private reasoning/);
});

test("streaming updates keep one answer block and settle with the final text", () => {
  const component = new AssistantMessageComponent(undefined, true, undefined, "Thinking…");
  assert.deepEqual(component.render(80), []);
  component.updateContent({ content: [{ type: "text", text: "par" }] }, true);
  assert.match(plain(component), /par/);
  component.updateContent({ content: [{ type: "text", text: "partial answer" }] }, true);
  assert.doesNotMatch(plain(component), /^par$/m);
  component.updateContent({ content: [{ type: "text", text: "partial answer" }] }, false);
  assert.match(plain(component), /partial answer/);
});
