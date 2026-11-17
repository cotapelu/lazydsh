/**
 * Session Selector Component
 *
 * Tree view with branch characters, fuzzy search, archive/rename,
 * progress loading, sort modes, name filter, path display.
 * Ported from pi-coding-agent's SessionSelectorComponent.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import {
  Container,
  getKeybindings,
  Input,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint, keyText } from "../keybinding-hints.js";
import {
  filterAndSortSessions,
  hasSessionName,
  formatSessionDate,
  getSessionPathKey,
  buildSessionTree,
  flattenSessionTree,
  FlattenedSessionNode,
  type SessionRecord,
} from "./session-selector-search.js";

interface SessionSelectorOptions {
  currentSessionId?: string;
  currentDirectory: string;
  onSelect: (id: string) => void;
  onCancel: () => void;
  requestRender: () => void;
}

class SessionSelectorHeader {
  scope: "current" | "all";
  sortMode: "threaded" | "recent" | "relevance";
  nameFilter: "all" | "named";
  requestRender: () => void;
  loading = false;
  loadProgress: { loaded: number; total: number } | null = null;
  showPath = false;
  confirmingDeletePath: string | null = null;
  statusMessage: { type: "error" | "success"; message: string } | null = null;
  statusTimeout: ReturnType<typeof setTimeout> | null = null;
  showRenameHint = false;

  constructor(
    scope: "current" | "all",
    sortMode: "threaded" | "recent" | "relevance",
    nameFilter: "all" | "named",
    requestRender: () => void,
  ) {
    this.scope = scope;
    this.sortMode = sortMode;
    this.nameFilter = nameFilter;
    this.requestRender = requestRender;
  }

  setScope(scope: "current" | "all"): void {
    this.scope = scope;
  }

  setSortMode(sortMode: "threaded" | "recent" | "relevance"): void {
    this.sortMode = sortMode;
  }

  setNameFilter(nameFilter: "all" | "named"): void {
    this.nameFilter = nameFilter;
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
    this.loadProgress = null;
  }

  setProgress(loaded: number, total: number): void {
    this.loadProgress = { loaded, total };
  }

  setShowPath(showPath: boolean): void {
    this.showPath = showPath;
  }

  setShowRenameHint(show: boolean): void {
    this.showRenameHint = show;
  }

  setConfirmingDeletePath(path: string | null): void {
    this.confirmingDeletePath = path;
  }

  clearStatusTimeout(): void {
    if (!this.statusTimeout) return;
    clearTimeout(this.statusTimeout);
    this.statusTimeout = null;
  }

  setStatusMessage(
    msg: { type: "error" | "success"; message: string } | null,
    autoHideMs?: number,
  ): void {
    this.clearStatusTimeout();
    this.statusMessage = msg;
    if (!msg || !autoHideMs) return;
    this.statusTimeout = setTimeout(() => {
      this.statusMessage = null;
      this.statusTimeout = null;
      this.requestRender();
    }, autoHideMs);
  }

  invalidate(): void {}

  render(width: number): string[] {
    const title =
      this.scope === "current" ? "Resume Session (Current Folder)" : "Resume Session (All)";
    const leftText = theme.bold(title);
    const sortLabel =
      this.sortMode === "threaded" ? "Threaded" : this.sortMode === "recent" ? "Recent" : "Fuzzy";
    const sortText = theme.fg("muted", "Sort: ") + theme.fg("accent", sortLabel);
    const nameLabel = this.nameFilter === "all" ? "All" : "Named";
    const nameText = theme.fg("muted", "Name: ") + theme.fg("accent", nameLabel);
    let scopeText: string;
    if (this.loading) {
      const progressText = this.loadProgress
        ? `${this.loadProgress.loaded}/${this.loadProgress.total}`
        : "...";
      scopeText = `${theme.fg("muted", "○ Current Folder | ")}${theme.fg("accent", `Loading ${progressText}`)}`;
    } else if (this.scope === "current") {
      scopeText = `${theme.fg("accent", "◉ Current Folder")}${theme.fg("muted", " | ○ All")}`;
    } else {
      scopeText = `${theme.fg("muted", "○ Current Folder | ")}${theme.fg("accent", "◉ All")}`;
    }
    const rightText = truncateToWidth(`${scopeText}  ${nameText}  ${sortText}`, width, "");
    const availableLeft = Math.max(0, width - visibleWidth(rightText) - 1);
    const left = truncateToWidth(leftText, availableLeft, "");
    const spacing = Math.max(0, width - visibleWidth(left) - visibleWidth(rightText));

    let hintLine1: string;
    let hintLine2: string;
    if (this.confirmingDeletePath !== null) {
      const confirmHint = `Delete session? ${keyHint("tui.select.confirm", "confirm")} · ${keyHint("tui.select.cancel", "cancel")}`;
      hintLine1 = theme.fg("error", truncateToWidth(confirmHint, width, "…"));
      hintLine2 = "";
    } else if (this.statusMessage) {
      const color = this.statusMessage.type === "error" ? "error" : "accent";
      hintLine1 = theme.fg(color, truncateToWidth(this.statusMessage.message, width, "…"));
      hintLine2 = "";
    } else {
      const pathState = this.showPath ? "(on)" : "(off)";
      const sep = theme.fg("muted", " · ");
      const hint1 =
        keyHint("tui.input.tab", "scope") +
        sep +
        theme.fg("muted", 're:<pattern> regex · "phrase" exact');
      const hint2Parts = [
        keyHint("app.session.toggleSort", "sort"),
        keyHint("app.session.toggleNamedFilter", "named"),
        keyHint("app.session.delete", "delete"),
        keyHint("app.session.togglePath", `path ${pathState}`),
      ];
      if (this.showRenameHint) {
        hint2Parts.push(keyHint("app.session.rename", "rename"));
      }
      const hint2 = hint2Parts.join(sep);
      hintLine1 = truncateToWidth(hint1, width, "…");
      hintLine2 = truncateToWidth(hint2, width, "…");
    }
    return [`${left}${" ".repeat(spacing)}${rightText}`, hintLine1, hintLine2];
  }
}

/**
 * Custom session list component with multi-line items and search
 */
class SessionList extends Container {
  allSessions: SessionRecord[] = [];
  filteredSessions: FlattenedSessionNode[] = [];
  selectedIndex = 0;
  selectionTouched = false;
  searchInput: Input;
  showCwd = false;
  sortMode: "threaded" | "recent" | "relevance" = "threaded";
  nameFilter: "all" | "named" = "all";
  keybindings: any;
  showPath = false;
  confirmingDeletePath: string | null = null;
  currentSessionPathKey: string | undefined;
  onSelect: ((path: string) => void) | undefined;
  onCancel: (() => void) | undefined;
  onExit = (): void => {};
  onToggleScope: (() => void) | undefined;
  onToggleSort: (() => void) | undefined;
  onToggleNameFilter: (() => void) | undefined;
  onTogglePath: ((show: boolean) => void) | undefined;
  onDeleteConfirmationChange: ((path: string | null) => void) | undefined;
  onDeleteSession: ((path: string) => void) | undefined;
  onRenameSession: ((path: string) => void) | undefined;
  onError: ((msg: string) => void) | undefined;
  maxVisible = 10; // Max sessions visible (one line each)
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  getSelectedSessionPath(): string | undefined {
    const selected = this.filteredSessions[this.selectedIndex];
    return selected?.session.id;
  }

  constructor(
    sessions: SessionRecord[],
    showCwd: boolean,
    sortMode: "threaded" | "recent" | "relevance",
    nameFilter: "all" | "named",
    keybindings: any,
    currentSessionFilePath?: string,
  ) {
    super();
    this.allSessions = sessions;
    this.filteredSessions = [];
    this.searchInput = new Input();
    this.showCwd = showCwd;
    this.sortMode = sortMode;
    this.nameFilter = nameFilter;
    this.keybindings = keybindings;
    this.currentSessionPathKey = currentSessionFilePath
      ? getSessionPathKey(currentSessionFilePath)
      : undefined;
    this.filterSessions("");
    // Handle Enter in search input - select current item
    this.searchInput.onSubmit = () => {
      if (this.filteredSessions[this.selectedIndex]) {
        const selected = this.filteredSessions[this.selectedIndex];
        if (this.onSelect) {
          this.onSelect(selected.session.id);
        }
      }
    };
  }

  setSortMode(sortMode: "threaded" | "recent" | "relevance"): void {
    this.sortMode = sortMode;
    this.filterSessions(this.searchInput.getValue());
  }

  setNameFilter(nameFilter: "all" | "named"): void {
    this.nameFilter = nameFilter;
    this.filterSessions(this.searchInput.getValue());
  }

  setSessions(sessions: SessionRecord[], showCwd: boolean): void {
    const selectedPath = this.selectionTouched ? this.getSelectedSessionPath() : undefined;
    this.allSessions = sessions;
    this.showCwd = showCwd;
    this.filterSessions(this.searchInput.getValue());
    if (!this.selectionTouched) {
      this.selectedIndex = 0;
    } else if (selectedPath) {
      const selectedIndex = this.filteredSessions.findIndex(
        (node) => node.session.id === selectedPath,
      );
      if (selectedIndex >= 0) this.selectedIndex = selectedIndex;
    }
  }

  filterSessions(query: string): void {
    const trimmed = query.trim();
    const nameFiltered =
      this.nameFilter === "all" ? this.allSessions : this.allSessions.filter(hasSessionName);
    if (this.sortMode === "threaded" && !trimmed) {
      // Threaded mode without search: show tree structure
      const roots = buildSessionTree(nameFiltered);
      this.filteredSessions = flattenSessionTree(roots);
    } else {
      // Other modes or with search: flat list
      const filtered = filterAndSortSessions(nameFiltered, query, this.sortMode, "all");
      this.filteredSessions = filtered.map((session) => ({
        session,
        depth: 0,
        isLast: true,
        ancestorContinues: [],
      }));
    }
    this.selectedIndex = Math.min(
      this.selectedIndex,
      Math.max(0, this.filteredSessions.length - 1),
    );
  }

  setConfirmingDeletePath(path: string | null): void {
    this.confirmingDeletePath = path;
    this.onDeleteConfirmationChange?.(path);
  }

  startDeleteConfirmationForSelectedSession(): void {
    const selected = this.filteredSessions[this.selectedIndex];
    if (!selected) return;
    // Prevent deleting current session
    if (this.isCurrentSessionPath(selected.session.id)) {
      this.onError?.("Cannot delete the currently active session");
      return;
    }
    this.setConfirmingDeletePath(selected.session.id);
  }

  isCurrentSessionPath(path: string): boolean {
    if (!this.currentSessionPathKey) return false;
    return getSessionPathKey(path) === this.currentSessionPathKey;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const lines: string[] = [];
    // Render search input
    lines.push(...this.searchInput.render(width));
    lines.push(""); // Blank line after search
    if (this.filteredSessions.length === 0) {
      let emptyMessage: string;
      if (this.nameFilter === "named") {
        const toggleKey = keyText("app.session.toggleNamedFilter");
        if (this.showCwd) {
          emptyMessage = `  No named sessions found. Press ${toggleKey} to show all.`;
        } else {
          emptyMessage = `  No named sessions in current folder. Press ${toggleKey} to show all, or Tab to view all.`;
        }
      } else if (this.showCwd) {
        // "All" scope - no sessions anywhere that match filter
        emptyMessage = "  No sessions found";
      } else {
        // "Current folder" scope - hint to try "all"
        emptyMessage = "  No sessions in current folder. Press Tab to view all.";
      }
      lines.push(theme.fg("muted", truncateToWidth(emptyMessage, width, "…")));
      return lines;
    }
    // Calculate visible range with scrolling
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(this.maxVisible / 2),
        this.filteredSessions.length - this.maxVisible,
      ),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.filteredSessions.length);
    // Render visible sessions (one line each with tree structure)
    for (let i = startIndex; i < endIndex; i++) {
      const node = this.filteredSessions[i];
      const session = node.session;
      const isSelected = i === this.selectedIndex;
      const isConfirmingDelete = session.id === this.confirmingDeletePath;
      const isCurrent = this.isCurrentSessionPath(session.id);
      // Build tree prefix
      const prefix = this.buildTreePrefix(node);
      // Session display text (name or first message)
      const hasName = !!session.title;
      const displayText = session.title ?? session.id;
      // eslint-disable-next-line no-control-regex
      const normalizedMessage = displayText.replace(/[\u0000-\u001f\u007f]/gu, " ").trim();
      // Right side: message count and age
      const age = formatSessionDate(session.modified);
      const msgCount = String(session.messageCount);
      let rightPart = `${msgCount} ${age}`;
      if (this.showCwd && session.cwd) {
        rightPart = `${shortenHomePath(session.cwd)} ${rightPart}`;
      }
      if (this.showPath) {
        rightPart = `${shortenHomePath(session.directory)} ${rightPart}`;
      }
      // Cursor
      const cursor = isSelected ? theme.fg("accent", "› ") : "  ";
      // Calculate available width for message
      const prefixWidth = visibleWidth(prefix);
      const rightWidth = visibleWidth(rightPart) + 2; // +2 for spacing
      const availableForMsg = width - 2 - prefixWidth - rightWidth; // -2 for cursor
      const truncatedMsg = truncateToWidth(normalizedMessage, Math.max(10, availableForMsg), "…");
      // Style message
      let messageColor: string | null = null;
      if (isConfirmingDelete) {
        messageColor = "error";
      } else if (isCurrent) {
        messageColor = "accent";
      } else if (hasName) {
        messageColor = "warning";
      }
      let styledMsg = messageColor ? theme.fg(messageColor, truncatedMsg) : truncatedMsg;
      if (isSelected) {
        styledMsg = theme.bold(styledMsg);
      }
      // Build line
      const leftPart = cursor + theme.fg("dim", prefix) + styledMsg;
      const leftWidth = visibleWidth(leftPart);
      const spacing = Math.max(1, width - leftWidth - visibleWidth(rightPart));
      const styledRight = theme.fg(isConfirmingDelete ? "error" : "dim", rightPart);
      let line = leftPart + " ".repeat(spacing) + styledRight;
      if (isSelected) {
        line = theme.bg("selectedBg", line);
      }
      lines.push(truncateToWidth(line, width));
    }
    // Add scroll indicator if needed
    if (startIndex > 0 || endIndex < this.filteredSessions.length) {
      const scrollText = `  (${this.selectedIndex + 1}/${this.filteredSessions.length})`;
      const scrollInfo = theme.fg("muted", truncateToWidth(scrollText, width, ""));
      lines.push(scrollInfo);
    }
    return lines;
  }

  buildTreePrefix(node: FlattenedSessionNode): string {
    if (node.depth === 0) {
      return "";
    }
    const parts = node.ancestorContinues.map((continues) => (continues ? "│  " : "   "));
    const branch = node.isLast ? "└─ " : "├─ ";
    return parts.join("") + branch;
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    // Handle delete confirmation state first - intercept all keys
    if (this.confirmingDeletePath !== null) {
      if (kb.matches(keyData, "tui.select.confirm")) {
        const pathToDelete = this.confirmingDeletePath;
        this.setConfirmingDeletePath(null);
        this.onDeleteSession?.(pathToDelete);
        return;
      }
      if (kb.matches(keyData, "tui.select.cancel")) {
        this.setConfirmingDeletePath(null);
        return;
      }
      // Ignore all other keys while confirming
      return;
    }
    if (kb.matches(keyData, "tui.input.tab")) {
      if (this.onToggleScope) {
        this.onToggleScope();
      }
      return;
    }
    if (kb.matches(keyData, "app.session.toggleSort")) {
      this.onToggleSort?.();
      return;
    }
    if (this.keybindings.matches(keyData, "app.session.toggleNamedFilter")) {
      this.onToggleNameFilter?.();
      return;
    }
    // Ctrl+P: toggle path display
    if (kb.matches(keyData, "app.session.togglePath")) {
      this.showPath = !this.showPath;
      this.onTogglePath?.(this.showPath);
      return;
    }
    // Ctrl+D: initiate delete confirmation
    if (kb.matches(keyData, "app.session.delete")) {
      this.startDeleteConfirmationForSelectedSession();
      return;
    }
    // Rename selected session
    if (kb.matches(keyData, "app.session.rename")) {
      const selected = this.filteredSessions[this.selectedIndex];
      if (selected) {
        this.onRenameSession?.(selected.session.id);
      }
      return;
    }
    // Ctrl+Backspace: non-invasive convenience alias for delete
    // Only triggers deletion when the query is empty; otherwise it is forwarded to the input
    if (kb.matches(keyData, "app.session.deleteNoninvasive")) {
      if (this.searchInput.getValue().length > 0) {
        this.searchInput.handleInput(keyData);
        this.filterSessions(this.searchInput.getValue());
        return;
      }
      this.startDeleteConfirmationForSelectedSession();
      return;
    }
    this.selectionTouched = true;
    // Up arrow
    if (kb.matches(keyData, "tui.select.up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    }
    // Down arrow
    else if (kb.matches(keyData, "tui.select.down")) {
      this.selectedIndex = Math.min(this.filteredSessions.length - 1, this.selectedIndex + 1);
    }
    // Page up - jump up by maxVisible items
    else if (kb.matches(keyData, "tui.select.pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
    }
    // Page down - jump down by maxVisible items
    else if (kb.matches(keyData, "tui.select.pageDown")) {
      this.selectedIndex = Math.min(
        this.filteredSessions.length - 1,
        this.selectedIndex + this.maxVisible,
      );
    }
    // Enter
    else if (kb.matches(keyData, "tui.select.confirm")) {
      const selected = this.filteredSessions[this.selectedIndex];
      if (selected && this.onSelect) {
        this.onSelect(selected.session.id);
      }
    }
    // Escape - cancel
    else if (kb.matches(keyData, "tui.select.cancel")) {
      if (this.onCancel) {
        this.onCancel();
      }
    }
    // Pass everything else to search input
    else {
      this.searchInput.handleInput(keyData);
      this.filterSessions(this.searchInput.getValue());
    }
  }
}

/**
 * Delete a session file, trying the `trash` CLI first, then falling back to unlink
 */
export async function deleteSessionFile(
  sessionPath: string,
): Promise<{ ok: boolean; method: string; error?: string }> {
  // Try `trash` first (if installed)
  const trashArgs = sessionPath.startsWith("-") ? ["--", sessionPath] : [sessionPath];
  const trashResult = spawnSync("trash", trashArgs, { encoding: "utf-8" });
  const getTrashErrorHint = (): string | null => {
    const parts: string[] = [];
    if (trashResult.error) {
      parts.push(trashResult.error.message);
    }
    const stderr = trashResult.stderr?.trim();
    if (stderr) {
      parts.push(stderr.split("\n")[0] ?? stderr);
    }
    if (parts.length === 0) return null;
    return `trash: ${parts.join(" · ").slice(0, 200)}`;
  };
  // If trash reports success, or the file is gone afterwards, treat it as successful
  if (trashResult.status === 0 || !existsSync(sessionPath)) {
    return { ok: true, method: "trash" };
  }
  // Fallback to permanent deletion
  try {
    await unlink(sessionPath);
    return { ok: true, method: "unlink" };
  } catch (err) {
    const unlinkError = err instanceof Error ? err.message : String(err);
    const trashErrorHint = getTrashErrorHint();
    const error = trashErrorHint ? `${unlinkError} (${trashErrorHint})` : unlinkError;
    return { ok: false, method: "unlink", error };
  }
}

function shortenHomePath(path: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (!home) return path;
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  if (path.startsWith(home + "\\")) return "~" + path.slice(home.length);
  return path;
}

/**
 * Session Selector Component
 */
export class SessionSelectorComponent extends Container {
  get capturesViewportInput(): boolean {
    return this.mode !== "rename";
  }

  private mode: "list" | "rename" = "list";
  private sessionList: SessionList;
  private header: SessionSelectorHeader;
  private keybindings: any;
  private scope: "current" | "all" = "current";
  private sortMode: "threaded" | "recent" | "relevance" = "threaded";
  private nameFilter: "all" | "named" = "all";
  private canRename = true;
  private renameInput: Input | undefined;

  constructor(options: SessionSelectorOptions) {
    super();
    this.keybindings = getKeybindings();
    this.sessionList = new SessionList(
      [],
      false,
      this.sortMode,
      this.nameFilter,
      this.keybindings,
      options.currentSessionId,
    );
    this.sessionList.onSelect = options.onSelect;
    this.sessionList.onCancel = options.onCancel;
    this.sessionList.onExit = () => {};
    this.sessionList.onToggleScope = () => this.toggleScope();
    this.sessionList.onToggleSort = () => this.toggleSort();
    this.sessionList.onToggleNameFilter = () => this.toggleNameFilter();
    this.sessionList.onTogglePath = (show) => this.setShowPath(show);
    this.sessionList.onDeleteConfirmationChange = (path) =>
      this.header.setConfirmingDeletePath(path);
    this.sessionList.onDeleteSession = (path) => this.deleteSession(path);
    this.sessionList.onRenameSession = (path) => this.startRename(path);
    this.sessionList.onError = (msg) =>
      this.header.setStatusMessage({ type: "error", message: msg }, 4000);

    this.header = new SessionSelectorHeader(
      this.scope,
      this.sortMode,
      this.nameFilter,
      options.requestRender,
    );

    this.addChild(new DynamicBorder());
    this.addChild(this.header);
    this.addChild(new DynamicBorder());
    this.addChild(this.sessionList);
  }

  setLoading(): void {
    this.header.setLoading(true);
    this.invalidate();
  }

  setProgress(loaded: number, total: number): void {
    this.header.setProgress(loaded, total);
    this.invalidate();
  }

  setSessions(sessions: SessionRecord[]): void {
    this.header.setLoading(false);
    this.sessionList.setSessions(sessions, this.scope === "all");
    this.invalidate();
  }

  setStatus(message: { type: "error" | "success"; message: string }, autoHideMs: number): void {
    this.header.setStatusMessage(message, autoHideMs);
    this.invalidate();
  }

  toggleScope(): void {
    this.scope = this.scope === "current" ? "all" : "current";
    this.header.setScope(this.scope);
    this.sessionList.showCwd = this.scope === "all";
    this.invalidate();
  }

  toggleSort(): void {
    const modes: Array<"threaded" | "recent" | "relevance"> = ["threaded", "recent", "relevance"];
    const currentIndex = modes.indexOf(this.sortMode);
    this.sortMode = modes[(currentIndex + 1) % modes.length];
    this.header.setSortMode(this.sortMode);
    this.sessionList.setSortMode(this.sortMode);
    this.invalidate();
  }

  toggleNameFilter(): void {
    this.nameFilter = this.nameFilter === "all" ? "named" : "all";
    this.header.setNameFilter(this.nameFilter);
    this.sessionList.setNameFilter(this.nameFilter);
    this.invalidate();
  }

  setShowPath(show: boolean): void {
    this.header.setShowPath(show);
    this.sessionList.showPath = show;
    this.invalidate();
  }

  async deleteSession(path: string): Promise<void> {
    const result = await deleteSessionFile(path);
    if (result.ok) {
      this.header.setStatusMessage(
        { type: "success", message: `Session deleted (${result.method})` },
        3000,
      );
    } else {
      this.header.setStatusMessage(
        { type: "error", message: `Delete failed: ${result.error}` },
        5000,
      );
    }
  }

  startRename(_path: string): void {
    const selected = this.sessionList.filteredSessions[this.sessionList.selectedIndex];
    if (!selected) return;
    this.mode = "rename";
    this.renameInput = new Input();
    this.renameInput.setValue(selected.session.title);
    this.renameInput.onSubmit = () => {
      const newTitle = this.renameInput!.getValue().trim();
      if (newTitle && newTitle !== selected.session.title) {
        // The rename is handled by the parent via onRenameSession callback
        // We just close the rename mode
      }
      this.exitRenameMode();
    };
    this.header.setShowRenameHint(true);
    this.invalidate();
  }

  exitRenameMode(): void {
    this.mode = "list";
    this.renameInput = undefined;
    this.header.setShowRenameHint(false);
    this.invalidate();
  }

  handleInput(data: string): void {
    if (this.mode === "rename") {
      const kb = getKeybindings();
      if (kb.matches(data, "tui.select.cancel")) {
        this.exitRenameMode();
        return;
      }
      this.renameInput?.handleInput(data);
      return;
    }
    this.sessionList.handleInput(data);
  }

  render(width: number): string[] {
    if (this.mode === "rename" && this.renameInput) {
      const lines = [...this.header.render(width), "", ...this.renameInput.render(width)];
      return lines;
    }
    const lines = [...this.header.render(width), ...this.sessionList.render(width)];
    return lines;
  }
}
