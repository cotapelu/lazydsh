import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readThemeSetting, writeThemeSetting } from "../src/interactive-mode/theme/theme.ts";

test("a written setting round-trips through a fresh read", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  const originalEnv = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    writeThemeSetting("dark");
    assert.equal(readThemeSetting(), "dark");
  } finally {
    process.env.XDG_CONFIG_HOME = originalEnv;
  }
});

test("the auto pair persists verbatim for the controller to parse", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  const originalEnv = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    writeThemeSetting("light/dark");
    assert.equal(readThemeSetting(), "light/dark");
  } finally {
    process.env.XDG_CONFIG_HOME = originalEnv;
  }
});

test("missing, malformed, or empty documents fall back to undefined", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  const originalEnv = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    assert.equal(readThemeSetting(), undefined); // no file yet
    mkdirSync(join(dir, "lazydsh"), { recursive: true });
    writeFileSync(join(dir, "lazydsh", "theme.json"), "{ not json");
    assert.equal(readThemeSetting(), undefined);
    writeFileSync(join(dir, "lazydsh", "theme.json"), JSON.stringify({ theme: "   " }));
    assert.equal(readThemeSetting(), undefined);
    writeFileSync(join(dir, "lazydsh", "theme.json"), JSON.stringify({ theme: 42 }));
    assert.equal(readThemeSetting(), undefined);
  } finally {
    process.env.XDG_CONFIG_HOME = originalEnv;
  }
});

test("writing creates the config directory and never throws on a dead path", () => {
  const dir = mkdtempSync(join(tmpdir(), "lazydsh-theme-settings-"));
  const originalEnv = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    writeThemeSetting("system");
    assert.equal(readThemeSetting(), "system");
    // A path under a regular file cannot be created; the write must stay silent.
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "");
    assert.doesNotThrow(() => writeThemeSetting("dark"));
  } finally {
    process.env.XDG_CONFIG_HOME = originalEnv;
  }
});
