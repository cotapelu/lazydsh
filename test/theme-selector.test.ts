import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { ThemeSelectorComponent } from "../src/interactive-mode/components/theme-selector.ts";

const plain = (component: ThemeSelectorComponent, width = 70) =>
  component.render(width).map(stripVTControlCharacters).join("\n");

test("the selector lists themes and offers the follow-terminal row", () => {
  const previews: string[] = [];
  const component = new ThemeSelectorComponent(
    "default",
    () => {},
    () => {},
    (value) => previews.push(value),
    { light: "light", dark: "dark", active: false },
  );
  const shown = plain(component);
  assert.match(shown, /auto \(follow terminal\)/);
  assert.match(shown, /light → light · dark → dark/);
  assert.match(shown, /default/);
  // Walking up to the auto row previews the pair setting, which the
  // controller resolves to the theme matching the terminal's appearance.
  const list = component.getSelectList();
  for (let i = 0; i < 6 && previews.at(-1) !== "light/dark"; i += 1) list.handleInput("\x1b[A");
  assert.equal(previews.at(-1), "light/dark");
});

test("selecting the auto row yields the persisted pair setting", () => {
  const selected: string[] = [];
  const component = new ThemeSelectorComponent(
    "default",
    (value) => selected.push(value),
    () => {},
    () => {},
    { light: "light", dark: "dark", active: true },
  );
  // The active auto row is preselected.
  assert.match(plain(component), /\(active\)/);
  component.getSelectList().handleInput("\r");
  assert.deepEqual(selected, ["light/dark"]);
});

test("without the auto option the selector behaves as a plain theme list", () => {
  const selected: string[] = [];
  const component = new ThemeSelectorComponent(
    "default",
    (value) => selected.push(value),
    () => {},
    () => {},
  );
  assert.doesNotMatch(plain(component), /follow terminal/);
  component.getSelectList().handleInput("\r");
  assert.deepEqual(selected, ["default"]);
});
