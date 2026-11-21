/**
 * Custom Editor
 *
 * Custom editor that handles app-level keybindings for the coding agent. When
 * `embedWorkingStatus` is enabled, the editor's top border renders the active
 * status indicator inline (and shows an overflow label for hidden lines).
 * Registers per-action handlers so global keybindings (interrupt, exit, paste,
 * model cycling, etc.) run before the editor's own text handling.
 * Ported from pi-coding-agent's `custom-editor.js`.
 */

import { Editor, visibleWidth, type EditorTheme, type EditorOptions } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";
import type { StatusIndicator } from "./status-indicator.ts";

export interface CustomEditorOptions extends EditorOptions {
  embedWorkingStatus?: boolean;
}

type Action = string;

/**
 * Custom editor that handles app-level keybindings.
 */
export class CustomEditor extends Editor {
  private keybindings: { matches: (data: string, action: Action) => boolean };
  private workingStatusIndicator: StatusIndicator | undefined;
  private embedWorkingStatus: boolean;
  private actionHandlers = new Map<Action, () => void>();
  // Special handlers that can be dynamically replaced
  onEscape: (() => void) | undefined;
  onCtrlD: (() => void) | undefined;
  onPasteImage: (() => void) | undefined;
  /** Handler for extension-registered shortcuts. Returns true if handled. */
  onExtensionShortcut: ((data: string) => boolean) | undefined;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: { matches: (data: string, action: Action) => boolean },
    options?: CustomEditorOptions,
  ) {
    super(tui, theme, options);
    this.keybindings = keybindings;
    this.embedWorkingStatus = options?.embedWorkingStatus ?? false;
  }

  setWorkingStatusIndicator(indicator: StatusIndicator): void {
    this.workingStatusIndicator = indicator;
  }

  protected renderTopBorder(width: number, hiddenLineCount: number): string {
    if (!this.embedWorkingStatus || !this.workingStatusIndicator || width <= 0) {
      return super.renderTopBorder(width, hiddenLineCount);
    }
    let status = this.workingStatusIndicator.renderInBorder(Math.max(1, width - 5));
    let statusWidth = visibleWidth(status);
    if (statusWidth === 0) return super.renderTopBorder(width, hiddenLineCount);
    const overflowLabel = hiddenLineCount > 0 ? ` ↑ ${hiddenLineCount} more ` : undefined;
    const overflowLabelWidth = overflowLabel ? visibleWidth(overflowLabel) : 0;
    const overflowStart = Math.floor((width - overflowLabelWidth) / 2);
    const canFitOverflow = () =>
      overflowLabel !== undefined &&
      overflowLabelWidth + 2 <= width &&
      overflowStart - (3 + statusWidth + 1) >= 1;
    if (overflowLabel && !canFitOverflow()) {
      status = this.workingStatusIndicator.renderSpinnerInBorder(width);
      statusWidth = visibleWidth(status);
    }
    if (canFitOverflow()) {
      const leftBlockWidth = 3 + statusWidth + 1;
      return (
        this.borderColor("── ") +
        status +
        this.borderColor(
          ` ${"─".repeat(overflowStart - leftBlockWidth)}${overflowLabel}${"─".repeat(width - overflowStart - overflowLabelWidth)}`,
        )
      );
    }
    if (width >= statusWidth + 5) {
      return (
        this.borderColor("── ") +
        status +
        this.borderColor(` ${"─".repeat(width - statusWidth - 4)}`)
      );
    }
    status = this.workingStatusIndicator.renderSpinnerInBorder(width);
    statusWidth = visibleWidth(status);
    const prefixWidth = Math.min(3, Math.max(0, width - statusWidth));
    return (
      this.borderColor("─".repeat(prefixWidth)) +
      status +
      this.borderColor("─".repeat(Math.max(0, width - prefixWidth - statusWidth)))
    );
  }

  /**
   * Register a handler for an app action.
   */
  onAction(action: Action, handler: () => void): void {
    this.actionHandlers.set(action, handler);
  }

  handleInput(data: string): void {
    // Check extension-registered shortcuts first
    if (this.onExtensionShortcut?.(data)) {
      return;
    }
    // Selection page keys move an open autocomplete menu before app actions run.
    if (
      this.isShowingAutocomplete() &&
      (this.keybindings.matches(data, "tui.select.pageUp") ||
        this.keybindings.matches(data, "tui.select.pageDown"))
    ) {
      super.handleInput(data);
      return;
    }
    // Check for clipboard paste keybinding
    if (this.keybindings.matches(data, "app.clipboard.pasteImage")) {
      this.onPasteImage?.();
      return;
    }
    // Escape/interrupt - only if autocomplete is NOT active
    if (this.keybindings.matches(data, "app.interrupt")) {
      if (!this.isShowingAutocomplete()) {
        const handler = this.onEscape ?? this.actionHandlers.get("app.interrupt");
        if (handler) {
          handler();
          return;
        }
      }
      // Let parent handle escape for autocomplete cancellation
      super.handleInput(data);
      return;
    }
    // Exit (Ctrl+D) - only when editor is empty
    if (this.keybindings.matches(data, "app.exit")) {
      if (this.getText().length === 0) {
        const handler = this.onCtrlD ?? this.actionHandlers.get("app.exit");
        if (handler) handler();
        return;
      }
      // Fall through to editor handling for delete-char-forward when not empty
    }
    // Explicit history bindings take precedence over app actions while focused.
    if (
      this.keybindings.matches(data, "tui.editor.historyPrevious") ||
      this.keybindings.matches(data, "tui.editor.historyNext")
    ) {
      super.handleInput(data);
      return;
    }
    // Check all other app actions
    for (const [action, handler] of this.actionHandlers) {
      if (
        action !== "app.interrupt" &&
        action !== "app.exit" &&
        this.keybindings.matches(data, action)
      ) {
        handler();
        return;
      }
    }
    // Pass to parent for editor handling
    super.handleInput(data);
  }
}
