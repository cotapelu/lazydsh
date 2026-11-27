import { readFileSync } from "node:fs";
import { test, expect } from "vitest";
import { packageVersion } from "../src/interactive-mode/utils/version.ts";

test("packageVersion reads the manifest version", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version?: string };
  expect(packageVersion()).toBe(manifest.version);
});

test("packageVersion is stable across reads", () => {
  expect(packageVersion()).toBe(packageVersion());
});
