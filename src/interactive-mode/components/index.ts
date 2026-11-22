/**
 * Components
 *
 * The UI layer, ported from pi-coding-agent's `modes/interactive/components`.
 * Tool rows are rendered by the single `detail.ts` engine — tools declare
 * render intent, this layer owns the pixels.
 */

export { DynamicBorder } from "./dynamic-border.ts";
export { BorderedLoader } from "./bordered-loader.ts";
export { truncateToVisualLines, displayWidth, lineCount } from "./visual-truncate.ts";
export { ModelSelectorComponent } from "../model-selector.ts";
export {
  SessionSelector,
  SessionSelectorHeader,
  formatAge,
  shortenHome,
} from "../session-selector.ts";
export type {
  SessionRecord,
  SessionScope,
  SessionSortMode,
  SessionNameFilter,
} from "./session-selector-search.ts";
export {
  filterAndSortSessions,
  buildSessionTree,
  flattenSessionTree,
  getSessionPathKey,
  hasSessionName,
  parseSearchQuery,
} from "./session-selector-search.ts";
export { BashExecutionComponent } from "../bash-execution.ts";
export { AssistantMessageComponent } from "./assistant-message.ts";
export { UserMessageComponent } from "./user-message.ts";
export { CompactionSummaryMessageComponent } from "./compaction-summary-message.ts";
export { BranchSummaryMessageComponent } from "./branch-summary-message.ts";
export { CustomMessageComponent } from "./custom-message.ts";
export { FooterComponent } from "../footer.ts";
export {
  WorkingStatusIndicator,
  RetryStatusIndicator,
  CompactionStatusIndicator,
  IdleStatus,
  type StatusIndicator,
} from "./status-indicator.ts";
export { StatusIndicatorContainer } from "./status-container.ts";
export { HeaderComponent, type HeaderOptions } from "./header.ts";
export { LoginDialog, type LoginPrompt, type LoginPromptKind } from "./login-dialog.ts";
export { AuthUrlComponent } from "./auth-url.ts";
export { OAuthSelectorComponent, type ProviderOption } from "./oauth-selector.ts";
export { getProviderBrandStyle, startBrandAnimation } from "./provider-brand.ts";
export { KeybindingsManager, APP_KEYBINDINGS, KEYBINDINGS } from "../keybindings.ts";
export { SelectSubmenu, SteppedSubmenu } from "./settings-submenu.ts";
export { UserMessageSelectorComponent } from "./user-message-selector.ts";
export { ShowImagesSelectorComponent } from "./show-images-selector.ts";
export { ExtensionSelectorComponent } from "./extension-selector.ts";
export { ExtensionInputComponent } from "./extension-input.ts";
export { ExtensionEditorComponent } from "./extension-editor.ts";
export { CustomEntryComponent } from "./custom-entry.ts";
export { TrustSelectorComponent } from "./trust-selector.ts";
export { FirstTimeSetupComponent } from "./first-time-setup.ts";
export { ThemeController } from "../theme/theme-controller.ts";
export { getMarkdownTheme, getSelectListTheme, getEditorTheme } from "../theme/theme.ts";
