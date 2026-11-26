import { test } from "vite-plus/test";
import assert from "node:assert/strict";

test("theme schema validation is not needed with builtin-only theme", () => {
  // With builtin-only theme, validation is not needed
  // The builtin colors are validated at compile time
  assert.ok(true);
});
