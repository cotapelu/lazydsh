/**
 * OAuth Selector Component
 *
 * Provider selector with auth type selection and status display.
 * Ported from pi-coding-agent's OAuthSelectorComponent.
 */

import {
  Container,
  fuzzyFilter,
  getKeybindings,
  getSelectPageIndex,
  Input,
  Spacer,
  TruncatedText,
} from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";
import { getProviderBrandStyle, startBrandAnimation } from "./provider-brand.ts";

const MAX_VISIBLE = 8;

export interface ProviderOption {
  id: string;
  name: string;
  authType: "oauth" | "api_key";
  status?: {
    type: "oauth" | "api_key";
    source: string;
  };
  subscription?: boolean;
  method?: {
    login?: (options: any) => Promise<any>;
    loginLabel?: string;
  };
}

export function formatAuthSelectorProviderType(
  authType: "oauth" | "api_key",
  subscription: boolean | undefined,
): string {
  if (authType === "api_key") return "API key";
  return subscription === false ? "account" : "subscription";
}

export function formatAuthSelectorProviderStatus(provider: ProviderOption): string {
  if (!provider.status) return theme.fg("muted", " • not configured");
  if (provider.status.type !== provider.authType) {
    const label = `${formatAuthSelectorProviderType(provider.status.type, provider.subscription)} configured`;
    return theme.fg("muted", " • ") + theme.fg("warning", label);
  }
  if (
    !provider.status.source ||
    provider.status.source === "OAuth" ||
    provider.status.source === "stored credential"
  ) {
    return theme.fg("success", " ✓ configured");
  }
  const source = /^[A-Z][A-Z0-9_]*(?:, [A-Z][A-Z0-9_]*)*$/.test(provider.status.source)
    ? `env: ${provider.status.source}`
    : provider.status.source;
  return theme.fg("success", ` ✓ ${source}`);
}

export class OAuthSelectorComponent extends Container {
  capturesViewportInput = true;

  searchInput: Input;
  listContainer: Container;
  allProviders: ProviderOption[];
  filteredProviders: ProviderOption[];
  selectedIndex = 0;
  mode: "login" | "logout";
  onSelectCallback: (providerId: string, authType: "oauth" | "api_key") => void;
  onCancelCallback: () => void;
  showAuthTypeLabels: boolean;
  animationStart = performance.now();
  stopAnimation: (() => void) | undefined;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(
    mode: "login" | "logout",
    providers: ProviderOption[],
    onSelect: (providerId: string, authType: "oauth" | "api_key") => void,
    onCancel: () => void,
    initialSearchInput = "",
    tui?: {
      requestRender: () => void;
      setTerminalColorSchemeNotifications: (enabled: boolean) => void;
    },
  ) {
    super();
    this.mode = mode;
    this.allProviders = providers;
    this.filteredProviders = providers;
    this.showAuthTypeLabels = new Set(providers.map((p) => p.authType)).size > 1;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;

    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));

    const title = mode === "login" ? "Select provider to configure:" : "Select provider to logout:";
    this.addChild(new TruncatedText(theme.fg("accent", theme.bold(title)), 1, 0));
    this.addChild(new Spacer(1));

    this.searchInput = new Input();
    if (initialSearchInput) this.searchInput.setValue(initialSearchInput);
    this.searchInput.onSubmit = () => {
      const selectedProvider = this.filteredProviders[this.selectedIndex];
      if (selectedProvider) this.onSelectCallback(selectedProvider.id, selectedProvider.authType);
    };
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    this.listContainer = new Container();
    this.addChild(this.listContainer);
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());

    this.filterProviders(initialSearchInput ?? "");
    if (tui)
      this.stopAnimation = startBrandAnimation(
        tui,
        () => this.getSelectedBrandStyle() !== undefined,
      );
  }

  render(width: number): string[] {
    if (this.stopAnimation && this.getSelectedBrandStyle()) this.updateList();
    return super.render(width);
  }

  dispose(): void {
    this.stopAnimation?.();
    this.stopAnimation = undefined;
  }

  getSelectedBrandStyle(): ((text: string, elapsedMs: number) => string) | undefined {
    const selectedProvider = this.filteredProviders[this.selectedIndex];
    return selectedProvider && getProviderBrandStyle(selectedProvider.id);
  }

  filterProviders(query: string): void {
    this.filteredProviders = query
      ? fuzzyFilter(
          this.allProviders,
          query,
          (provider) =>
            `${provider.name} ${provider.id} ${provider.authType} ${provider.method?.loginLabel ?? ""}`,
        )
      : this.allProviders;
    this.selectedIndex = Math.max(
      0,
      Math.min(this.selectedIndex, Math.max(0, this.filteredProviders.length - 1)),
    );
    this.updateList();
  }

  updateList(): void {
    this.listContainer.clear();
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(MAX_VISIBLE / 2),
        this.filteredProviders.length - MAX_VISIBLE,
      ),
    );
    const endIndex = Math.min(startIndex + MAX_VISIBLE, this.filteredProviders.length);

    for (let i = startIndex; i < endIndex; i++) {
      const provider = this.filteredProviders[i];
      if (!provider) continue;
      const isSelected = i === this.selectedIndex;
      const statusIndicator = formatAuthSelectorProviderStatus({ ...provider } as ProviderOption);
      const partnerMarker = isSelected ? theme.fg("muted", " ✦") : "";
      const authTypeLabel = this.showAuthTypeLabels
        ? theme.fg(
            "muted",
            ` [${formatAuthSelectorProviderType(provider.authType, provider.subscription)}]`,
          )
        : "";

      let line = "";
      if (isSelected) {
        const prefix = theme.fg("accent", "→ ");
        const brandStyle = this.stopAnimation && this.getSelectedBrandStyle();
        const text = brandStyle
          ? brandStyle(provider.name, performance.now() - this.animationStart)
          : theme.fg("accent", provider.name);
        line = prefix + text + partnerMarker + authTypeLabel + statusIndicator;
      } else {
        const text = `  ${theme.fg("text", provider.name)}`;
        line = text + partnerMarker + authTypeLabel + statusIndicator;
      }
      this.listContainer.addChild(new TruncatedText(line, 1, 0));
    }

    if (startIndex > 0 || endIndex < this.filteredProviders.length) {
      const scrollInfo = theme.fg(
        "muted",
        `  (${this.selectedIndex + 1}/${this.filteredProviders.length})`,
      );
      this.listContainer.addChild(new TruncatedText(scrollInfo, 1, 0));
    }

    if (this.filteredProviders.length === 0) {
      const message =
        this.allProviders.length === 0
          ? this.mode === "login"
            ? "No providers available"
            : this.mode === "logout"
              ? "No providers logged in. Use /login first."
              : "No matching providers"
          : "No matching providers";
      this.listContainer.addChild(new TruncatedText(theme.fg("muted", `  ${message}`), 1, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const pageIndex = getSelectPageIndex(
      kb,
      keyData,
      this.selectedIndex,
      this.filteredProviders.length,
      MAX_VISIBLE,
    );

    if (kb.matches(keyData, "tui.select.up")) {
      if (this.filteredProviders.length === 0) return;
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.down")) {
      if (this.filteredProviders.length === 0) return;
      this.selectedIndex = Math.min(this.filteredProviders.length - 1, this.selectedIndex + 1);
      this.updateList();
    } else if (pageIndex !== undefined) {
      if (this.filteredProviders.length === 0) return;
      this.selectedIndex = pageIndex;
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.confirm")) {
      const selectedProvider = this.filteredProviders[this.selectedIndex];
      if (selectedProvider) this.onSelectCallback(selectedProvider.id, selectedProvider.authType);
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    } else {
      this.searchInput.handleInput(keyData);
      this.filterProviders(this.searchInput.getValue());
    }
  }
}
