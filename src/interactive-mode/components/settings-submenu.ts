/**
 * Settings Submenu
 *
 * Reusable submenu components for the settings selector: a single-step titled
 * select list (optionally searchable) and a generic N-step wizard built on top
 * of it. Ported from pi-coding-agent's `settings-submenu.js`.
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

const SUBMENU_SELECT_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32,
};

export interface SubmenuOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectSubmenuOptions {
  layout?: { minPrimaryColumnWidth?: number; maxPrimaryColumnWidth?: number };
  searchable?: boolean;
}

/**
 * Single-step submenu that shows a titled select list.
 * With `searchable: true`, typing filters the list using fuzzy matching.
 */
export class SelectSubmenu extends Container {
  private selectList: SelectList;
  private listChildIndex: number;
  private allOptions: SubmenuOption[];
  private listLayout: { minPrimaryColumnWidth?: number; maxPrimaryColumnWidth?: number };
  private searchInput: Input | undefined;
  private onSelectCb: (value: string) => void;
  private onCancelCb: () => void;
  private onSelectionChangeCb: ((value: string) => void) | undefined;

  constructor(
    title: string,
    description: string,
    options: SubmenuOption[],
    currentValue: string,
    onSelect: (value: string) => void,
    onCancel: () => void,
    onSelectionChange?: (value: string) => void,
    submenuOptions?: SelectSubmenuOptions,
  ) {
    super();
    this.allOptions = options;
    this.listLayout = submenuOptions?.layout ?? SUBMENU_SELECT_LIST_LAYOUT;
    this.onSelectCb = onSelect;
    this.onCancelCb = onCancel;
    this.onSelectionChangeCb = onSelectionChange;

    // Title
    this.addChild(new Text(theme.bold(theme.fg("accent", title)), 0, 0));
    // Description
    if (description) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(theme.fg("muted", description), 0, 0));
    }
    // Search input
    if (submenuOptions?.searchable) {
      this.addChild(new Spacer(1));
      this.searchInput = new Input();
      this.searchInput.onSubmit = () => {
        this.selectList.handleInput("\r");
      };
      this.addChild(this.searchInput);
    }
    // Spacer
    this.addChild(new Spacer(1));
    // Select list
    this.selectList = this.buildSelectList(options, currentValue);
    this.listChildIndex = this.children.length;
    this.addChild(this.selectList);
    // Hint
    this.addChild(new Spacer(1));
    const hint = submenuOptions?.searchable
      ? "  Type to filter · Enter to select · Esc to go back"
      : "  Enter to select · Esc to go back";
    this.addChild(new Text(theme.fg("dim", hint), 0, 0));
  }

  private buildSelectList(options: SubmenuOption[], preselect: string): SelectList {
    const list = new SelectList(
      options,
      Math.min(options.length, 10),
      getSelectListTheme(),
      this.listLayout,
    );
    const idx = options.findIndex((o) => o.value === preselect);
    if (idx !== -1) list.setSelectedIndex(idx);
    list.onSelect = (item) => this.onSelectCb(item.value);
    list.onCancel = () => this.onCancelCb();
    if (this.onSelectionChangeCb) {
      const cb = this.onSelectionChangeCb;
      list.onSelectionChange = (item) => cb(item.value);
    }
    return list;
  }

  private applyFilter(query: string): void {
    const filtered = query
      ? fuzzyFilter(this.allOptions, query, (item) => `${item.label} ${item.description ?? ""}`)
      : this.allOptions;
    const newList = this.buildSelectList(filtered, "");
    this.children[this.listChildIndex] = newList;
    this.selectList = newList;
  }

  handleInput(data: string): void {
    if (this.searchInput) {
      const kb = getKeybindings();
      const isNav =
        kb.matches(data, "tui.select.up") ||
        kb.matches(data, "tui.select.down") ||
        kb.matches(data, "tui.select.pageUp") ||
        kb.matches(data, "tui.select.pageDown") ||
        kb.matches(data, "tui.select.confirm") ||
        kb.matches(data, "tui.select.cancel");
      if (isNav) {
        this.selectList.handleInput(data);
      } else {
        this.searchInput.handleInput(data);
        this.applyFilter(this.searchInput.getValue());
      }
    } else {
      this.selectList.handleInput(data);
    }
  }
}

export interface SteppedSubmenuStep {
  key: string;
  title: string | ((ctx: Record<string, string>) => string);
  description?: string | ((ctx: Record<string, string>) => string);
  options: (ctx: Record<string, string>) => SubmenuOption[];
  preselect?: (ctx: Record<string, string>) => string | undefined;
  searchable?: boolean;
  layout?: { minPrimaryColumnWidth?: number; maxPrimaryColumnWidth?: number };
}

export interface SteppedSubmenuOptions {
  initialContext?: Record<string, string>;
  startAtStep?: number;
  /** When true, completing the final step returns to step 0. */
  loop?: boolean;
}

/**
 * Generic N-step submenu built on top of {@link SelectSubmenu}.
 * Each step's options can depend on prior selections via the shared context.
 * Esc goes back one step; Esc at step 0 cancels. With `loop: true`, completing
 * the final step invokes `onComplete` then returns to step 0.
 */
export class SteppedSubmenu extends Container {
  private steps: SteppedSubmenuStep[];
  private onComplete: (ctx: Record<string, string>) => void;
  private onCancel: () => void;
  private opts: SteppedSubmenuOptions;
  private activeComponent: SelectSubmenu;
  private context: Record<string, string>;

  constructor(
    steps: SteppedSubmenuStep[],
    onComplete: (ctx: Record<string, string>) => void,
    onCancel: () => void,
    opts: SteppedSubmenuOptions = {},
  ) {
    super();
    this.steps = steps;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.opts = opts;
    this.context = { ...opts.initialContext };
    this.activeComponent = this.buildStep(opts.startAtStep ?? 0);
  }

  private buildStep(stepIndex: number): SelectSubmenu {
    const step = this.steps[stepIndex];
    if (!step) throw new Error(`SteppedSubmenu: missing step ${stepIndex}`);
    const total = this.steps.length;
    const stepLabel = total > 1 ? `Step ${stepIndex + 1}/${total} · ` : "";
    const title = typeof step.title === "function" ? step.title(this.context) : step.title;
    const desc =
      typeof step.description === "function"
        ? step.description(this.context)
        : (step.description ?? "");
    const items = step.options(this.context);
    const preselect = step.preselect?.(this.context) ?? "";
    return new SelectSubmenu(
      title,
      `${stepLabel}${desc}`,
      items,
      preselect,
      (value) => {
        this.context[step.key] = value;
        if (stepIndex < total - 1) {
          // Advance to next step
          this.activeComponent = this.buildStep(stepIndex + 1);
        } else {
          // Final step — deliver result
          this.onComplete({ ...this.context });
          if (this.opts.loop) {
            this.context = {};
            this.activeComponent = this.buildStep(0);
          } else {
            this.onCancel();
          }
        }
      },
      () => {
        if (stepIndex > 0) {
          delete this.context[step.key];
          this.activeComponent = this.buildStep(stepIndex - 1);
        } else {
          this.onCancel();
        }
      },
      undefined,
      step.searchable || step.layout
        ? { searchable: step.searchable, layout: step.layout }
        : undefined,
    );
  }

  render(width: number): string[] {
    return this.activeComponent.render(width);
  }

  handleInput(data: string): void {
    this.activeComponent.handleInput(data);
  }

  invalidate(): void {
    this.activeComponent.invalidate();
  }
}
