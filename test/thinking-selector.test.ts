import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { ThinkingSelectorComponent } from "../src/interactive-mode/components/thinking-selector.ts";

const plain = (component: ThinkingSelectorComponent, width = 70) =>
  component.render(width).map(stripVTControlCharacters).join("\n");

function build(
  overrides: Partial<{
    onSelect: (l: string) => void;
    onSelectAsDefault: (l: string) => void;
  }> = {},
) {
  const picked: string[] = [];
  const saved: string[] = [];
  const component = new ThinkingSelectorComponent({
    currentLevel: "medium",
    availableLevels: ["minimal", "low", "medium", "high", "xhigh"],
    defaultThinkingLevel: "low",
    onSelect: (level) => {
      picked.push(level);
      overrides.onSelect?.(level);
    },
    onCancel: () => {},
    onSelectAsDefault: (level) => {
      saved.push(level);
      overrides.onSelectAsDefault?.(level);
    },
  });
  return { component, picked, saved };
}

test("the picker lists levels, marks the current one and badges the default", () => {
  const { component } = build();
  const shown = plain(component);
  assert.match(shown, /Thinking Level/);
  assert.match(shown, /✓ medium/);
  assert.match(shown, /low .*default/);
  assert.match(shown, /high/);
});

test("enter selects the highlighted level and ctrl+s saves it as default", () => {
  const { component, picked, saved } = build();
  component.handleInput("\r"); // select current highlight ("medium")
  assert.deepEqual(picked, ["medium"]);
  component.handleInput("\x13"); // ctrl+s on the current highlight
  assert.deepEqual(saved, ["medium"]);
});

test("typing filters the list down to matching levels", () => {
  const { component } = build();
  const before = plain(component);
  assert.match(before, /minimal/);
  component.handleInput("x");
  component.handleInput("h");
  const after = plain(component);
  assert.match(after, /xhigh/);
  assert.doesNotMatch(after, /minimal/);
});
