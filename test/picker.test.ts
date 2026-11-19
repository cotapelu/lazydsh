import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { visibleWidth } from "@earendil-works/pi-tui";
import { SearchPicker } from "../src/picker.ts";

const items = [
  { value: "deepseek-flash", label: "DeepSeek Flash", description: "Fast model" },
  { value: "openai-codex", label: "Codex", description: "Coding model" },
];
const plain = (picker: SearchPicker, width = 80) =>
  picker
    .render(width)
    .map((line) =>
      stripVTControlCharacters(
        line
          .replaceAll("\x1b_pi:c\x07", "")
          .replaceAll("\x1b_pi:fc\x07", "")
          .replaceAll("\x1b_pi:/fc\x07", ""),
      ),
    )
    .join("\n");

test("picker filters model IDs and labels and selects the filtered item", () => {
  const picker = new SearchPicker(items, "Models", 6, undefined, true);
  picker.focused = true;
  assert.equal(picker.focused, true);
  assert.match(plain(picker), /Models/);
  assert.doesNotMatch(plain(picker), /Models \d/);
  assert.match(plain(picker), /┃ Search…/);
  assert.match(plain(picker), /type to filter/);
  assert.match(plain(picker), /› DeepSeek Flash/);
  picker.handleInput("codex");
  assert.doesNotMatch(plain(picker), /Models \d/);
  assert.doesNotMatch(plain(picker), /DeepSeek Flash/);
  let selected = "";
  picker.onSelect = (value) => {
    selected = value;
  };
  picker.handleInput("\r");
  assert.equal(selected, "openai-codex");
  let cancelled = false;
  picker.onCancel = () => {
    cancelled = true;
  };
  picker.handleInput("\x1b");
  assert.equal(cancelled, true);
});

test("picker preserves initial selection, limits rows, and fits narrow terminals", () => {
  const picker = new SearchPicker(items, "Models", 1, "openai-codex", true);
  assert.match(plain(picker), /› Codex/);
  assert.doesNotMatch(plain(picker), /DeepSeek Flash/);
  for (const width of [20, 48, 80])
    assert.ok(picker.render(width).every((line) => visibleWidth(line) <= width));
  picker.handleInput("zzzzz");
  assert.doesNotMatch(plain(picker), /Models \d/);
  assert.match(plain(picker), /No matches/);
});

test("picker opens while loading and keeps the query when items arrive", () => {
  const picker = new SearchPicker([], "Sessions", 6, undefined, true);
  picker.setLoading();
  assert.match(plain(picker), /Loading…/);
  picker.handleInput("codex");
  picker.setItems(items);
  assert.match(plain(picker), /Codex/);
  assert.doesNotMatch(plain(picker), /DeepSeek Flash|Loading…/);
  let selected = "";
  picker.onSelect = (value) => {
    selected = value;
  };
  picker.handleInput("\r");
  assert.equal(selected, "openai-codex");
});

test("fixed choices use numbered question-style selections without search", () => {
  const picker = new SearchPicker(items, "Authentication", 6, "openai-codex", false);
  assert.doesNotMatch(plain(picker), /Search|type to filter|┃/);
  assert.match(plain(picker), /› 2\) Codex/);
  assert.doesNotMatch(plain(picker), /Authentication 2/);
  picker.handleInput("codex");
  assert.match(plain(picker), /DeepSeek Flash/);
  let selected = "";
  picker.onSelect = (value) => {
    selected = value;
  };
  picker.handleInput("\r");
  assert.equal(selected, "openai-codex");
  picker.handleInput("1");
  assert.equal(selected, "deepseek-flash");
  let cancelled = false;
  picker.onCancel = () => {
    cancelled = true;
  };
  picker.handleInput("\x1b");
  assert.ok(cancelled);
  for (const width of [20, 48, 80])
    assert.ok(picker.render(width).every((line) => visibleWidth(line) <= width));
});

test("search mode stays tied to the operation when async catalogs change size", () => {
  const picker = new SearchPicker([], "Sessions", 6);
  picker.setLoading();
  assert.match(plain(picker), /Search|type to filter/);
  const many = Array.from({ length: 9 }, (_, index) => ({
    value: String(index),
    label: `Session ${index}`,
  }));
  picker.setItems(many);
  assert.match(plain(picker), /Search/);
  assert.match(plain(picker), /\(1\/9\)/);
  assert.doesNotMatch(plain(picker), /Sessions \d/);
  picker.handleInput("Session 8");
  assert.doesNotMatch(plain(picker), /Sessions \d/);
  let selected = "";
  picker.onSelect = (value) => {
    selected = value;
  };
  picker.handleInput("\r");
  assert.equal(selected, "8");
  picker.setItems(items);
  assert.match(plain(picker), /┃ Session 8/);
  const fixed = new SearchPicker([], "Reasoning effort", 6, undefined, false);
  fixed.setItems(many);
  assert.doesNotMatch(plain(fixed), /Search|type to filter/);
  assert.match(plain(fixed), /1\) Session 0/);
});
