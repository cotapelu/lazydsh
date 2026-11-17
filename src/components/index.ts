/**
 * Components
 *
 * The UI layer, ported from pi-coding-agent's `modes/interactive/components`.
 * Tool cards bridge DSH's render intents (`tool-presentation.ts`) to these.
 */

export { DynamicBorder } from "./dynamic-border.js";
export { truncateToVisualLines, displayWidth, lineCount } from "./visual-truncate.js";
export { ModelSelectorComponent } from "../model-selector.js";
export {
  SessionSelector,
  SessionSelectorHeader,
  formatAge,
  shortenHome,
} from "../session-selector.js";
export type {
  SessionRecord,
  SessionScope,
  SessionSortMode,
  SessionNameFilter,
} from "../session-selector.js";
export {
  filterAndSortSessions,
  buildSessionTree,
  flattenSessionTree,
  getSessionPathKey,
  hasSessionName,
  parseSearchQuery,
} from "../session-selector-search.js";
export { BashExecutionComponent, BorderedBashExecution } from "../bash-execution.js";
export { ToolExecutionComponent, type ToolExecutionOptions } from "../tool-execution.js";
export {
  genericCallFallback,
  presentCall,
  presentResult,
  resolveImages,
  textCard,
  type ImageResolver,
  type ResolvedImage,
} from "../tool-presentation.js";
export { AssistantMessageComponent } from "./assistant-message.js";
export { UserMessageComponent } from "./user-message.js";
export { FooterComponent } from "../footer.js";
export {
  WorkingStatusIndicator,
  RetryStatusIndicator,
  CompactionStatusIndicator,
  IdleStatus,
  createStatusIndicator,
  type StatusIndicator,
} from "./status-indicator.js";
export { StatusIndicatorContainer } from "./status-container.js";
export { HeaderComponent, type HeaderOptions } from "./header.js";
export { LoginDialog, type LoginPrompt, type LoginPromptKind } from "./login-dialog.js";
export { KeybindingsManager, APP_KEYBINDINGS, KEYBINDINGS } from "../keybindings.js";
export { ThemeController } from "../theme/theme-controller.ts";
export { getMarkdownTheme, getSelectListTheme, getEditorTheme } from "../theme/theme.ts";
