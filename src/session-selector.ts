/**
 * Session Selector Component
 *
 * Session picker with tree view, fuzzy search, delete/rename, scope toggle.
 * Ported from pi-coding-agent's SessionSelectorComponent.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import {
  Container,
  getKeybindings,
  Input,
  Spacer,
  Text,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { KeybindingsManager } from "./keybindings.js";
import { theme } from "./theme/theme.js";
import { DynamicBorder } from "./components/dynamic-border.js";
import { keyHint, keyText } from "./keybinding-hints.js";
import {
  filterAndSortSessions,
  hasSessionName,
  buildSessionTree,
  flattenSessionTree,
  getSessionPathKey,
} from "./session-selector-search.js";

function formatSessionDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

function shortenHomePath(path: string): string {
  const { homedir } = require("node:os");
  const home = homedir();
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  if (path.startsWith(home + "\\")) return "~" + path.slice(home.length);
  return path;
}

export class SessionSelectorHeader {
  scope: "current" | "all";
  sortMode: "threaded" | "recent" | "relevance";
  nameFilter: "all" | "named";
  requestRender: () => void;
  loading = false;
  loadProgress: { loaded: number; total: number } | null = null;
  showPath = false;
  confirmingDeletePath: string | null = null;
  statusMessage: { type: "error" | "info"; message: string } | null = null;
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

  setScope(scope: "current" | "all") {
    this.scope = scope;
  }
  setSortMode(sortMode: "threaded" | "recent" | "relevance") {
    this.sortMode = sortMode;
  }
  setNameFilter(nameFilter: "all" | "named") {
    this.nameFilter = nameFilter;
  }
  setLoading(loading: boolean) {
    this.loading = loading;
    this.loadProgress = null;
  }
  setProgress(loaded: number, total: number) {
    this.loadProgress = { loaded, total };
  }
  setShowPath(showPath: boolean) {
    this.showPath = showPath;
  }
  setShowRenameHint(show: boolean) {
    this.showRenameHint = show;
  }
  setConfirmingDeletePath(path: string | null) {
    this.confirmingDeletePath = path;
  }

  clearStatusTimeout() {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
  }

  setStatusMessage(msg: { type: "error" | "info"; message: string } | null, autoHideMs?: number) {
    this.clearStatusTimeout();
    this.statusMessage = msg;
    if (msg && autoHideMs) {
      this.statusTimeout = setTimeout(() => {
        this.statusMessage = null;
        this.statusTimeout = null;
        this.requestRender();
      }, autoHideMs);
    }
  }

  invalidate() {}
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
      if (this.showRenameHint) hint2Parts.push(keyHint("app.session.rename", "rename"));
      const hint2 = hint2Parts.join(sep);
      hintLine1 = truncateToWidth(hint1, width, "…");
      hintLine2 = truncateToWidth(hint2, width, "…");
    }

    return [`${left}${" ".repeat(spacing)}${rightText}`, hintLine1, hintLine2];
  }
}

export class SessionList {
  allSessions: any[] = [];
  filteredSessions: any[] = [];
  selectedIndex = 0;
  selectionTouched = false;
  searchInput: Input;
  showCwd = false;
  sortMode: "threaded" | "recent" | "relevance" = "threaded";
  nameFilter: "all" | "named" = "all";
  keybindings: KeybindingsManager;
  showPath = false;
  confirmingDeletePath: string | null = null;
  currentSessionPathKey: string | undefined;
  onSelect: ((sessionPath: string) => void) | undefined;
  onCancel: (() => void) | undefined;
  onExit: (() => void) | undefined;
  onToggleScope: (() => void) | undefined;
  onToggleSort: (() => void) | undefined;
  onToggleNameFilter: (() => void) | undefined;
  onTogglePath: ((showPath: boolean) => void) | undefined;
  onDeleteConfirmationChange: ((path: string | null) => void) | undefined;
  onDeleteSession: ((sessionPath: string) => void) | undefined;
  onRenameSession: ((sessionPath: string) => void) | undefined;
  onError: ((msg: string) => void) | undefined;
  maxVisible = 10;
  _focused = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(
    sessions: any[],
    showCwd: boolean,
    sortMode: "threaded" | "recent" | "relevance",
    nameFilter: "all" | "named",
    keybindings: KeybindingsManager,
    currentSessionFilePath?: string,
  ) {
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

    this.searchInput.onSubmit = () => {
      if (this.filteredSessions[this.selectedIndex] && this.onSelect) {
        this.onSelect(this.filteredSessions[this.selectedIndex].session.path);
      }
    };
  }

  setSortMode(sortMode: "threaded" | "recent" | "relevance") {
    this.sortMode = sortMode;
    this.filterSessions(this.searchInput.getValue());
  }
  setNameFilter(nameFilter: "all" | "named") {
    this.nameFilter = nameFilter;
    this.filterSessions(this.searchInput.getValue());
  }

  setSessions(sessions: any[], showCwd: boolean) {
    const selectedPath = this.selectionTouched ? this.getSelectedSessionPath() : undefined;
    this.allSessions = sessions;
    this.showCwd = showCwd;
    this.filterSessions(this.searchInput.getValue());
    if (!this.selectionTouched) {
      this.selectedIndex = 0;
    } else if (selectedPath) {
      const selectedIndex = this.filteredSessions.findIndex(
        (node: any) => node.session.path === selectedPath,
      );
      if (selectedIndex >= 0) this.selectedIndex = selectedIndex;
    }
  }

  filterSessions(query: string) {
    const trimmed = query.trim();
    const nameFiltered =
      this.nameFilter === "all"
        ? this.allSessions
        : this.allSessions.filter((session) => hasSessionName(session));

    if (this.sortMode === "threaded" && !trimmed) {
      const roots = buildSessionTree(nameFiltered);
      this.filteredSessions = flattenSessionTree(roots);
    } else {
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

  getSelectedSessionPath(): string | undefined {
    const selected = this.filteredSessions[this.selectedIndex];
    return selected?.session.path;
  }

  setConfirmingDeletePath(path: string | null) {
    this.confirmingDeletePath = path;
    this.onDeleteConfirmationChange?.(path);
  }

  startDeleteConfirmationForSelectedSession() {
    const selected = this.filteredSessions[this.selectedIndex];
    if (!selected) return;
    if (this.isCurrentSessionPath(selected.session.path)) {
      this.onError?.("Cannot delete the currently active session");
      return;
    }
    this.setConfirmingDeletePath(selected.session.path);
  }

  isCurrentSessionPath(path: string): boolean {
    if (!this.currentSessionPathKey) return false;
    return getSessionPathKey(path) === this.currentSessionPathKey;
  }

  invalidate() {}
  render(width: number): string[] {
    const lines: string[] = [];

    // Render search input
    lines.push(...this.searchInput.render(width));
    lines.push("");

    if (this.filteredSessions.length === 0) {
      let emptyMessage: string;
      if (this.nameFilter === "named") {
        const toggleKey = keyText("app.session.toggleNamedFilter");
        emptyMessage = this.showCwd
          ? `  No named sessions found. Press ${toggleKey} to show all.`
          : `  No named sessions in current folder. Press ${toggleKey} to show all, or Tab to view all.`;
      } else if (this.showCwd) {
        emptyMessage = "  No sessions found";
      } else {
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

    // Render visible sessions
    for (let i = startIndex; i < endIndex; i++) {
      const node = this.filteredSessions[i];
      const session = node.session;
      const isSelected = i === this.selectedIndex;
      const isConfirmingDelete = session.path === this.confirmingDeletePath;
      const isCurrent = this.isCurrentSessionPath(session.path);

      // Build tree prefix
      const prefix = this.buildTreePrefix(node);

      // Session display text
      const hasName = !!session.name;
      const displayText = session.name ?? session.firstMessage ?? "";
      // eslint-disable-next-line no-control-regex
      const normalizedMessage = displayText.replace(/[\x00-\x1f\x7f]/g, " ").trim();

      // Right side: message count and age
      const age = formatSessionDate(session.modified);
      const msgCount = String(session.messageCount);
      let rightPart = `${msgCount} ${age}`;
      if (this.showCwd && session.cwd) rightPart = `${shortenHomePath(session.cwd)} ${rightPart}`;
      if (this.showPath) rightPart = `${shortenHomePath(session.path)} ${rightPart}`;

      const cursor = isSelected ? theme.fg("accent", "› ") : "  ";
      const prefixWidth = visibleWidth(prefix);
      const rightWidth = visibleWidth(rightPart) + 2;
      const availableForMsg = width - 2 - prefixWidth - rightWidth;
      const truncatedMsg = truncateToWidth(normalizedMessage, Math.max(10, availableForMsg), "…");

      let messageColor: string | null = null;
      if (isConfirmingDelete) messageColor = "error";
      else if (isCurrent) messageColor = "accent";
      else if (hasName) messageColor = "warning";

      let styledMsg = messageColor ? theme.fg(messageColor, truncatedMsg) : truncatedMsg;
      if (isSelected) styledMsg = theme.bold(styledMsg);

      const leftPart = cursor + theme.fg("dim", prefix) + styledMsg;
      const leftWidth = visibleWidth(leftPart);
      const spacing = Math.max(1, width - leftWidth - visibleWidth(rightPart));
      const styledRight = theme.fg(isConfirmingDelete ? "error" : "dim", rightPart);
      let line = leftPart + " ".repeat(spacing) + styledRight;
      if (isSelected) line = theme.bg("selectedBg", line);
      lines.push(truncateToWidth(line, width));
    }

    // Scroll indicator
    if (startIndex > 0 || endIndex < this.filteredSessions.length) {
      const scrollText = `  (${this.selectedIndex + 1}/${this.filteredSessions.length})`;
      lines.push(theme.fg("muted", truncateToWidth(scrollText, width, "")));
    }

    return lines;
  }

  buildTreePrefix(node: any): string {
    if (node.depth === 0) return "";
    const parts = node.ancestorContinues.map((continues: boolean) => (continues ? "│  " : "   "));
    const branch = node.isLast ? "└─ " : "├─ ";
    return parts.join("") + branch;
  }

  handleInput(keyData: string) {
    const kb = getKeybindings();

    // Handle delete confirmation state first
    if (this.confirmingDeletePath !== null) {
      if (kb.matches(keyData, "tui.select.confirm")) {
        const pathToDelete = this.confirmingDeletePath!;
        this.setConfirmingDeletePath(null);
        this.onDeleteSession?.(pathToDelete);
        return;
      }
      if (kb.matches(keyData, "tui.select.cancel")) {
        this.setConfirmingDeletePath(null);
        return;
      }
      return;
    }

    if (kb.matches(keyData, "tui.input.tab")) {
      this.onToggleScope?.();
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
    if (kb.matches(keyData, "app.session.togglePath")) {
      this.showPath = !this.showPath;
      this.onTogglePath?.(this.showPath);
      return;
    }
    if (kb.matches(keyData, "app.session.delete")) {
      this.startDeleteConfirmationForSelectedSession();
      return;
    }
    if (kb.matches(keyData, "app.session.rename")) {
      const selected = this.filteredSessions[this.selectedIndex];
      if (selected) this.onRenameSession?.(selected.session.path);
      return;
    }
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
    if (kb.matches(keyData, "tui.select.up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (kb.matches(keyData, "tui.select.down")) {
      this.selectedIndex = Math.min(this.filteredSessions.length - 1, this.selectedIndex + 1);
    } else if (kb.matches(keyData, "tui.select.pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
    } else if (kb.matches(keyData, "tui.select.pageDown")) {
      this.selectedIndex = Math.min(
        this.filteredSessions.length - 1,
        this.selectedIndex + this.maxVisible,
      );
    } else if (kb.matches(keyData, "tui.select.confirm")) {
      const selected = this.filteredSessions[this.selectedIndex];
      if (selected && this.onSelect) this.onSelect(selected.session.path);
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancel?.();
    } else {
      this.searchInput.handleInput(keyData);
      this.filterSessions(this.searchInput.getValue());
    }
  }
}

async function deleteSessionFile(
  sessionPath: string,
): Promise<{ ok: boolean; method: string; error?: string }> {
  const trashArgs = sessionPath.startsWith("-") ? ["--", sessionPath] : [sessionPath];
  const trashResult = spawnSync("trash", trashArgs, { encoding: "utf-8" });

  const getTrashErrorHint = () => {
    const parts: string[] = [];
    if (trashResult.error) parts.push(trashResult.error.message);
    const stderr = trashResult.stderr?.trim();
    if (stderr) parts.push(stderr.split("\n")[0] ?? stderr);
    if (parts.length === 0) return null;
    return `trash: ${parts.join(" · ").slice(0, 200)}`;
  };

  if (trashResult.status === 0 || !existsSync(sessionPath)) return { ok: true, method: "trash" };

  try {
    await unlink(sessionPath);
    return { ok: true, method: "unlink" };
  } catch (err) {
    const unlinkError = err instanceof Error ? err.message : String(err);
    const trashErrorHint = getTrashErrorHint();
    return {
      ok: false,
      method: "unlink",
      error: trashErrorHint ? `${unlinkError} (${trashErrorHint})` : unlinkError,
    };
  }
}

export interface SessionSelectorOptions {
  keybindings?: KeybindingsManager;
  renameSession?: (sessionPath: string, newName: string) => Promise<string>;
  showRenameHint?: boolean;
}

export class SessionSelectorComponent extends Container {
  get capturesViewportInput() {
    return this.mode !== "rename";
  }

  canRename = true;
  sessionList: SessionList;
  header: SessionSelectorHeader;
  keybindings: KeybindingsManager;
  scope: "current" | "all" = "current";
  sortMode: "threaded" | "recent" | "relevance" = "threaded";
  nameFilter: "all" | "named" = "all";
  currentSessions: any[] | null = null;
  allSessions: any[] | null = null;
  currentSessionsLoader:
    | ((
        onProgress: (loaded: number, total: number, partial: any[]) => void,
        signal: AbortSignal,
      ) => Promise<any[]>)
    | null = null;
  allSessionsLoader:
    | ((
        onProgress: (loaded: number, total: number, partial: any[]) => void,
        signal: AbortSignal,
      ) => Promise<any[]>)
    | null = null;
  requestRender: () => void;
  renameSession: ((sessionPath: string, newName: string) => Promise<string>) | undefined;
  currentLoad: AbortController | null = null;
  allLoad: AbortController | null = null;
  mode: "list" | "rename" = "list";
  renameInput = new Input();
  renameTargetPath: string | null = null;
  _focused = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.sessionList.focused = value;
    this.renameInput.focused = value;
    if (value && this.mode === "rename") this.renameInput.focused = true;
  }

  buildBaseLayout(content: any, options: { showHeader?: boolean } = {}) {
    this.clear();
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    this.addChild(new Spacer(1));
    if (options.showHeader !== false) {
      this.addChild(this.header);
      this.addChild(new Spacer(1));
    }
    this.addChild(content);
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
  }

  constructor(
    currentSessionsLoader: (
      onProgress: (loaded: number, total: number, partial: any[]) => void,
      signal: AbortSignal,
    ) => Promise<any[]>,
    allSessionsLoader: (
      onProgress: (loaded: number, total: number, partial: any[]) => void,
      signal: AbortSignal,
    ) => Promise<any[]>,
    onSelect: (sessionPath: string) => void,
    onCancel: () => void,
    onExit: () => void,
    requestRender: () => void,
    options: SessionSelectorOptions = {},
    currentSessionFilePath?: string,
  ) {
    super();
    this.keybindings = options.keybindings ?? KeybindingsManager.create();
    this.currentSessionsLoader = currentSessionsLoader;
    this.allSessionsLoader = allSessionsLoader;
    this.requestRender = requestRender;
    this.renameSession = options.renameSession;
    this.canRename = !!options.renameSession;

    this.header = new SessionSelectorHeader(
      this.scope,
      this.sortMode,
      this.nameFilter,
      this.requestRender,
    );
    this.header.setShowRenameHint(options.showRenameHint ?? this.canRename);

    this.sessionList = new SessionList(
      [],
      false,
      this.sortMode,
      this.nameFilter,
      this.keybindings,
      currentSessionFilePath,
    );
    this.buildBaseLayout(this.sessionList);

    this.renameInput.onSubmit = (value) => {
      void this.confirmRename(value);
    };

    const clearStatusMessage = () => this.header.setStatusMessage(null);

    this.sessionList.onSelect = (sessionPath) => {
      clearStatusMessage();
      this.cancelLoads();
      onSelect(sessionPath);
    };
    this.sessionList.onCancel = () => {
      clearStatusMessage();
      this.cancelLoads();
      onCancel();
    };
    this.sessionList.onExit = () => {
      clearStatusMessage();
      this.cancelLoads();
      onExit();
    };
    this.sessionList.onToggleScope = () => this.toggleScope();
    this.sessionList.onToggleSort = () => this.toggleSortMode();
    this.sessionList.onToggleNameFilter = () => this.toggleNameFilter();
    this.sessionList.onRenameSession = (sessionPath) => {
      if (!this.renameSession) return;
      if (this.scope === "current" ? this.currentLoad : this.allLoad) return;
      const sessions =
        this.scope === "all" ? (this.allSessions ?? []) : (this.currentSessions ?? []);
      const session = sessions.find((s) => s.path === sessionPath);
      this.enterRenameMode(sessionPath, session?.name);
    };
    this.sessionList.onTogglePath = (showPath) => {
      this.header.setShowPath(showPath);
      this.requestRender();
    };
    this.sessionList.onDeleteConfirmationChange = (path) => {
      this.header.setConfirmingDeletePath(path);
      this.requestRender();
    };
    this.sessionList.onError = (msg) => {
      this.header.setStatusMessage({ type: "error", message: msg }, 3000);
      this.requestRender();
    };
    this.sessionList.onDeleteSession = async (sessionPath) => {
      const result = await deleteSessionFile(sessionPath);
      if (result.ok) {
        if (this.currentSessions)
          this.currentSessions = this.currentSessions.filter((s) => s.path !== sessionPath);
        if (this.allSessions)
          this.allSessions = this.allSessions.filter((s) => s.path !== sessionPath);
        const sessions =
          this.scope === "all" ? (this.allSessions ?? []) : (this.currentSessions ?? []);
        const showCwd = this.scope === "all";
        this.sessionList.setSessions(sessions, showCwd);
        const msg = result.method === "trash" ? "Session moved to trash" : "Session deleted";
        this.header.setStatusMessage({ type: "info", message: msg }, 2000);
        await this.refreshSessionsAfterMutation();
      } else {
        this.header.setStatusMessage(
          { type: "error", message: `Failed to delete: ${result.error}` },
          3000,
        );
      }
      this.requestRender();
    };

    void this.loadScope("current");
  }

  cancelLoads() {
    if (this.currentLoad) {
      this.currentLoad.abort();
      this.currentLoad = null;
      this.currentSessions = null;
    }
    if (this.allLoad) {
      this.allLoad.abort();
      this.allLoad = null;
      this.allSessions = null;
    }
  }

  enterRenameMode(sessionPath: string, currentName?: string) {
    this.mode = "rename";
    this.renameTargetPath = sessionPath;
    this.renameInput.setValue(currentName ?? "");
    this.renameInput.focused = true;

    const panel = new Container();
    panel.addChild(new Text(theme.bold("Rename Session"), 1, 0));
    panel.addChild(new Spacer(1));
    panel.addChild(this.renameInput);
    panel.addChild(new Spacer(1));
    panel.addChild(
      new Text(
        theme.fg(
          "muted",
          `${keyText("tui.select.confirm")} to save · ${keyText("tui.select.cancel")} to cancel`,
        ),
        1,
        0,
      ),
    );
    this.buildBaseLayout(panel, { showHeader: false });
    this.requestRender();
  }

  exitRenameMode() {
    this.mode = "list";
    this.renameTargetPath = null;
    this.buildBaseLayout(this.sessionList);
    this.requestRender();
  }

  async confirmRename(value: string) {
    const next = value.trim();
    if (!next) return;
    const target = this.renameTargetPath;
    if (!target) {
      this.exitRenameMode();
      return;
    }

    const renameSession = this.renameSession;
    if (!renameSession) {
      this.exitRenameMode();
      return;
    }

    try {
      await renameSession(target, next);
      await this.refreshSessionsAfterMutation();
    } finally {
      this.exitRenameMode();
    }
  }

  async loadScope(scope: "current" | "all") {
    if (scope === "current" ? this.currentLoad : this.allLoad) return;
    const showCwd = scope === "all";
    const controller = new AbortController();
    if (scope === "current") this.currentLoad = controller;
    else this.allLoad = controller;

    this.header.setScope(scope);
    this.header.setLoading(true);
    this.requestRender();

    const isActive = () => (scope === "current" ? this.currentLoad : this.allLoad) === controller;
    const onProgress = (loaded: number, total: number, partialSessions?: any[]) => {
      if (!isActive()) return;
      if (partialSessions) {
        const sessions = [...partialSessions];
        if (scope === "current") this.currentSessions = sessions;
        else this.allSessions = sessions;
        if (scope === this.scope) this.sessionList.setSessions(sessions, showCwd);
      }
      if (scope !== this.scope) return;
      this.header.setProgress(loaded, total);
      this.requestRender();
    };

    try {
      const sessions = await (scope === "current"
        ? this.currentSessionsLoader!(onProgress, controller.signal)
        : this.allSessionsLoader!(onProgress, controller.signal));
      if (!isActive()) return;
      if (scope === "current") {
        this.currentSessions = sessions;
        this.currentLoad = null;
      } else {
        this.allSessions = sessions;
        this.allLoad = null;
      }
      if (scope !== this.scope) return;
      this.header.setLoading(false);
      this.sessionList.setSessions(sessions, showCwd);
      this.requestRender();
    } catch (err) {
      if (!isActive()) return;
      if (scope === "current") {
        this.currentLoad = null;
        this.currentSessions = null;
      } else {
        this.allLoad = null;
        this.allSessions = null;
      }
      if (scope !== this.scope) return;
      const message = err instanceof Error ? err.message : String(err);
      this.header.setLoading(false);
      this.header.setStatusMessage(
        { type: "error", message: `Failed to load sessions: ${message}` },
        4000,
      );
      this.sessionList.setSessions([], showCwd);
      this.requestRender();
    }
  }

  toggleSortMode() {
    this.sortMode =
      this.sortMode === "threaded"
        ? "recent"
        : this.sortMode === "recent"
          ? "relevance"
          : "threaded";
    this.header.setSortMode(this.sortMode);
    this.sessionList.setSortMode(this.sortMode);
    this.requestRender();
  }

  toggleNameFilter() {
    this.nameFilter = this.nameFilter === "all" ? "named" : "all";
    this.header.setNameFilter(this.nameFilter);
    this.sessionList.setNameFilter(this.nameFilter);
    this.requestRender();
  }

  async refreshSessionsAfterMutation() {
    this.cancelLoads();
    this.currentSessions = null;
    this.allSessions = null;
    await this.loadScope(this.scope);
  }

  toggleScope() {
    this.scope = this.scope === "current" ? "all" : "current";
    const sessions = this.scope === "current" ? this.currentSessions : this.allSessions;
    const loading = (this.scope === "current" ? this.currentLoad : this.allLoad) !== null;
    this.header.setScope(this.scope);
    this.header.setLoading(loading);
    this.sessionList.setSessions(sessions ?? [], this.scope === "all");
    this.requestRender();
    if (sessions === null && !loading) void this.loadScope(this.scope);
  }

  handleInput(data: string) {
    if (this.mode === "rename") {
      const kb = getKeybindings();
      if (kb.matches(data, "tui.select.cancel")) {
        this.exitRenameMode();
        return;
      }
      this.renameInput.handleInput(data);
      return;
    }
    this.sessionList.handleInput(data);
  }

  getSessionList() {
    return this.sessionList;
  }
}
