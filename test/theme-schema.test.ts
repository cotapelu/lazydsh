import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateTheme } from "../src/interactive-mode/theme/theme-schema.ts";
import { setTheme, getAvailableThemes } from "../src/interactive-mode/theme/theme.ts";

test("a valid theme document passes validation", () => {
  assert.doesNotThrow(() =>
    validateTheme({
      name: "custom",
      colors: { accent: "#00d9ff", warning: "" },
      appearance: "dark",
    }),
  );
});

test("invalid documents are rejected with their slot named", () => {
  assert.throws(() => validateTheme({}), /colors/);
  assert.throws(() => validateTheme({ colors: { accent: "not-a-color" } }), /Invalid theme/);
  assert.throws(() => validateTheme({ colors: {}, appearance: "sideways" }), /Invalid theme/);
  assert.throws(
    () => validateTheme({ colors: { accent: "oklch(70% 0.1 200)" }, unexpected: true }),
    /Invalid theme/,
  );
});

test("a malformed user theme fails loudly and falls back, never half-applies", () => {
  const home = mkdtempSync(join(tmpdir(), "lazydsh-theme-"));
  const themes = join(home, "lazydsh", "themes");
  mkdirSync(themes, { recursive: true });
  writeFileSync(
    join(themes, "broken.json"),
    JSON.stringify({ colors: { accent: "#ff00" }, name: "broken" }),
  );
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    // Discoverable from the picker…
    assert.ok(getAvailableThemes().includes("broken"));
    // …but applying it reports the validation error instead of rendering garbage.
    const result = setTheme("broken", true);
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /Invalid theme|not-a-color|pattern/);
    // The default theme is still active afterwards.
    assert.equal(setTheme("lazydsh", true).success, true);
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
  }
});
