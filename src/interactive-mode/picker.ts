import {
  Box,
  Input,
  SelectList,
  Text,
  Spacer,
  fuzzyFilter,
  matchesKey,
  type SelectItem,
} from "@earendil-works/pi-tui";
import { accent, dim, safeText } from "./theme.ts";
import { keyDisplayText, keyHint } from "./keybinding-hints.ts";

export const selectionTheme = {
  selectedPrefix: accent,
  selectedText: (text: string) => accent(text.replace(/^→ /, "› ")),
  description: dim,
  scrollInfo: dim,
  noMatch: () => dim("  No matches"),
};

/** Extra hints a caller can append, e.g. the session selector's sort/delete keys. */
export type PickerHints = string[];

export class SearchPicker extends Box {
  readonly capturesViewportInput = true;
  onSelect?: (value: string) => void;
  onCancel?: () => void;
  private readonly search = new Input({
    prompt: accent("┃ "),
    placeholder: "Search…",
    placeholderStyle: dim,
  });
  private readonly heading = new Text("", 0, 0);
  private readonly hintLine = new Text("", 0, 0);
  private items: SelectItem[] = [];
  private loading = false;
  private readonly title: string;
  private readonly limit: number;
  private readonly searchable: boolean;
  private extraHints: PickerHints = [];
  private list!: SelectList;

  constructor(
    items: SelectItem[],
    title: string,
    limit: number,
    selected?: string,
    searchable = true,
    extraHints: PickerHints = [],
  ) {
    super(2, 0);
    this.title = title;
    this.limit = limit;
    this.searchable = searchable;
    this.extraHints = extraHints;
    this.setItems(items, selected);
  }

  setItems(items: SelectItem[], selected?: string) {
    this.loading = false;
    this.items = items.map((item) => ({
      ...item,
      label: safeText(item.label).replace(/\s+/g, " "),
      description: item.description && safeText(item.description).replace(/\s+/g, " "),
    }));
    this.filter(selected);
  }

  setLoading() {
    this.loading = true;
    this.filter();
  }

  /** Replace the contextual hints shown below the list. */
  setHints(hints: PickerHints) {
    this.extraHints = hints;
    this.renderHints();
  }

  get focused() {
    return this.search.focused;
  }

  set focused(value: boolean) {
    this.search.focused = value;
  }

  private hintText(): string {
    const hints: string[] = [];
    if (this.loading) {
      hints.push(dim("Loading…"));
    } else {
      hints.push(
        `${keyHint("tui.select.down", "move")} · ${keyHint("tui.select.confirm", "select")} · ${keyHint("tui.select.cancel", "back")}`,
      );
      if (this.searchable) hints.push(dim("type to filter"));
      if (!this.searchable && this.items.length > 0) hints.push(dim("1-9 quick pick"));
    }
    hints.push(...this.extraHints);
    return hints.join(dim(" · "));
  }

  private renderHints() {
    this.hintLine.setText(this.hintText());
  }

  private filter(selected?: string) {
    const query = this.searchable ? this.search.getValue() : "";
    const items = fuzzyFilter(this.items, query, (item) => `${item.value} ${item.label}`);
    const numbered = this.searchable
      ? items
      : items.map((item, index) => ({ ...item, label: `${index + 1}) ${item.label}` }));
    this.heading.setText(dim(this.title.replace(/:\s*$/, "")));
    this.list = new SelectList(numbered, this.limit, {
      ...selectionTheme,
      noMatch: () => dim(this.loading ? "  Loading…" : "  No matches"),
    });
    const index = items.findIndex((item) => item.value === selected);
    if (index >= 0) this.list.setSelectedIndex(index);
    this.list.onSelect = (item) => this.onSelect?.(item.value);
    this.list.onCancel = () => this.onCancel?.();
    this.clear();
    this.addChild(this.heading);
    this.addChild(new Spacer(1));
    if (this.searchable) {
      this.addChild(this.search);
      this.addChild(new Spacer(1));
    }
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    this.renderHints();
    this.addChild(this.hintLine);
  }

  handleInput(data: string) {
    if (!this.searchable && /^[1-9]$/.test(data)) {
      const item = this.items[Number(data) - 1];
      if (item) this.onSelect?.(item.value);
      return;
    }
    if (
      (["up", "down", "enter", "escape", "pageUp", "pageDown"] as const).some((key) =>
        matchesKey(data, key),
      )
    )
      this.list.handleInput(data);
    else if (this.searchable) {
      this.search.handleInput(data);
      this.filter();
    }
  }
}

export { keyDisplayText, keyHint };
