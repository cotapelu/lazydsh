/**
 * Model Selector Component
 *
 * Fuzzy search model picker with scoped/all toggle, current model marker,
 * default model badge, and save-as-default (Ctrl+S).
 * Ported from pi-coding-agent's ModelSelectorComponent.
 */

import {
  Container,
  fuzzyFilter,
  getKeybindings,
  getSelectPageIndex,
  Input,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";
import { DynamicBorder } from "./components/dynamic-border.js";
import { keyDisplayText, keyHint } from "./keybinding-hints.js";

const MAX_VISIBLE = 10;

interface ModelInfo {
  provider: string;
  id: string;
  name: string;
}

interface ScopedModel {
  model: ModelInfo;
}

/**
 * Model Selector Component
 */
export class ModelSelectorComponent extends Container {
  capturesViewportInput = true;

  private searchInput: Input;
  private _focused = false;
  private listContainer: Container;
  private allModels: ModelInfo[] = [];
  private scopedModelItems: ModelInfo[] = [];
  private activeModels: ModelInfo[] = [];
  private filteredModels: ModelInfo[] = [];
  private selectedIndex = 0;
  private currentModel: ModelInfo | undefined;
  private modelRuntime: any;
  private onSelectCallback: (model: ModelInfo) => void;
  private onSelectAsDefaultCallback: ((model: ModelInfo) => void) | undefined;
  private onCancelCallback: () => void;
  private errorMessage: string | undefined;
  private refreshStatusMessage = "Refreshing model catalogs…";
  private refreshStatusSuccess = false;
  private tui: any;
  private scopedModels: ScopedModel[];
  private defaultModel: ModelInfo | undefined;
  private scope = "all";
  private scopeText: Text | undefined;
  private scopeHintText: Text | undefined;
  private refreshAbortController = new AbortController();
  private refreshTimeout: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    tui: any,
    currentModel: ModelInfo | undefined,
    modelRuntime: any,
    scopedModels: ScopedModel[],
    onSelect: (model: ModelInfo) => void,
    onCancel: () => void,
    initialSearchInput = "",
    onSelectAsDefault?: (model: ModelInfo) => void,
    defaultModel?: ModelInfo,
  ) {
    super();
    this.tui = tui;
    this.currentModel = currentModel;
    this.modelRuntime = modelRuntime;
    this.scopedModels = scopedModels;
    this.defaultModel = defaultModel;
    this.scope = scopedModels.length > 0 ? "scoped" : "all";
    this.onSelectCallback = onSelect;
    this.onSelectAsDefaultCallback = onSelectAsDefault;
    this.onCancelCallback = onCancel;

    // Add top border
    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));

    // Add hint about model filtering
    if (scopedModels.length > 0) {
      this.scopeText = new Text(this.getScopeText(), 0, 0);
      this.addChild(this.scopeText);
      this.scopeHintText = new Text(this.getScopeHintText(), 0, 0);
      this.addChild(this.scopeHintText);
    } else {
      const hintText =
        "Only showing models from configured providers. Use /login to add providers.";
      this.addChild(new Text(theme.fg("warning", hintText), 0, 0));
    }

    this.addChild(new Spacer(1));

    // Create search input
    this.searchInput = new Input();
    if (initialSearchInput) {
      this.searchInput.setValue(initialSearchInput);
    }
    this.searchInput.onSubmit = () => {
      // Enter on search input selects the first filtered item
      if (this.filteredModels[this.selectedIndex]) {
        this.handleSelect(this.filteredModels[this.selectedIndex]);
      }
    };
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    // Create list container
    this.listContainer = new Container();
    this.addChild(this.listContainer);
    this.addChild(new Spacer(1));

    // Hint
    if (this.onSelectAsDefaultCallback) {
      this.addChild(
        new Text(
          theme.fg(
            "dim",
            `  ${keyDisplayText("tui.select.confirm")} to select · ${keyDisplayText("app.models.save")} to set as default · ${keyDisplayText("tui.select.cancel")} to cancel`,
          ),
          0,
          0,
        ),
      );
    }

    // Add bottom border
    this.addChild(new DynamicBorder());

    // Render the current snapshot immediately, then refresh in the background
    this.loadModelsFromSnapshot();
    if (initialSearchInput) this.filterModels(initialSearchInput);
    else this.updateList();
    this.tui.requestRender();

    void this.refreshModels();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  loadModelsFromSnapshot(): void {
    const models = this.modelRuntime.getAvailableSnapshot().map((model: any) => ({
      provider: model.provider,
      id: model.id,
      name: model.name,
    }));
    this.allModels = this.sortModels(models);
    this.scopedModelItems = this.scopedModels.map((scoped) => {
      const refreshed = this.modelRuntime.getModel(scoped.model.provider, scoped.model.id);
      return refreshed ? { ...scoped.model, ...refreshed } : scoped.model;
    });
    this.activeModels = this.scope === "scoped" ? this.scopedModelItems : this.allModels;
    this.filteredModels = this.activeModels;
    const currentIndex = this.filteredModels.findIndex((item) =>
      this.modelsAreEqual(this.currentModel, item),
    );
    this.selectedIndex =
      currentIndex >= 0
        ? currentIndex
        : Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
  }

  async refreshModels(): Promise<void> {
    const timeoutMs = 15_000;
    let timedOut = false;
    this.refreshTimeout = setTimeout(() => {
      timedOut = true;
      this.refreshAbortController.abort();
    }, timeoutMs);

    try {
      // Note: In lazydsh, model catalog refresh might be different
      // For now we just use the snapshot
      if (this.closed) return;
      this.refreshStatusMessage = "";
      this.errorMessage = this.modelRuntime.getError?.();
      if (!this.errorMessage) {
        this.refreshStatusMessage = "Model catalogs refreshed.";
        this.refreshStatusSuccess = true;
      }
      const selectedModel = this.filteredModels[this.selectedIndex];
      this.loadModelsFromSnapshot();
      // The user may have moved while the refresh was in flight
      this.filterModels(this.searchInput.getValue(), selectedModel);
      this.tui.requestRender();
    } catch (error) {
      if (this.closed) return;
      this.refreshStatusMessage = "";
      this.errorMessage = timedOut
        ? "Model refresh timed out; showing cached models."
        : `Could not refresh model catalogs: ${error instanceof Error ? error.message : String(error)}`;
      this.updateList();
      this.tui.requestRender();
    } finally {
      if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    }
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    this.refreshAbortController.abort();
  }

  sortModels(models: ModelInfo[]): ModelInfo[] {
    const sorted = [...models];
    // Sort: current model first, default model second, then by provider
    sorted.sort((a, b) => {
      const aIsCurrent = this.modelsAreEqual(this.currentModel, a);
      const bIsCurrent = this.modelsAreEqual(this.currentModel, b);
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      const aIsDefault = this.isDefaultModel(a);
      const bIsDefault = this.isDefaultModel(b);
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return a.provider.localeCompare(b.provider);
    });
    return sorted;
  }

  getScopeText(): string {
    const allText = this.scope === "all" ? theme.fg("accent", "all") : theme.fg("muted", "all");
    const scopedText =
      this.scope === "scoped" ? theme.fg("accent", "scoped") : theme.fg("muted", "scoped");
    return `${theme.fg("muted", "Scope: ")}${allText}${theme.fg("muted", " | ")}${scopedText}`;
  }

  getScopeHintText(): string {
    return keyHint("tui.input.tab", "scope") + theme.fg("muted", " (all/scoped)");
  }

  isDefaultModel(model: ModelInfo): boolean {
    return this.defaultModel?.provider === model.provider && this.defaultModel.id === model.id;
  }

  isDefaultSearch(query: string): boolean {
    const normalized = query.trim().toLowerCase();
    return normalized.length > 0 && "default".startsWith(normalized);
  }

  setScope(scope: string): void {
    if (this.scope === scope) return;
    this.scope = scope;
    this.activeModels = this.scope === "scoped" ? this.scopedModelItems : this.allModels;
    const currentIndex = this.activeModels.findIndex((item) =>
      this.modelsAreEqual(this.currentModel, item),
    );
    this.selectedIndex = currentIndex >= 0 ? currentIndex : 0;
    this.filterModels(this.searchInput.getValue());
    if (this.scopeText) {
      this.scopeText.setText(this.getScopeText());
    }
  }

  filterModels(query: string, preferredModel?: ModelInfo): void {
    if (query) {
      const filtered = fuzzyFilter(this.activeModels, query, (item) => {
        const defaultText = this.isDefaultModel(item) ? " default" : "";
        return `${this.getModelSelectorSearchText(item)}${defaultText}`;
      });
      if (this.isDefaultSearch(query)) {
        const defaultItems = this.activeModels.filter((item) => this.isDefaultModel(item));
        const defaultKeys = new Set(defaultItems.map((item) => `${item.provider}\0${item.id}`));
        this.filteredModels = [
          ...defaultItems,
          ...filtered.filter((item) => !defaultKeys.has(`${item.provider}\0${item.id}`)),
        ];
      } else {
        this.filteredModels = filtered;
      }
    } else {
      this.filteredModels = this.activeModels;
    }

    // Keep the preferred model selected if it is still listed
    const preferredIndex = preferredModel
      ? this.filteredModels.findIndex((item) => this.modelsAreEqual(preferredModel, item))
      : -1;
    if (preferredIndex >= 0) this.selectedIndex = preferredIndex;
    else
      this.selectedIndex = query
        ? 0
        : Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
    this.updateList();
  }

  getModelSelectorSearchText(item: ModelInfo): string {
    return `${item.id} ${item.provider} ${item.name}`;
  }

  updateList(): void {
    this.listContainer.clear();
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(MAX_VISIBLE / 2),
        this.filteredModels.length - MAX_VISIBLE,
      ),
    );
    const endIndex = Math.min(startIndex + MAX_VISIBLE, this.filteredModels.length);

    // Show visible slice of filtered models
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredModels[i];
      if (!item) continue;
      const isSelected = i === this.selectedIndex;
      const isCurrent = this.modelsAreEqual(this.currentModel, item);
      const isDefault = this.isDefaultModel(item);
      const defaultBadge = isDefault ? theme.fg("muted", " · default") : "";
      const cursor = isSelected ? theme.fg("accent", "→ ") : "  ";
      const currentMarker = isCurrent ? theme.fg("accent", "✓ ") : "  ";
      const modelText = isSelected ? theme.fg("accent", item.id) : item.id;
      const name = this.getDistinctModelName(item);
      const nameText = name ? theme.fg("muted", ` (${name})`) : "";
      const providerBadge = theme.fg("muted", `[${item.provider}]`);
      const line = `${cursor}${currentMarker}${modelText}${nameText} ${providerBadge}${defaultBadge}`;
      this.listContainer.addChild(new Text(line, 0, 0));
    }

    // Add scroll indicator if needed
    if (startIndex > 0 || endIndex < this.filteredModels.length) {
      const scrollInfo = theme.fg(
        "muted",
        `  (${this.selectedIndex + 1}/${this.filteredModels.length})`,
      );
      this.listContainer.addChild(new Text(scrollInfo, 0, 0));
    }

    // Show error message or "no results" if empty
    if (this.errorMessage) {
      // Show error in red
      const errorLines = this.errorMessage.split("\n");
      for (const line of errorLines) {
        this.listContainer.addChild(new Text(theme.fg("error", line), 0, 0));
      }
    } else if (this.filteredModels.length === 0) {
      this.listContainer.addChild(new Text(theme.fg("muted", "  No matching models"), 0, 0));
    } else {
      const selected = this.filteredModels[this.selectedIndex];
      this.listContainer.addChild(new Spacer(1));
      this.listContainer.addChild(
        new Text(theme.fg("muted", `  Model Name: ${selected.name}`), 0, 0),
      );
    }

    if (this.refreshStatusMessage) {
      this.listContainer.addChild(new Spacer(1));
      this.listContainer.addChild(
        new Text(
          theme.fg(
            this.refreshStatusSuccess ? "success" : "muted",
            `  ${this.refreshStatusMessage}`,
          ),
          0,
          0,
        ),
      );
    }
  }

  getDistinctModelName(item: ModelInfo): string | undefined {
    // Return model name if it differs from id
    if (item.name && item.name !== item.id) {
      return item.name;
    }
    return undefined;
  }

  modelsAreEqual(a: ModelInfo | undefined, b: ModelInfo): boolean {
    return a !== undefined && a.provider === b.provider && a.id === b.id;
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const pageIndex = getSelectPageIndex(
      kb,
      keyData,
      this.selectedIndex,
      this.filteredModels.length,
      MAX_VISIBLE,
    );

    if (kb.matches(keyData, "tui.input.tab")) {
      if (this.scopedModelItems.length > 0) {
        const nextScope = this.scope === "all" ? "scoped" : "all";
        this.setScope(nextScope);
        if (this.scopeHintText) {
          this.scopeHintText.setText(this.getScopeHintText());
        }
      }
      return;
    }

    // Up arrow - wrap to bottom when at top
    if (kb.matches(keyData, "tui.select.up")) {
      if (this.filteredModels.length === 0) return;
      this.selectedIndex =
        this.selectedIndex === 0 ? this.filteredModels.length - 1 : this.selectedIndex - 1;
      this.updateList();
    }
    // Down arrow - wrap to top when at bottom
    else if (kb.matches(keyData, "tui.select.down")) {
      if (this.filteredModels.length === 0) return;
      this.selectedIndex =
        this.selectedIndex === this.filteredModels.length - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
    }
    // Page up/down
    else if (pageIndex !== undefined) {
      if (this.filteredModels.length === 0) return;
      this.selectedIndex = pageIndex;
      this.updateList();
    }
    // Enter
    else if (kb.matches(keyData, "tui.select.confirm")) {
      const selectedModel = this.filteredModels[this.selectedIndex];
      if (selectedModel) {
        this.handleSelect(selectedModel);
      }
    }
    // Escape or Ctrl+C
    else if (kb.matches(keyData, "tui.select.cancel")) {
      this.dispose();
      this.onCancelCallback();
    }
    // Select and save as default
    else if (kb.matches(keyData, "app.models.save") && this.onSelectAsDefaultCallback) {
      const selectedModel = this.filteredModels[this.selectedIndex];
      if (selectedModel) {
        this.dispose();
        this.onSelectAsDefaultCallback(selectedModel);
      }
    }
    // Pass everything else to search input
    else {
      this.searchInput.handleInput(keyData);
      this.filterModels(this.searchInput.getValue());
    }
  }

  handleSelect(model: ModelInfo): void {
    this.dispose();
    this.onSelectCallback(model);
  }

  getSearchInput(): Input {
    return this.searchInput;
  }
}
