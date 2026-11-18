/**
 * User Message Selector Component
 *
 * Renders a user message list for branching ("fork from message"). Selecting a
 * message copies the active path up to that point into a new session.
 * Ported from pi-coding-agent's `user-message-selector.js`.
 */

import {
  Container,
  getKeybindings,
  getSelectPageIndex,
  Spacer,
  Text,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

export interface SelectableUserMessage {
  id: string;
  text: string;
}

/**
 * Custom user message list component with selection. Implements the Component
 * surface (render/handleInput/invalidate) directly.
 */
class UserMessageList implements Component {
  capturesViewportInput = true;
  messages: SelectableUserMessage[] = [];
  selectedIndex = 0;
  onSelect: ((id: string) => void) | undefined;
  onCancel: (() => void) | undefined;
  maxVisible = 10; // Max messages visible

  constructor(messages: SelectableUserMessage[], initialSelectedId?: string) {
    // Store messages in chronological order (oldest to newest)
    this.messages = messages;
    const initialIndex = initialSelectedId
      ? messages.findIndex((message) => message.id === initialSelectedId)
      : -1;
    // Start with selected message if provided, else default to the most recent
    this.selectedIndex = initialIndex >= 0 ? initialIndex : Math.max(0, messages.length - 1);
  }

  invalidate(): void {
    // No cached state to invalidate currently
  }

  render(width: number): string[] {
    const lines: string[] = [];
    if (this.messages.length === 0) {
      lines.push(theme.fg("muted", "  No user messages found"));
      return lines;
    }
    // Calculate visible range with scrolling
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(this.maxVisible / 2),
        this.messages.length - this.maxVisible,
      ),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.messages.length);
    // Render visible messages (2 lines per message + blank line)
    for (let i = startIndex; i < endIndex; i++) {
      const message = this.messages[i];
      if (!message) continue;
      const isSelected = i === this.selectedIndex;
      // Normalize message to single line
      const normalizedMessage = message.text.replace(/\n/g, " ").trim();
      // First line: cursor + message
      const cursor = isSelected ? theme.fg("accent", "› ") : "  ";
      const maxMsgWidth = width - 2; // Account for cursor (2 chars)
      const truncatedMsg = truncateToWidth(normalizedMessage, maxMsgWidth);
      const messageLine = cursor + (isSelected ? theme.bold(truncatedMsg) : truncatedMsg);
      lines.push(messageLine);
      // Second line: metadata (position in history)
      const position = i + 1;
      const metadata = `  Message ${position} of ${this.messages.length}`;
      lines.push(theme.fg("muted", metadata));
      lines.push(""); // Blank line between messages
    }
    // Add scroll indicator if needed
    if (startIndex > 0 || endIndex < this.messages.length) {
      const scrollInfo = theme.fg("muted", `  (${this.selectedIndex + 1}/${this.messages.length})`);
      lines.push(scrollInfo);
    }
    return lines;
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const pageIndex = getSelectPageIndex(
      kb,
      keyData,
      this.selectedIndex,
      this.messages.length,
      this.maxVisible,
    );
    // Up arrow - go to previous (older) message, wrap to bottom when at top
    if (kb.matches(keyData, "tui.select.up")) {
      this.selectedIndex =
        this.selectedIndex === 0 ? this.messages.length - 1 : this.selectedIndex - 1;
    }
    // Down arrow - go to next (newer) message, wrap to top when at bottom
    else if (kb.matches(keyData, "tui.select.down")) {
      this.selectedIndex =
        this.selectedIndex === this.messages.length - 1 ? 0 : this.selectedIndex + 1;
    }
    // Page up/down
    else if (pageIndex !== undefined) {
      if (this.messages.length === 0) return;
      this.selectedIndex = pageIndex;
    }
    // Enter - select message and branch
    else if (kb.matches(keyData, "tui.select.confirm")) {
      const selected = this.messages[this.selectedIndex];
      if (selected && this.onSelect) this.onSelect(selected.id);
    }
    // Escape - cancel
    else if (kb.matches(keyData, "tui.select.cancel")) {
      if (this.onCancel) this.onCancel();
    }
  }
}

/**
 * Component that renders a user message selector for branching.
 */
export class UserMessageSelectorComponent extends Container {
  private messageList: UserMessageList;

  constructor(
    messages: SelectableUserMessage[],
    onSelect: (id: string) => void,
    onCancel: () => void,
    initialSelectedId?: string,
  ) {
    super();
    // Add header
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.bold("Fork from Message"), 1, 0));
    this.addChild(
      new Text(
        theme.fg(
          "muted",
          "Select a user message to copy the active path up to that point into a new session",
        ),
        1,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    // Create message list
    this.messageList = new UserMessageList(messages, initialSelectedId);
    this.messageList.onSelect = onSelect;
    this.messageList.onCancel = onCancel;
    this.addChild(this.messageList);
    // Add bottom border
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
    // Auto-cancel if no messages
    if (messages.length === 0) {
      setTimeout(() => onCancel(), 100);
    }
  }

  getMessageList(): UserMessageList {
    return this.messageList;
  }
}
