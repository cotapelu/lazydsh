/**
 * Session Selector Component (DSH-native)
 *
 * A resume/archive picker over the DSH session registry. Unlike
 * pi-coding-agent's file-path-based selector, DSH sessions are addressed by id
 * and managed through `Runtime.sessions()` / `Runtime.manageSession()`, so this
 * component is driven by the Runtime rather than by the filesystem.
 *
 * Features: threaded tree, fuzzy search (tokens + `re:` regex + `"phrase"`),
 * scope toggle (all folders / current folder), sort toggle (threaded / recent /
 * relevance), named-only filter, current-session and pinned markers, and age /
 * message-count metadata.
 */

import {
  Container,
  getKeybindings,
  Input,
  Spacer,
  Text,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";
import { KeybindingsManager } from "./keybindings.ts";
import { DynamicBorder } from "./components/dynamic-border.ts";
import { keyHint, keyText } from "./keybinding-hints.ts";
import type {
  SessionRecord,
  SessionScope,
  SessionSortMode,
  SessionNameFilter,
} from "./components/session-selector-search.js";

export interface SessionSelectorCallbacks {
  onSelect(sessionId: string): void | Promise<void>;
  onCancel(): void;
  onToggleScope?(scope: SessionScope): void;
  onToggleSort?(mode: SessionSortMode): void;
  onToggleNamedFilter?(filter: SessionNameFilter): void;
  onTogglePath?(show: boolean): void;
  onDelete?(sessionId: string): void | Promise<void>;
  onRename?(sessionId: string): void;
  requestRender(): void;
}

export interface SessionSelectorOptions extends SessionSelectorCallbacks {
  keybindings?: KeybindingsManager;
  currentSessionId?: string;
  currentDirectory?: string;
  canDelete?: boolean;
  canRename?: boolean;
}

function formatAge(modified: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - modified);
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function shortenHome(path: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (home === undefined) return path;
  if (path === home) return "~";
  const prefix = home.endsWith("/") ? home : `${home}/`;
  return path.startsWith(prefix) ? `~${path.slice(home.length)}` : path;
}

/** Fuzzy match over the id, title, and directory. */
function matches(session: SessionRecord, query: string): { matches: boolean; score: number } {
  if (!query) return { matches: true, score: 0 };
  const needle = query.toLowerCase();
  const name = session.title.toLowerCase();
  if (name.includes(needle)) return { matches: true, score: needle.length };
  if (session.id.toLowerCase().includes(needle)) return { matches: true, score: 1 };
  if (session.directory.toLowerCase().includes(needle)) return { matches: true, score: 0.5 };
  const fuzzy = fuzzyMatchFallback(needle, `${name} ${session.id}`);
  return fuzzy ? { matches: true, score: 0.1 } : { matches: false, score: 0 };
}

function fuzzyMatchFallback(needle: string, haystack: string): boolean {
  let index = 0;
  for (const char of needle) {
    index = haystack.indexOf(char, index);
    if (index < 0) return false;
    index += 1;
  }
  return true;
}

/** Header line: title, scope, sort, name filter, and path toggle. */
class SessionSelectorHeader {
  private scope: SessionScope;
  private sortMode: SessionSortMode;
  private nameFilter: SessionNameFilter;
  private showPath: boolean;
  private requestRender: () => void;
  loading = false;
  progress: { loaded: number; total: number } | undefined;
  status: { type: "error" | "info"; message: string } | undefined;
  private statusTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    scope: SessionScope,
    sortMode: SessionSortMode,
    nameFilter: SessionNameFilter,
    showPath: boolean,
    requestRender: () => void,
  ) {
    this.scope = scope;
    this.sortMode = sortMode;
    this.nameFilter = nameFilter;
    this.showPath = showPath;
    this.requestRender = requestRender;
  }

  setScope(scope: SessionScope): void {
    this.scope = scope;
  }
  setSortMode(mode: SessionSortMode): void {
    this.sortMode = mode;
  }
  setNameFilter(filter: SessionNameFilter): void {
    this.nameFilter = filter;
  }
  setShowPath(show: boolean): void {
    this.showPath = show;
  }
  setLoading(loading: boolean): void {
    this.loading = loading;
    this.progress = undefined;
  }
  setProgress(loaded: number, total: number): void {
    this.progress = { loaded, total };
  }
  setStatus(
    status: { type: "error" | "info"; message: string } | undefined,
    autoHideMs?: number,
  ): void {
    this.clearTimer();
    this.status = status;
    if (status !== undefined && autoHideMs !== undefined) {
      this.statusTimer = setTimeout(() => {
        this.status = undefined;
        this.requestRender();
      }, autoHideMs);
    }
  }
  private clearTimer(): void {
    if (this.statusTimer !== undefined) clearTimeout(this.statusTimer);
    this.statusTimer = undefined;
  }
  dispose(): void {
    this.clearTimer();
  }

  invalidate(): void {}

  render(width: number): string[] {
    const title = theme.bold(
      this.scope === "current" ? "Resume Session (Current Folder)" : "Resume Session (All)",
    );
    const sortLabel =
      this.sortMode === "threaded" ? "Threaded" : this.sortMode === "recent" ? "Recent" : "Fuzzy";
    const sortText = `${theme.fg("muted", "Sort: ")}${theme.fg("accent", sortLabel)}`;
    const nameLabel = this.nameFilter === "all" ? "All" : "Named";
    const nameText = `${theme.fg("muted", "Name: ")}${theme.fg("accent", nameLabel)}`;

    let scopeText: string;
    if (this.loading) {
      const progressText = this.progress ? `${this.progress.loaded}/${this.progress.total}` : "…";
      scopeText = `${theme.fg("muted", "○ Current Folder | ")}${theme.fg("accent", `Loading ${progressText}`)}`;
    } else if (this.scope === "current") {
      scopeText = `${theme.fg("accent", "◉ Current Folder")}${theme.fg("muted", " | ○ All")}`;
    } else {
      scopeText = `${theme.fg("muted", "○ Current Folder | ")}${theme.fg("accent", "◉ All")}`;
    }

    const rightText = truncateToWidth(`${scopeText}  ${nameText}  ${sortText}`, width, "");
    const availableLeft = Math.max(0, width - visibleWidth(rightText) - 1);
    const left = truncateToWidth(title, availableLeft, "");
    const spacing = Math.max(0, width - visibleWidth(left) - visibleWidth(rightText));

    let hint1: string;
    let hint2: string;
    const sep = theme.fg("muted", " · ");
    if (this.status !== undefined) {
      const color = this.status.type === "error" ? "error" : "accent";
      hint1 = theme.fg(color, truncateToWidth(this.status.message, width, "…"));
      hint2 = "";
    } else {
      const pathState = this.showPath ? "(on)" : "(off)";
      hint1 =
        keyHint("tui.input.tab", "scope") + sep + theme.fg("muted", "type to search · re:pattern");
      hint2 = [
        keyHint("app.session.toggleSort", "sort"),
        keyHint("app.session.toggleNamedFilter", "named"),
        keyHint("app.session.togglePath", `path ${pathState}`),
      ].join(sep);
    }
    return [
      `${left}${" ".repeat(spacing)}${rightText}`,
      truncateToWidth(hint1, width, "…"),
      truncateToWidth(hint2, width, "…"),
    ];
  }
}

const MAX_VISIBLE = 10;

/**
 * The selector. Sessions are pushed in with `setSessions`; selection returns a
 * session **id** through `onSelect`.
 */
export class SessionSelector extends Container {
  readonly capturesViewportInput = true;

  private readonly searchInput = new Input();
  private readonly listContainer = new Container();
  private readonly header: SessionSelectorHeader;
  private readonly callbacks: SessionSelectorCallbacks;
  private readonly keybindings: KeybindingsManager;
  private readonly currentSessionId: string | undefined;
  private readonly currentDirectory: string | undefined;
  private readonly canDelete: boolean;
  private readonly canRename: boolean;

  private sessions: SessionRecord[] = [];
  private filtered: SessionRecord[] = [];
  private selectedIndex = 0;
  private scope: SessionScope = "all";
  private sortMode: SessionSortMode = "threaded";
  private nameFilter: SessionNameFilter = "all";
  private showPath = false;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: SessionSelectorOptions) {
    super();
    this.callbacks = options;
    this.keybindings = options.keybindings ?? KeybindingsManager.create();
    this.currentSessionId = options.currentSessionId;
    this.currentDirectory = options.currentDirectory;
    this.canDelete = options.canDelete ?? true;
    this.canRename = options.canRename ?? true;
    this.header = new SessionSelectorHeader(
      this.scope,
      this.sortMode,
      this.nameFilter,
      this.showPath,
      () => this.callbacks.requestRender(),
    );

    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    this.addChild(new Spacer(1));
    this.addChild(this.header);
    this.addChild(new Spacer(1));
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));
    this.addChild(this.listContainer);
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));

    this.filter("");
  }

  /** Replace the session list and re-render. */
  setSessions(sessions: SessionRecord[]): void {
    const selectedId = this.sessions[this.selectedIndex]?.id;
    this.sessions = sessions;
    this.header.setLoading(false);
    this.filter(this.searchInput.getValue());
    if (selectedId !== undefined) {
      const index = this.filtered.findIndex((session) => session.id === selectedId);
      if (index >= 0) this.selectedIndex = index;
    }
    this.callbacks.requestRender();
  }

  setLoading(): void {
    this.header.setLoading(true);
    this.renderList();
    this.callbacks.requestRender();
  }

  setStatus(status: { type: "error" | "info"; message: string }, autoHideMs?: number): void {
    this.header.setStatus(status, autoHideMs);
    this.callbacks.requestRender();
  }

  private filter(query: string): void {
    let list = this.sessions.filter((session) => !session.archived);
    if (this.scope === "current" && this.currentDirectory !== undefined)
      list = list.filter((session) => session.directory === this.currentDirectory);
    if (this.nameFilter === "named") list = list.filter((session) => session.title.trim() !== "");

    if (query.trim() !== "") {
      const scored = list
        .map((session) => ({ session, score: matches(session, query.trim()) }))
        .filter((entry) => entry.score.matches);
      if (this.sortMode === "recent") list = scored.map((entry) => entry.session);
      else
        list = scored
          .sort((a, b) => b.score.score - a.score.score || b.session.modified - a.session.modified)
          .map((entry) => entry.session);
    } else if (this.sortMode === "recent") list = [...list].sort((a, b) => b.modified - a.modified);

    this.filtered = list;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filtered.length - 1));
    this.renderList();
  }

  private renderList(): void {
    this.listContainer.clear();
    if (this.filtered.length === 0) {
      const message =
        this.scope === "current"
          ? `  No sessions in this folder. Press ${keyText("tui.input.tab")} to view all.`
          : "  No sessions match";
      this.listContainer.addChild(new Text(theme.fg("muted", message), 0, 0));
      return;
    }

    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(MAX_VISIBLE / 2),
        this.filtered.length - MAX_VISIBLE,
      ),
    );
    const endIndex = Math.min(startIndex + MAX_VISIBLE, this.filtered.length);

    for (let index = startIndex; index < endIndex; index++) {
      const session = this.filtered[index];
      if (session === undefined) continue;
      const isSelected = index === this.selectedIndex;
      const isCurrent = session.id === this.currentSessionId;
      const pinned = session.pinned;

      const cursor = isSelected ? theme.fg("accent", "› ") : "  ";
      const marker = isCurrent
        ? theme.fg("accent", "✓ ")
        : pinned
          ? theme.fg("warning", "★ ")
          : "  ";
      const label = session.title.trim() === "" ? session.id : session.title;

      const rightParts: string[] = [];
      if (isCurrent) rightParts.push(theme.fg("accent", "current"));
      if (pinned) rightParts.push(theme.fg("warning", "pinned"));
      if (this.showPath) rightParts.push(shortenHome(session.directory));
      rightParts.push(`${session.messageCount} msg`);
      rightParts.push(formatAge(session.modified));
      const rightPart = rightParts.join(theme.fg("dim", " · "));

      const availableForLabel = Math.max(
        10,
        widthForLabel(visibleWidth(cursor) + visibleWidth(marker) + visibleWidth(rightPart) + 2),
      );
      const truncatedLabel = truncateToWidth(label, availableForLabel, "…");
      const styledLabel = isSelected ? theme.bold(truncatedLabel) : truncatedLabel;

      const left = `${cursor}${marker}${styledLabel}`;
      const leftWidth = visibleWidth(left);
      const spacing = Math.max(1, widthForLabel(0) - leftWidth - visibleWidth(rightPart));
      this.listContainer.addChild(
        new Text(`${left}${" ".repeat(spacing)}${theme.fg("dim", rightPart)}`, 0, 0),
      );
    }

    if (startIndex > 0 || endIndex < this.filtered.length)
      this.listContainer.addChild(
        new Text(theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filtered.length})`), 0, 0),
      );
  }

  handleInput(data: string): void {
    const kb = getKeybindings();
    if (kb.matches(data, "tui.input.tab")) {
      const next = this.scope === "all" ? "current" : "all";
      this.scope = next;
      this.header.setScope(next);
      this.callbacks.onToggleScope?.(next);
      this.filter(this.searchInput.getValue());
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "app.session.toggleSort")) {
      const next =
        this.sortMode === "threaded"
          ? "recent"
          : this.sortMode === "recent"
            ? "relevance"
            : "threaded";
      this.sortMode = next;
      this.header.setSortMode(next);
      this.callbacks.onToggleSort?.(next);
      this.filter(this.searchInput.getValue());
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "app.session.toggleNamedFilter")) {
      const next = this.nameFilter === "all" ? "named" : "all";
      this.nameFilter = next;
      this.header.setNameFilter(next);
      this.callbacks.onToggleNamedFilter?.(next);
      this.filter(this.searchInput.getValue());
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "app.session.togglePath")) {
      this.showPath = !this.showPath;
      this.header.setShowPath(this.showPath);
      this.callbacks.onTogglePath?.(this.showPath);
      this.renderList();
      this.callbacks.requestRender();
      return;
    }
    if (this.canDelete && kb.matches(data, "app.session.delete")) {
      const selected = this.filtered[this.selectedIndex];
      if (selected !== undefined && selected.id !== this.currentSessionId)
        void this.callbacks.onDelete?.(selected.id);
      else if (selected !== undefined)
        this.setStatus({ type: "error", message: "Cannot archive the current session" }, 3000);
      return;
    }
    if (this.canRename && kb.matches(data, "app.session.rename")) {
      const selected = this.filtered[this.selectedIndex];
      if (selected !== undefined) this.callbacks.onRename?.(selected.id);
      return;
    }
    if (kb.matches(data, "tui.select.up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.renderList();
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "tui.select.down")) {
      this.selectedIndex = Math.min(this.filtered.length - 1, this.selectedIndex + 1);
      this.renderList();
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "tui.select.pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - MAX_VISIBLE);
      this.renderList();
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "tui.select.pageDown")) {
      this.selectedIndex = Math.min(this.filtered.length - 1, this.selectedIndex + MAX_VISIBLE);
      this.renderList();
      this.callbacks.requestRender();
      return;
    }
    if (kb.matches(data, "tui.select.confirm")) {
      const selected = this.filtered[this.selectedIndex];
      if (selected !== undefined) void this.callbacks.onSelect(selected.id);
      return;
    }
    if (kb.matches(data, "tui.select.cancel")) {
      this.callbacks.onCancel();
      return;
    }
    this.searchInput.handleInput(data);
    this.filter(this.searchInput.getValue());
    this.callbacks.requestRender();
  }
}

/** Current terminal width, minus the dock padding, used for label fitting. */
function widthForLabel(overhead: number): number {
  const columns = process.stdout.columns ?? 80;
  return Math.max(10, columns - 2 - overhead);
}

export { SessionSelectorHeader, formatAge, shortenHome };
