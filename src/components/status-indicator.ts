/**
 * Status Indicators
 *
 * Status indicators for working, retry, compaction, and idle states.
 * Ported from pi-coding-agent's status-indicator.js.
 */

import { Container, Loader, Text, Spacer, type TUI } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

/** Base status indicator interface */
export interface StatusIndicator extends Container {
  setMessage(message: string): void;
}

/** Working status indicator with spinner */
export class WorkingStatusIndicator extends Container {
  private loader: Loader;
  private message: string;

  constructor(tui: TUI, message = "Working") {
    super();
    this.message = message;
    this.loader = new Loader(
      tui,
      (spinner) => theme.fg("accent", spinner),
      (text) => theme.fg("muted", text),
      message,
    );
    this.addChild(new Spacer(1));
    this.addChild(this.loader);
    this.addChild(new Spacer(1));
  }

  setMessage(message: string): void {
    this.message = message;
    this.loader.setMessage(message);
  }

  setVisible(_visible: boolean): void {
    // Implementation depends on parent container
  }
}

/** Retry status indicator */
export class RetryStatusIndicator extends Container {
  private text: Text;
  private retryCount: number;
  private message: string;

  constructor(message = "Retrying", retryCount = 0) {
    super();
    this.message = message;
    this.retryCount = retryCount;
    this.text = new Text("", 1, 0);
    this.addChild(new Spacer(1));
    this.addChild(this.text);
    this.addChild(new Spacer(1));
    this.updateDisplay();
  }

  setRetryCount(count: number): void {
    this.retryCount = count;
    this.updateDisplay();
  }

  setMessage(message: string): void {
    this.message = message;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const retryText = this.retryCount > 0 ? ` (retry ${this.retryCount})` : "";
    this.text.setText(theme.fg("warning", `${this.message}${retryText}`));
  }
}

/** Compaction status indicator */
export class CompactionStatusIndicator extends Container {
  private text: Text;
  private progress: number; // 0-100

  constructor() {
    super();
    this.progress = 0;
    this.text = new Text("", 1, 0);
    this.addChild(new Spacer(1));
    this.addChild(this.text);
    this.addChild(new Spacer(1));
    this.updateDisplay();
  }

  setProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(100, progress));
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const bar = this.renderProgressBar(this.progress);
    this.text.setText(theme.fg("accent", `Compacting ${bar} ${this.progress}%`));
  }

  private renderProgressBar(percent: number): string {
    const width = 20;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
  }
}

/** Idle status indicator */
export class IdleStatus extends Container {
  private text: Text;

  constructor(message = "Ready") {
    super();
    this.text = new Text(theme.fg("muted", message), 1, 0);
    this.addChild(new Spacer(1));
    this.addChild(this.text);
    this.addChild(new Spacer(1));
  }

  setMessage(message: string): void {
    this.text.setText(theme.fg("muted", message));
  }
}

/** Status indicator factory */
export function createStatusIndicator(
  type: "working" | "retry" | "compaction" | "idle",
  tui: TUI,
  options?: {
    message?: string;
    retryCount?: number;
    progress?: number;
  },
): Container {
  switch (type) {
    case "working":
      return new WorkingStatusIndicator(tui, options?.message);
    case "retry":
      return new RetryStatusIndicator(options?.message, options?.retryCount);
    case "compaction":
      return new CompactionStatusIndicator();
    case "idle":
      return new IdleStatus(options?.message);
    default:
      return new IdleStatus();
  }
}
