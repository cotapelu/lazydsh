import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { getAppKeybindings, KEYBINDINGS } from "../src/keybindings.ts";

test("the app keybindings manager resolves app-level actions", () => {
  // Regression: pi-tui's own getKeybindings() only knows tui.* actions, so app
  // actions matched false and every app shortcut (Ctrl+C, Ctrl+T, …) was dead.
  const kb = getAppKeybindings();
  assert.equal(kb.matches("\x03", "app.clear"), true);
  assert.equal(kb.matches("\x14", "app.thinking.toggle"), true);
  assert.equal(kb.matches("\x1b[Z", "app.thinking.cycle"), true);
  assert.equal(kb.matches("\x18", "app.message.copy"), true);
  assert.equal(kb.matches("\x07", "app.editor.external"), true);
  // tui.* actions resolve through the same manager.
  assert.equal(kb.matches("\r", "tui.select.confirm"), true);
  // Every declared binding stays resolvable by its default keys.
  for (const [name, binding] of Object.entries(KEYBINDINGS)) {
    const keys = binding.defaultKeys;
    const samples = Array.isArray(keys) ? keys : [keys];
    for (const sample of samples) {
      if (typeof sample !== "string" || sample.length === 0) continue;
      assert.doesNotThrow(() => kb.matches(sample, name as never), name);
    }
  }
});
