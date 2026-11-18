/**
 * Thinking Level Selector Component
 *
 * Fuzzy search thinking level picker with current level marker,
 * default level badge, and save-as-default (Ctrl+S).
 * Ported from pi-coding-agent's ThinkingSelectorComponent.
 */

import {
  Container,
  fuzzyFilter,
  getKeybindings,
  Input,
  SelectList,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
import { getSelectListTheme, theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.js";
import { keyDisplayText } from "../keybinding-hints.js";

const THINKING_SELECT_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32,
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  off: "No reasoning",
  minimal: "Very brief reasoning (~1k tokens)",
  low: "Light reasoning (~2k tokens)",
  medium: "Moderate reasoning (~8k tokens)",
  high: "Deep reasoning (~16k tokens)",
  xhigh: "Extra-high reasoning (~32k tokens)",
  max: "Maximum reasoning",
};

interface ThinkingLevelItem {
  value: string;
  label: string;
  description: string;
}

interface ThinkingSelectorCallbacks {
  onSelect(level: string): void;
  onCancel(): void;
  onSelectAsDefault?(level: string): void;
}

interface ThinkingSelectorOptions extends ThinkingSelectorCallbacks {
  currentLevel: string;
  availableLevels: string[];
  defaultThinkingLevel?: string;
}

/**
 * Component that renders a thinking level selector with borders
 */
export class ThinkingSelectorComponent extends Container {
  private searchInput: Input;
  private selectList: SelectList;
  private selectListChildIndex: number;
  private allItems: ThinkingLevelItem[];
  private onSelectCallback: (level: string) => void;
  private onCancelCallback: () => void;
  private onSelectAsDefaultCallback?: (level: string) => void;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: ThinkingSelectorOptions) {
    super();
    this.onSelectCallback = (level: string) => options.onSelect(level);
    this.onCancelCallback = () => options.onCancel();
    this.onSelectAsDefaultCallback = options.onSelectAsDefault
      ? (level: string) => options.onSelectAsDefault!(level)
      : undefined;

    this.allItems = options.availableLevels.map((level) => ({
      value: level,
      label: `${level === options.currentLevel ? "✓ " : "  "}${level}`,
      description:
        level === options.defaultThinkingLevel
          ? `${LEVEL_DESCRIPTIONS[level]} · default`
          : LEVEL_DESCRIPTIONS[level],
    }));

    // Add top border
    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    this.addChild(new Text("Thinking Level", 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(`${keyDisplayText("app.thinking.cycle")} cycles thinking levels in-session`, 0, 0),
    );
    this.addChild(new Spacer(1));

    this.searchInput = new Input();
    this.searchInput.onSubmit = () => this.selectList.handleInput("\r");
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    // Create selector
    this.selectList = this.buildSelectList(this.allItems, options.currentLevel);
    this.selectListChildIndex = this.children.length;
    this.addChild(this.selectList);
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        theme.fg(
          "dim",
          `  ${keyDisplayText("tui.select.confirm")} to select · ${keyDisplayText("app.thinking.save")} to set as default · ${keyDisplayText("tui.select.cancel")} to cancel`,
        ),
        0,
        0,
      ),
    );
    // Add bottom border
    this.addChild(new DynamicBorder());
  }

  buildSelectList(items: ThinkingLevelItem[], preselect: string): SelectList {
    const list = new SelectList(
      items,
      Math.max(1, items.length),
      getSelectListTheme(),
      THINKING_SELECT_LIST_LAYOUT,
    );
    const currentIndex = items.findIndex((item) => item.value === preselect);
    if (currentIndex !== -1) {
      list.setSelectedIndex(currentIndex);
    }
    list.onSelect = (item) => this.onSelectCallback(item.value);
    list.onCancel = () => this.onCancelCallback();
    return list;
  }

  applyFilter(query: string): void {
    const filtered = query
      ? fuzzyFilter(this.allItems, query, (item) => `${item.value} ${item.description ?? ""}`)
      : this.allItems;
    const selectedValue = this.selectList.getSelectedItem()?.value ?? "";
    const newList = this.buildSelectList(filtered, selectedValue);
    this.children[this.selectListChildIndex] = newList;
    this.selectList = newList;
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    if (kb.matches(keyData, "app.thinking.save" as any) && this.onSelectAsDefaultCallback) {
      const item = this.selectList.getSelectedItem();
      if (item) this.onSelectAsDefaultCallback(item.value);
      return;
    }
    const isNav =
      kb.matches(keyData, "tui.select.up") ||
      kb.matches(keyData, "tui.select.down") ||
      kb.matches(keyData, "tui.select.confirm") ||
      kb.matches(keyData, "tui.select.cancel");
    if (isNav) {
      this.selectList.handleInput(keyData);
      return;
    }
    this.searchInput.handleInput(keyData);
    this.applyFilter(this.searchInput.getValue());
  }

  getSelectList(): SelectList {
    return this.selectList;
  }
}
