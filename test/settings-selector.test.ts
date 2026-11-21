import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { SettingsSelectorComponent } from "../src/interactive-mode/settings-selector.ts";

const renders = new Set<() => void>();
const tui = { requestRender: () => renders.forEach((fn) => fn()) };
const plain = (component: SettingsSelectorComponent, width = 90) =>
  component.render(width).map(stripVTControlCharacters).join("\n");

/** Move the selection to the Appearance category. */
function openAppearance(component: SettingsSelectorComponent) {
  component.handleInput("\t");
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

test("confirm-exit is a real toggle that reports every flip", () => {
  const flips: Array<[string, boolean]> = [];
  const component = new SettingsSelectorComponent(tui, {
    confirmExit: false,
    onToggle: (key, value) => flips.push([key, value]),
  });
  assert.match(plain(component), /Confirm on exit/);
  component.handleInput("\x1b[B"); // onto the confirm-exit row
  component.handleInput("\r");
  component.handleInput("\r");
  assert.deepEqual(flips, [
    ["confirmExit", true],
    ["confirmExit", false],
  ]);
  assert.match(plain(component), /Confirm on exit/);
});

test("settings the TUI cannot honour are honest info rows, not fake toggles", () => {
  const flips: string[] = [];
  const component = new SettingsSelectorComponent(tui, {
    onToggle: (key) => flips.push(key),
  });
  // Auto-compaction points at the DSH policy that owns it (General tab).
  assert.match(plain(component), /not a TUI setting/);
  openAppearance(component);
  const shown = plain(component);
  // No ON/OFF affordance on these rows.
  assert.doesNotMatch(shown, /Transparent background/);
  assert.match(shown, /Set by the active theme/);
  assert.match(shown, /Not rendered by the Markdown component/);
  // Pressing enter on them flips nothing.
  component.handleInput("\x1b[B");
  const before = plain(component);
  component.handleInput("\r");
  assert.equal(plain(component), before);
  assert.deepEqual(flips, []);
});

test("the about category shows the real package version", () => {
  const component = new SettingsSelectorComponent(tui);
  for (let i = 0; i < 4; i += 1) component.handleInput("\t"); // About
  assert.match(plain(component), /\d+\.\d+\.\d+/);
});
