import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_UI_SETTINGS,
  readUiSettings,
  uiSettingsPath,
  writeUiSettings,
} from "../src/interactive-mode/settings-store.ts";

test("preferences round-trip through a fresh read", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-ui-settings-"));
  writeUiSettings({ confirmExit: true, mermaidMode: "streaming" }, dir);
  assert.deepEqual(readUiSettings(dir), { confirmExit: true, mermaidMode: "streaming" });
});

test("missing or malformed files fall back to the defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-ui-settings-"));
  assert.deepEqual(readUiSettings(dir), DEFAULT_UI_SETTINGS);
  writeFileSync(uiSettingsPath(dir), "{ broken");
  assert.deepEqual(readUiSettings(dir), DEFAULT_UI_SETTINGS);
  writeFileSync(uiSettingsPath(dir), JSON.stringify({ confirmExit: "yes" }));
  assert.deepEqual(readUiSettings(dir), DEFAULT_UI_SETTINGS);
  writeFileSync(uiSettingsPath(dir), JSON.stringify({ mermaidMode: "loud" }));
  assert.deepEqual(readUiSettings(dir), DEFAULT_UI_SETTINGS);
});

test("a failed write stays silent and keeps the settings unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-ui-settings-"));
  const blocker = join(dir, "file");
  writeFileSync(blocker, "");
  assert.doesNotThrow(() =>
    writeUiSettings({ confirmExit: true, mermaidMode: "off" }, join(blocker, "nested")),
  );
  assert.deepEqual(readUiSettings(dir), DEFAULT_UI_SETTINGS);
});
