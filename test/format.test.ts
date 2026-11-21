import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { formatDuration } from "../src/utils/format.ts";

test("durations use days, hours, minutes and seconds across boundaries", () => {
  for (const [seconds, expected] of [
    [0, "0s"],
    [59, "59s"],
    [60, "1m 0s"],
    [65.9, "1m 5s"],
    [3605, "1h 5s"],
    [90061, "1d 1h 1m 1s"],
    [810549, "9d 9h 9m 9s"],
  ] as const)
    assert.equal(formatDuration(seconds), expected);
});
