import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { visibleWidth } from "@earendil-works/pi-tui";
import { ApprovalPanel, type ApprovalChoice } from "../src/approval.ts";

const plain = (panel: ApprovalPanel, width = 80) =>
  panel.render(width).map(stripVTControlCharacters).join("\n");

test("approval renders the tool, reason, and selectable choices", () => {
  const panel = new ApprovalPanel({ toolName: "bash", reason: "Needs network access" });
  const text = plain(panel);
  assert.match(text, /Permission required/);
  assert.match(text, /Allow bash to run\?/);
  assert.match(text, /Needs network access/);
  assert.match(text, /› 1\) Allow once/);
  assert.match(text, /2\) Reject/);
  assert.doesNotMatch(text, /Type your answer|Other/);
  for (const width of [20, 48, 80])
    assert.ok(panel.render(width).every((line) => visibleWidth(line) <= width));
});

test("approval keys select, reject, and cancel without free text", () => {
  const cases: [string, ApprovalChoice | "cancel"][] = [
    ["1", "allowed-once"],
    ["2", "rejected"],
    ["\r", "allowed-once"],
    ["y", "allowed-once"],
    ["n", "rejected"],
    ["\x1b", "cancel"],
  ];
  for (const [key, expected] of cases) {
    const panel = new ApprovalPanel({ toolName: "bash" });
    let choice: ApprovalChoice | "cancel" | undefined;
    panel.onSelect = (value) => {
      choice = value;
    };
    panel.onCancel = () => {
      choice = "cancel";
    };
    panel.handleInput(key);
    assert.equal(choice, expected, `key ${JSON.stringify(key)}`);
  }
});

test("approval wraps arrow selection and renders safely without a reason", () => {
  const panel = new ApprovalPanel({ toolName: "write" });
  let chosen: ApprovalChoice | undefined;
  panel.onSelect = (value) => {
    chosen = value;
  };
  panel.handleInput("\x1b[B");
  panel.handleInput("\r");
  assert.equal(chosen, "rejected");
  panel.handleInput("\x1b[A");
  panel.handleInput(" ");
  assert.equal(chosen, "rejected");
  assert.doesNotMatch(plain(panel), /undefined/);
});
