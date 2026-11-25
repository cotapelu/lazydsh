/**
 * Config Selector Component
 *
 * TUI component for managing package resources (enable/disable).
 * Ported from pi-coding-agent's ConfigSelectorComponent.
 */

import {
  Container,
  Input,
  Spacer,
  getKeybindings,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { DynamicBorder } from "./dynamic-border.ts";
import { theme } from "../theme/theme.ts";
import { keyHint, rawKeyHint } from "../keybinding-hints.ts";

const RESOURCE_TYPES = ["extensions", "skills", "prompts", "themes"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  extensions: "Extensions",
  skills: "Skills",
  prompts: "Prompts",
  themes: "Themes",
};

interface ResolvedResourceItem {
  path: string;
  enabled: boolean;
  metadata: ResolvedResourceMetadata;
}

interface ResolvedResourceMetadata {
  origin: "package" | "top-level";
  scope: "user" | "project";
  source: string;
  baseDir?: string;
}

interface ResolvedPaths {
  global: ResolvedResourceItem[];
  project: ResolvedResourceItem[];
}

interface SettingsManager {
  getGlobalSettings(): Record<string, unknown>;
  getProjectSettings(): Record<string, unknown>;
  setExtensionPaths(paths: string[]): void;
  setSkillPaths(paths: string[]): void;
  setPromptTemplatePaths(paths: string[]): void;
  setThemePaths(paths: string[]): void;
  setProjectExtensionPaths(paths: string[]): void;
  setProjectSkillPaths(paths: string[]): void;
  setProjectPromptTemplatePaths(paths: string[]): void;
  setProjectThemePaths(paths: string[]): void;
  setPackages(packages: unknown[]): void;
  setProjectPackages(packages: unknown[]): void;
}

interface ConfigSelectorCallbacks {
  onClose: () => void;
  onExit: () => void;
  requestRender: () => void;
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

function dirname(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
}

function relative(from: string, to: string): string {
  // Simple relative path implementation
  const fromParts = from.split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }
  const up = fromParts.length - i;
  return [...Array(up).fill(".."), ...toParts.slice(i)].join("/");
}

function formatBaseDir(baseDir: string): string {
  const displayPath = baseDir.replace(/^.*[\\/]/, "").replace(/\\/g, "/");
  return displayPath.endsWith("/") ? displayPath : `${displayPath}/`;
}

function getGroupLabel(metadata: ResolvedResourceMetadata, agentDir: string): string {
  if (metadata.origin === "package") {
    return `${metadata.source} (${metadata.scope})`;
  }
  if (metadata.source === "builtin") {
    return metadata.scope === "user" ? "Built-in" : "Built-in (project override)";
  }
  if (metadata.source === "auto") {
    if (metadata.baseDir) {
      return metadata.scope === "user"
        ? `User (${formatBaseDir(metadata.baseDir)})`
        : `Project (${formatBaseDir(metadata.baseDir)})`;
    }
    return metadata.scope === "user" ? `User (${formatBaseDir(agentDir)})` : "Project (.lazydsh/)";
  }
  return metadata.scope === "user" ? "User settings" : "Project settings";
}

function buildGroups(resolved: ResolvedResourceItem[], agentDir: string): Group[] {
  const groupMap = new Map<string, Group>();

  const addToGroup = (resources: ResolvedResourceItem[], resourceType: ResourceType) => {
    for (const res of resources) {
      const { path, enabled, metadata } = res;
      const groupKey = `${metadata.origin}:${metadata.scope}:${metadata.source}:${metadata.baseDir ?? ""}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          label: getGroupLabel(metadata, agentDir),
          scope: metadata.scope,
          origin: metadata.origin,
          source: metadata.source,
          subgroups: [],
        });
      }
      const group = groupMap.get(groupKey)!;
      const subgroupKey = `${groupKey}:${resourceType}`;
      let subgroup = group.subgroups.find((sg) => sg.type === resourceType);
      if (!subgroup) {
        subgroup = {
          type: resourceType,
          label: RESOURCE_TYPE_LABELS[resourceType],
          items: [],
        };
        group.subgroups.push(subgroup);
      }
      const fileName = basename(path);
      const parentFolder = basename(dirname(path));
      let displayName: string;
      if (metadata.source === "builtin") {
        displayName = path;
      } else if (resourceType === "extensions" && parentFolder !== "extensions") {
        displayName = `${parentFolder}/${fileName}`;
      } else if (resourceType === "skills" && fileName === "SKILL.md") {
        displayName = parentFolder;
      } else {
        displayName = fileName;
      }
      subgroup.items.push({
        path,
        enabled,
        metadata,
        resourceType,
        displayName,
        groupKey,
        subgroupKey,
      });
    }
  };

  addToGroup(
    resolved.filter((r) => r.metadata.origin === "package"),
    "extensions",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "package"),
    "skills",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "package"),
    "prompts",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "package"),
    "themes",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "top-level"),
    "extensions",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "top-level"),
    "skills",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "top-level"),
    "prompts",
  );
  addToGroup(
    resolved.filter((r) => r.metadata.origin === "top-level"),
    "themes",
  );

  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => {
    if (a.origin !== b.origin) {
      return a.origin === "package" ? -1 : 1;
    }
    if (a.scope !== b.scope) {
      return a.scope === "user" ? -1 : 1;
    }
    return a.source.localeCompare(b.source);
  });

  const typeOrder: Record<ResourceType, number> = {
    extensions: 0,
    skills: 1,
    prompts: 2,
    themes: 3,
  };
  for (const group of groups) {
    group.subgroups.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
    for (const subgroup of group.subgroups) {
      subgroup.items.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
  }
  return groups;
}

interface Subgroup {
  type: ResourceType;
  label: string;
  items: GroupItem[];
}

interface Group {
  key: string;
  label: string;
  scope: "user" | "project";
  origin: "package" | "top-level";
  source: string;
  subgroups: Subgroup[];
}

interface GroupItem {
  path: string;
  enabled: boolean;
  metadata: ResolvedResourceMetadata;
  resourceType: ResourceType;
  displayName: string;
  groupKey: string;
  subgroupKey: string;
}

class ConfigSelectorHeader {
  writeScope: "global" | "project";
  projectModeAvailable: boolean;
  constructor(writeScope: "global" | "project", projectModeAvailable: boolean) {
    this.writeScope = writeScope;
    this.projectModeAvailable = projectModeAvailable;
  }
  setWriteScope(writeScope: "global" | "project"): void {
    this.writeScope = writeScope;
  }
  invalidate(): void {}
  render(width: number): string[] {
    const title = theme.bold(
      this.writeScope === "project" ? "Project Local Resources" : "Global Resources",
    );
    const sep = theme.fg("muted", " · ");
    const switchHint = this.projectModeAvailable
      ? keyHint("tui.input.tab", "switch mode") + sep
      : "";
    const actionHint =
      this.writeScope === "project"
        ? rawKeyHint("space", "cycle inherit/+/-")
        : rawKeyHint("space", "toggle");
    const hint = switchHint + actionHint + sep + rawKeyHint("esc", "close");
    const spacing = Math.max(1, width - visibleWidth(title) - visibleWidth(hint));
    const scopeHint =
      this.writeScope === "project"
        ? theme.fg("muted", `.lazydsh/settings.json · inherited global resources are dimmed`)
        : theme.fg("muted", `~/.config/lazydsh/agent/settings.json`);
    return [
      truncateToWidth(`${title}${" ".repeat(spacing)}${hint}`, width, ""),
      truncateToWidth(scopeHint, width, ""),
    ];
  }
}

class ResourceList {
  groupsByScope: { global: Group[]; project: Group[] };
  flatItems: FlatEntry[] = [];
  filteredItems: FlatEntry[] = [];
  selectedIndex = 0;
  searchInput: Input;
  maxVisible: number;
  settingsManager: SettingsManager;
  cwd: string;
  agentDir: string;
  writeScope: "global" | "project";
  inheritedEnabledByKey: Map<string, boolean>;
  onCancel?: () => void;
  onExit?: () => void;
  onToggle?: (item: GroupItem, enabled: boolean) => void;
  onSwitchMode?: () => void;
  _focused = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(
    groupsByScope: { global: Group[]; project: Group[] },
    settingsManager: SettingsManager,
    cwd: string,
    agentDir: string,
    terminalHeight: number,
    writeScope: "global" | "project" = "global",
  ) {
    this.groupsByScope = groupsByScope;
    this.settingsManager = settingsManager;
    this.cwd = cwd;
    this.agentDir = agentDir;
    this.writeScope = writeScope;
    this.inheritedEnabledByKey = this.buildInheritedEnabledMap(groupsByScope.global);
    this.searchInput = new Input();
    const chrome = 8;
    this.maxVisible = Math.max(5, (terminalHeight ?? 24) - chrome);
    this.buildFlatList();
    this.filteredItems = [...this.flatItems];
  }

  setWriteScope(writeScope: "global" | "project"): void {
    this.writeScope = writeScope;
    this.buildFlatList();
    this.filterItems(this.searchInput.getValue());
  }

  get groups(): Group[] {
    return this.groupsByScope[this.writeScope];
  }

  buildInheritedEnabledMap(groups: Group[]): Map<string, boolean> {
    const result = new Map<string, boolean>();
    for (const group of groups) {
      for (const subgroup of group.subgroups) {
        for (const item of subgroup.items) {
          result.set(this.getResourceItemKey(item), item.enabled);
        }
      }
    }
    return result;
  }

  buildFlatList(): void {
    this.flatItems = [];
    for (const group of this.groups) {
      this.flatItems.push({ type: "group", group });
      for (const subgroup of group.subgroups) {
        this.flatItems.push({ type: "subgroup", subgroup, group });
        for (const item of subgroup.items) {
          this.flatItems.push({ type: "item", item });
        }
      }
    }
    this.selectedIndex = this.flatItems.findIndex((e) => e.type === "item");
    if (this.selectedIndex < 0) this.selectedIndex = 0;
  }

  findNextItem(fromIndex: number, direction: number): number {
    let idx = fromIndex + direction;
    while (idx >= 0 && idx < this.filteredItems.length) {
      if (this.filteredItems[idx].type === "item") {
        return idx;
      }
      idx += direction;
    }
    return fromIndex;
  }

  filterItems(query: string): void {
    if (!query.trim()) {
      this.filteredItems = [...this.flatItems];
      this.selectFirstItem();
      return;
    }
    const lowerQuery = query.toLowerCase();
    const matchingItems = new Set<GroupItem>();
    const matchingSubgroups = new Set<Subgroup>();
    const matchingGroups = new Set<Group>();
    for (const entry of this.flatItems) {
      if (entry.type === "item") {
        const item = entry.item;
        if (
          item.displayName.toLowerCase().includes(lowerQuery) ||
          item.resourceType.toLowerCase().includes(lowerQuery) ||
          item.path.toLowerCase().includes(lowerQuery)
        ) {
          matchingItems.add(item);
        }
      }
    }
    for (const group of this.groups) {
      for (const subgroup of group.subgroups) {
        for (const item of subgroup.items) {
          if (matchingItems.has(item)) {
            matchingSubgroups.add(subgroup);
            matchingGroups.add(group);
          }
        }
      }
    }
    this.filteredItems = [];
    for (const entry of this.flatItems) {
      if (entry.type === "group" && matchingGroups.has(entry.group)) {
        this.filteredItems.push(entry);
      } else if (entry.type === "subgroup" && matchingSubgroups.has(entry.subgroup)) {
        this.filteredItems.push(entry);
      } else if (entry.type === "item" && matchingItems.has(entry.item)) {
        this.filteredItems.push(entry);
      }
    }
    this.selectFirstItem();
  }

  selectFirstItem(): void {
    const firstItemIndex = this.filteredItems.findIndex((e) => e.type === "item");
    this.selectedIndex = firstItemIndex >= 0 ? firstItemIndex : 0;
  }

  updateItem(item: GroupItem, enabled: boolean): void {
    item.enabled = enabled;
    for (const group of this.groups) {
      for (const subgroup of group.subgroups) {
        const found = subgroup.items.find(
          (i) => i.path === item.path && i.resourceType === item.resourceType,
        );
        if (found) {
          found.enabled = enabled;
          return;
        }
      }
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const lines: string[] = [];
    lines.push(...this.searchInput.render(width));
    lines.push("");
    if (this.filteredItems.length === 0) {
      lines.push(theme.fg("muted", "  No resources found"));
      return lines;
    }
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(this.maxVisible / 2),
        this.filteredItems.length - this.maxVisible,
      ),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);
    for (let i = startIndex; i < endIndex; i++) {
      const entry = this.filteredItems[i];
      const isSelected = i === this.selectedIndex;
      if (entry.type === "group") {
        const inherited = this.writeScope === "project" && entry.group.scope === "user";
        const label = theme.bold(`${entry.group.label}${inherited ? " · inherited global" : ""}`);
        const groupLine = theme.fg(inherited ? "dim" : "accent", label);
        lines.push(truncateToWidth(`  ${groupLine}`, width, ""));
      } else if (entry.type === "subgroup") {
        const color =
          this.writeScope === "project" && entry.group.scope === "user" ? "dim" : "muted";
        const subgroupLine = theme.fg(color, entry.subgroup.label);
        lines.push(truncateToWidth(`    ${subgroupLine}`, width, ""));
      } else {
        const item = entry.item;
        const cursor = isSelected ? "> " : "  ";
        const dimmed = this.isDimmedItem(item);
        const nameText = isSelected && !dimmed ? theme.bold(item.displayName) : item.displayName;
        const name = dimmed ? theme.fg("dim", nameText) : nameText;
        lines.push(
          truncateToWidth(
            `${cursor}    ${this.renderCheckbox(item)} ${name}${this.getItemSuffix(item)}`,
            width,
            "...",
          ),
        );
      }
    }
    if (startIndex > 0 || endIndex < this.filteredItems.length) {
      const itemCount = this.filteredItems.filter((e) => e.type === "item").length;
      const currentItemIndex =
        this.filteredItems.slice(0, this.selectedIndex).filter((e) => e.type === "item").length + 1;
      lines.push(theme.fg("dim", `  (${currentItemIndex}/${itemCount})`));
    }
    return lines;
  }

  handleInput(data: string): void {
    const kb = getKeybindings();
    if (kb.matches(data, "tui.select.up")) {
      this.selectedIndex = this.findNextItem(this.selectedIndex, -1);
      return;
    }
    if (kb.matches(data, "tui.select.down")) {
      this.selectedIndex = this.findNextItem(this.selectedIndex, 1);
      return;
    }
    if (kb.matches(data, "tui.select.pageUp")) {
      let target = Math.max(0, this.selectedIndex - this.maxVisible);
      while (target < this.filteredItems.length && this.filteredItems[target].type !== "item") {
        target++;
      }
      if (target < this.filteredItems.length) {
        this.selectedIndex = target;
      }
      return;
    }
    if (kb.matches(data, "tui.select.pageDown")) {
      let target = Math.min(this.filteredItems.length - 1, this.selectedIndex + this.maxVisible);
      while (target >= 0 && this.filteredItems[target].type !== "item") {
        target--;
      }
      if (target >= 0) {
        this.selectedIndex = target;
      }
      return;
    }
    if (kb.matches(data, "tui.select.cancel")) {
      this.onCancel?.();
      return;
    }
    if (matchesKey(data, "ctrl+c")) {
      this.onExit?.();
      return;
    }
    if (kb.matches(data, "tui.input.tab")) {
      this.onSwitchMode?.();
      return;
    }
    if (data === " " || kb.matches(data, "tui.select.confirm")) {
      const entry = this.filteredItems[this.selectedIndex];
      if (
        entry?.type === "item" &&
        (this.writeScope === "project" || this.getItemScope(entry.item) === "user")
      ) {
        const newEnabled = this.toggleResource(entry.item);
        if (newEnabled !== undefined) {
          this.updateItem(entry.item, newEnabled);
          this.onToggle?.(entry.item, newEnabled);
        }
      }
      return;
    }
    this.searchInput.handleInput(data);
    this.filterItems(this.searchInput.getValue());
  }

  toggleResource(item: GroupItem): boolean | undefined {
    if (this.writeScope === "project") {
      const state = this.getNextOverrideState(item);
      if (!this.setProjectResourceOverride(item, state)) return undefined;
      return state === "inherit" ? this.getInheritedEnabled(item) : state === "load";
    }
    const enabled = !item.enabled;
    if (item.metadata.origin === "top-level") {
      this.toggleTopLevelResource(item, enabled);
    } else {
      this.togglePackageResource(item, enabled);
    }
    return enabled;
  }

  toggleTopLevelResource(item: GroupItem, enabled: boolean): void {
    const scope = item.metadata.scope === "user" ? "global" : "project";
    const settings =
      scope === "project"
        ? this.settingsManager.getProjectSettings()
        : this.settingsManager.getGlobalSettings();
    const arrayKey = item.resourceType;
    const current = (settings[arrayKey] as string[]) ?? [];
    const pattern = this.getResourcePattern(item);
    const disablePattern = `-${pattern}`;
    const enablePattern = `+${pattern}`;
    const updated = current.filter((p) => {
      const stripped = p.startsWith("!") || p.startsWith("+") || p.startsWith("-") ? p.slice(1) : p;
      return stripped !== pattern;
    });
    if (enabled) {
      updated.push(enablePattern);
    } else {
      updated.push(disablePattern);
    }
    if (scope === "project") {
      if (arrayKey === "extensions") this.settingsManager.setProjectExtensionPaths(updated);
      else if (arrayKey === "skills") this.settingsManager.setProjectSkillPaths(updated);
      else if (arrayKey === "prompts") this.settingsManager.setProjectPromptTemplatePaths(updated);
      else if (arrayKey === "themes") this.settingsManager.setProjectThemePaths(updated);
    } else {
      if (arrayKey === "extensions") this.settingsManager.setExtensionPaths(updated);
      else if (arrayKey === "skills") this.settingsManager.setSkillPaths(updated);
      else if (arrayKey === "prompts") this.settingsManager.setPromptTemplatePaths(updated);
      else if (arrayKey === "themes") this.settingsManager.setThemePaths(updated);
    }
  }

  togglePackageResource(item: GroupItem, enabled: boolean): void {
    const scope = item.metadata.scope === "user" ? "global" : "project";
    const settings =
      scope === "project"
        ? this.settingsManager.getProjectSettings()
        : this.settingsManager.getGlobalSettings();
    const packages = [...((settings.packages as unknown[]) ?? [])];
    const pkgIndex = packages.findIndex((pkg) => {
      const source = typeof pkg === "string" ? pkg : (pkg as { source: string }).source;
      return source === item.metadata.source;
    });
    if (pkgIndex === -1) return;
    let pkg = packages[pkgIndex];
    if (typeof pkg === "string") {
      pkg = { source: pkg };
      packages[pkgIndex] = pkg;
    }
    const pkgObj = pkg as Record<string, unknown>;
    const arrayKey = item.resourceType;
    const current = (pkgObj[arrayKey] as string[]) ?? [];
    const pattern = this.getPackageResourcePattern(item);
    const disablePattern = `-${pattern}`;
    const enablePattern = `+${pattern}`;
    const updated = current.filter((p) => {
      const stripped = p.startsWith("!") || p.startsWith("+") || p.startsWith("-") ? p.slice(1) : p;
      return stripped !== pattern;
    });
    if (enabled) {
      updated.push(enablePattern);
    } else {
      updated.push(disablePattern);
    }
    pkgObj[arrayKey] = updated.length > 0 ? updated : undefined;
    const hasFilters = RESOURCE_TYPES.some((k) => pkgObj[k] !== undefined);
    if (!hasFilters) {
      if (pkgObj.autoload === false) packages.splice(pkgIndex, 1);
      else packages[pkgIndex] = pkgObj.source;
    }
    if (scope === "project") {
      this.settingsManager.setProjectPackages(packages);
    } else {
      this.settingsManager.setPackages(packages);
    }
  }

  renderCheckbox(item: GroupItem): string {
    if (this.writeScope === "project") {
      const state = this.getProjectOverrideState(item);
      if (state === "load") return theme.fg("success", "[+]");
      if (state === "unload") return theme.fg("warning", "[-]");
      return theme.fg("dim", item.enabled ? "[x]" : "[ ]");
    }
    return item.enabled ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
  }

  getItemSuffix(item: GroupItem): string {
    if (this.writeScope !== "project") return "";
    const state = this.getProjectOverrideState(item);
    if (state === "load") return theme.fg("muted", "  project load");
    if (state === "unload") return theme.fg("muted", "  project unload");
    return this.isInheritedGlobalItem(item) ? theme.fg("dim", "  inherited global") : "";
  }

  isDimmedItem(item: GroupItem): boolean {
    return (
      this.writeScope === "project" &&
      this.isInheritedGlobalItem(item) &&
      this.getProjectOverrideState(item) === "inherit"
    );
  }

  setProjectResourceOverride(item: GroupItem, state: "inherit" | "load" | "unload"): boolean {
    return item.metadata.origin === "top-level"
      ? this.setProjectTopLevelOverride(item, state)
      : this.setProjectPackageOverride(item, state);
  }

  setProjectTopLevelOverride(item: GroupItem, state: "inherit" | "load" | "unload"): boolean {
    const current =
      (this.settingsManager.getProjectSettings()[item.resourceType] as string[]) ?? [];
    const patterns = this.getTopLevelOverridePatterns(item, "project");
    const updated = current.filter((entry) => {
      const target = this.getPatternEntryTarget(entry);
      if (
        (entry.startsWith("!") || entry.startsWith("+") || entry.startsWith("-")) &&
        patterns.has(target)
      )
        return false;
      return !(
        state === "inherit" &&
        this.isInheritedGlobalItem(item) &&
        target === this.getResourcePatternForScope(item, "project")
      );
    });
    if (state !== "inherit") {
      if (
        this.isInheritedGlobalItem(item) &&
        item.metadata.source !== "builtin" &&
        !updated.includes(this.getResourcePatternForScope(item, "project"))
      )
        updated.push(this.getResourcePatternForScope(item, "project"));
      updated.push(
        `${state === "load" ? "+" : "-"}${this.getResourcePatternForScope(item, "project")}`,
      );
    }
    this.setProjectTopLevelPaths(item.resourceType, updated);
    return true;
  }

  setProjectTopLevelPaths(key: ResourceType, paths: string[]): void {
    if (key === "extensions") this.settingsManager.setProjectExtensionPaths(paths);
    else if (key === "skills") this.settingsManager.setProjectSkillPaths(paths);
    else if (key === "prompts") this.settingsManager.setProjectPromptTemplatePaths(paths);
    else this.settingsManager.setProjectThemePaths(paths);
  }

  setProjectPackageOverride(item: GroupItem, state: "inherit" | "load" | "unload"): boolean {
    const packages = [...((this.settingsManager.getProjectSettings().packages as unknown[]) ?? [])];
    let pkgIndex = packages.findIndex((pkg) =>
      this.packageSourceStringMatches(
        item.metadata.source,
        this.getItemScope(item),
        typeof pkg === "string" ? pkg : (pkg as { source: string }).source,
        "project",
      ),
    );
    if (pkgIndex === -1) {
      if (state === "inherit") return false;
      packages.push(this.createPackageOverrideSource(item));
      pkgIndex = packages.length - 1;
    }
    let pkg = packages[pkgIndex];
    if (pkg === undefined) return false;
    if (typeof pkg === "string") {
      pkg = { source: pkg };
      packages[pkgIndex] = pkg;
    }
    const pkgObj = pkg as Record<string, unknown>;
    const pattern = this.getPackageResourcePattern(item);
    const updated = ((pkgObj[item.resourceType] as string[]) ?? []).filter(
      (entry) => this.getPatternEntryTarget(entry) !== pattern,
    );
    if (state !== "inherit") updated.push(`${state === "load" ? "+" : "-"}${pattern}`);
    pkgObj[item.resourceType] = updated.length > 0 ? updated : undefined;
    if (!RESOURCE_TYPES.some((key) => pkgObj[key] !== undefined)) {
      if (pkgObj.autoload === false) packages.splice(pkgIndex, 1);
      else packages[pkgIndex] = pkgObj.source;
    }
    this.settingsManager.setProjectPackages(packages);
    return true;
  }

  getNextOverrideState(item: GroupItem): "inherit" | "load" | "unload" {
    const state = this.getProjectOverrideState(item);
    const inheritedEnabled = this.getInheritedEnabled(item);
    if (state === "inherit") return inheritedEnabled ? "unload" : "load";
    if (state === "unload") return inheritedEnabled ? "load" : "inherit";
    return inheritedEnabled ? "inherit" : "unload";
  }

  getProjectOverrideState(item: GroupItem): "inherit" | "load" | "unload" {
    if (this.writeScope !== "project") return "inherit";
    if (item.metadata.origin === "top-level") {
      return this.getOverrideStateFromEntries(
        (this.settingsManager.getProjectSettings()[item.resourceType] as string[]) ?? [],
        this.getTopLevelOverridePatterns(item, "project"),
        false,
      );
    }
    const pkg = this.findMatchingPackageSource(item, "project");
    if (typeof pkg !== "object" || pkg === null) return "inherit";
    const pkgObj = pkg as Record<string, unknown>;
    const entries = pkgObj[item.resourceType] as string[] | undefined;
    if (entries === undefined) return "inherit";
    return this.getOverrideStateFromEntries(
      entries,
      new Set([this.getPackageResourcePattern(item)]),
      pkgObj.autoload !== false,
    );
  }

  getOverrideStateFromEntries(
    entries: string[],
    patterns: Set<string>,
    emptyArrayIsUnload: boolean,
  ): "inherit" | "load" | "unload" {
    if (entries.length === 0 && emptyArrayIsUnload) return "unload";
    let state: "inherit" | "load" | "unload" = "inherit";
    for (const entry of entries) {
      if (!patterns.has(this.getPatternEntryTarget(entry))) continue;
      if (entry.startsWith("!") || entry.startsWith("-")) state = "unload";
      else state = "load";
    }
    return state;
  }

  getInheritedEnabled(item: GroupItem): boolean {
    return (
      this.inheritedEnabledByKey.get(this.getResourceItemKey(item)) ??
      (this.getItemScope(item) === "user" ? item.enabled : true)
    );
  }

  isInheritedGlobalItem(item: GroupItem): boolean {
    return (
      this.getItemScope(item) === "user" ||
      this.inheritedEnabledByKey.has(this.getResourceItemKey(item))
    );
  }

  getTopLevelOverridePatterns(item: GroupItem, scope: "global" | "project"): Set<string> {
    const baseDir = this.getTopLevelBaseDir(scope);
    const patterns = new Set<string>([
      this.getResourcePatternForScope(item, scope),
      item.path,
      relative(baseDir, item.path),
    ]);
    if (item.metadata.baseDir) patterns.add(relative(item.metadata.baseDir, item.path));
    return patterns;
  }

  getResourcePatternForScope(item: GroupItem, scope: "global" | "project"): string {
    const sourceScope = this.getItemScope(item);
    if (scope !== sourceScope || item.metadata.source === "builtin") return item.path;
    const baseDir = item.metadata.baseDir ?? this.getTopLevelBaseDir(sourceScope);
    return relative(baseDir, item.path);
  }

  createPackageOverrideSource(item: GroupItem): { source: string; autoload: boolean } {
    const source = item.metadata.source;
    const scope = this.getItemScope(item) === "user" ? "global" : "project";
    const sourcePath = this.resolvePath(source, this.getTopLevelBaseDir(scope), {
      trim: true,
    });
    return {
      source: relative(this.getTopLevelBaseDir("project"), sourcePath) || ".",
      autoload: false,
    };
  }

  packageSourceStringMatches(
    leftSource: string,
    leftScope: "user" | "project",
    rightSource: string,
    rightScope: "user" | "project",
  ): boolean {
    if (leftSource === rightSource) return true;
    if (!this.isLocalPath(leftSource) || !this.isLocalPath(rightSource)) return false;
    const leftBase = leftScope === "user" ? "global" : "project";
    const rightBase = rightScope === "user" ? "global" : "project";
    const left = this.resolvePath(leftSource, this.getTopLevelBaseDir(leftBase), { trim: true });
    const right = this.resolvePath(rightSource, this.getTopLevelBaseDir(rightBase), {
      trim: true,
    });
    return left === right;
  }

  findMatchingPackageSource(item: GroupItem, targetScope: "global" | "project"): unknown {
    const settings =
      targetScope === "project"
        ? this.settingsManager.getProjectSettings()
        : this.settingsManager.getGlobalSettings();
    const scope = targetScope === "global" ? "user" : "project";
    return ((settings.packages as unknown[]) ?? []).find((pkg) =>
      this.packageSourceStringMatches(
        item.metadata.source,
        this.getItemScope(item),
        typeof pkg === "string" ? pkg : (pkg as { source: string }).source,
        scope,
      ),
    );
  }

  getPatternEntryTarget(entry: string): string {
    return entry.startsWith("!") || entry.startsWith("+") || entry.startsWith("-")
      ? entry.slice(1)
      : entry;
  }

  getResourceItemKey(item: GroupItem): string {
    return `${item.resourceType}:${item.path}`;
  }

  getItemScope(item: GroupItem): "user" | "project" {
    return item.metadata.scope === "project" ? "project" : "user";
  }

  getTopLevelBaseDir(scope: "global" | "project"): string {
    return scope === "project" ? this.cwd : this.agentDir;
  }

  isLocalPath(path: string): boolean {
    return !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path);
  }

  resolvePath(path: string, baseDir: string, _options: { trim: boolean }): string {
    if (this.isLocalPath(path)) {
      return `${baseDir}/${path}`;
    }
    return path;
  }

  getResourcePattern(item: GroupItem): string {
    if (item.metadata.source === "builtin") return item.path;
    const scope = item.metadata.scope === "user" ? "global" : "project";
    const baseDir = item.metadata.baseDir ?? this.getTopLevelBaseDir(scope);
    return relative(baseDir, item.path);
  }

  getPackageResourcePattern(item: GroupItem): string {
    const baseDir = item.metadata.baseDir ?? dirname(item.path);
    return relative(baseDir, item.path);
  }
}

type FlatEntry =
  | { type: "group"; group: Group }
  | { type: "subgroup"; subgroup: Subgroup; group: Group }
  | { type: "item"; item: GroupItem };

export class ConfigSelectorComponent extends Container {
  header: ConfigSelectorHeader;
  resourceList: ResourceList;
  writeScope: "global" | "project";
  _focused = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.resourceList.focused = value;
  }

  constructor(
    resolvedPaths: ResolvedPaths,
    settingsManager: SettingsManager,
    cwd: string,
    agentDir: string,
    callbacks: ConfigSelectorCallbacks,
    terminalHeight: number,
    writeScope: "global" | "project" = "global",
    projectModeAvailable = true,
  ) {
    super();
    this.writeScope = writeScope;
    const groupsByScope = {
      global: buildGroups(resolvedPaths.global, agentDir),
      project: buildGroups(resolvedPaths.project, agentDir),
    };
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    this.header = new ConfigSelectorHeader(this.writeScope, projectModeAvailable);
    this.addChild(this.header);
    this.addChild(new Spacer(1));
    this.resourceList = new ResourceList(
      groupsByScope,
      settingsManager,
      cwd,
      agentDir,
      terminalHeight,
      this.writeScope,
    );
    this.resourceList.onCancel = callbacks.onClose;
    this.resourceList.onExit = callbacks.onExit;
    this.resourceList.onToggle = () => callbacks.requestRender();
    if (projectModeAvailable) {
      this.resourceList.onSwitchMode = () => {
        this.switchWriteScope();
        callbacks.requestRender();
      };
    }
    this.addChild(this.resourceList);
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
  }

  switchWriteScope(): void {
    this.writeScope = this.writeScope === "global" ? "project" : "global";
    this.header.setWriteScope(this.writeScope);
    this.resourceList.setWriteScope(this.writeScope);
  }

  getResourceList(): ResourceList {
    return this.resourceList;
  }
}
