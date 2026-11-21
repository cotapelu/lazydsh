import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { SettingsSelectorComponent } from "../src/interactive-mode/settings-selector.ts";
import { packageVersion } from "../src/utils/version.ts";

const renders = new Set<() => void>();
const tui = { requestRender: () => renders.forEach((fn) => fn()) };
const plain = (component: SettingsSelectorComponent, width = 90) =>
  component.render(width).map(stripVTControlCharacters).join("\n");

/** Move the selection to the Appearance category's theme row. */
function openAppearance(component: SettingsSelectorComponent) {
  for (let i = 0; i < 6; i += 1) component.handleInput("\t");
}

test("the theme row hands activation to the launcher instead of cycling placeholders", () => {
  const component = new SettingsSelectorComponent(tui, { currentTheme: "dark" });
  const activated: string[] = [];
  component.onActivate = (key) => {
    activated.push(key);
    return key === "theme";
  };
  openAppearance(component);
  const shown = plain(component);
  // The launcher-injected current theme replaces the compiled-in default.
  assert.match(shown, /dark/);
  assert.doesNotMatch(shown, /lazydsh \(default\)/);
  component.handleInput("\r");
  assert.deepEqual(activated, ["theme"]);
  // A launcher-handled row must not flip its placeholder value.
  assert.match(plain(component), /dark/);
});

test("rows the launcher does not own keep the built-in behaviour", () => {
  const component = new SettingsSelectorComponent(tui, { currentTheme: "lazydsh" });
  let handled = 0;
  component.onActivate = (key) => {
    if (key === "transparentBackground") handled += 1;
  };
  openAppearance(component);
  component.handleInput("\x1b[B"); // theme row -> transparent background row
  const before = plain(component);
  component.handleInput("\r");
  assert.equal(handled, 1);
  // The toggle still flips itself: OFF became ON.
  assert.match(plain(component), /ON/);
  assert.notEqual(before, plain(component));
});

test("the about category shows the real package version", () => {
  const component = new SettingsSelectorComponent(tui);
  for (let i = 0; i < 4; i += 1) component.handleInput("\t"); // About
  assert.match(plain(component), new RegExp(packageVersion().replace(/\./g, "\\.")));
});
