import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { commandMenu } from "../src/commands.ts";
test("plugin descriptions survive and TUI command collisions have one accurate description", () => {
  const commands = commandMenu([
    { name: "plugin", description: "Plugin-provided help", input: { hint: "<value>" } },
    { name: "empty", description: " " },
    { name: "model", description: "Shadowed" },
  ]);
  assert.equal(commands.find((command) => command.name === "plugin")?.argumentHint, "<value>");
  assert.ok(commands.every((command) => command.description?.trim()));
  assert.equal(commands.filter((command) => command.name === "model").length, 1);
  assert.notEqual(commands.find((command) => command.name === "model")?.description, "Shadowed");
});
