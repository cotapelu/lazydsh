import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readThemeSetting,
  themeSettingsPath,
  writeThemeSetting,
} from "../src/interactive-mode/theme/theme-settings.ts";

test("a written setting round-trips through a fresh read", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  writeThemeSetting("dark", dir);
  assert.equal(readThemeSetting(dir), "dark");
  assert.equal(
    (JSON.parse(readFileSync(themeSettingsPath(dir), "utf-8")) as { theme: string }).theme,
    "dark",
  );
});

test("the auto pair persists verbatim for the controller to parse", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  writeThemeSetting("light/dark", dir);
  assert.equal(readThemeSetting(dir), "light/dark");
});

test("missing, malformed, or empty documents fall back to undefined", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  assert.equal(readThemeSetting(dir), undefined); // no file yet
  mkdirSync(dir, { recursive: true });
  writeFileSync(themeSettingsPath(dir), "{ not json");
  assert.equal(readThemeSetting(dir), undefined);
  writeFileSync(themeSettingsPath(dir), JSON.stringify({ theme: "   " }));
  assert.equal(readThemeSetting(dir), undefined);
  writeFileSync(themeSettingsPath(dir), JSON.stringify({ theme: 42 }));
  assert.equal(readThemeSetting(dir), undefined);
});

test("writing creates the config directory and never throws on a dead path", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  const nested = join(dir, "fresh", "lazydsh");
  writeThemeSetting("system", nested);
  assert.equal(readThemeSetting(nested), "system");
  // A path under a regular file cannot be created; the write must stay silent.
  const blocker = join(dir, "blocker");
  writeFileSync(blocker, "");
  assert.doesNotThrow(() => writeThemeSetting("dark", join(blocker, "nested")));
});
