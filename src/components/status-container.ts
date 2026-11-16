/**
 * Status Indicator Container
 *
 * A container that manages and displays different status indicators
 * (working, retry, compaction, idle) based on the current state.
 */

import { Container, type TUI } from "@earendil-works/pi-tui";
import {
  WorkingStatusIndicator,
  RetryStatusIndicator,
  CompactionStatusIndicator,
  IdleStatus,
} from "./status-indicator.js";

type StatusType = "idle" | "working" | "retry" | "compaction";

export class StatusIndicatorContainer extends Container {
  private currentIndicator: Container | null = null;
  private currentType: StatusType = "idle";
  private readonly tui: TUI;

  // Pre-created indicators
  private readonly indicators: Record<string, Container>;

  constructor(tui: TUI) {
    super();
    this.tui = tui;
    this.indicators = {
      idle: new IdleStatus("Ready"),
      working: new WorkingStatusIndicator(tui, "Working"),
      retry: new RetryStatusIndicator("Retrying"),
      compaction: new CompactionStatusIndicator(),
    };
    this.show("idle");
  }

  /** Show a specific status indicator */
  show(
    type: StatusType,
    options?: { message?: string; retryCount?: number; progress?: number },
  ): void {
    if (this.currentType === type && this.currentIndicator) {
      this.updateIndicator(type, options);
      return;
    }

    // Hide current indicator
    if (this.currentIndicator) {
      this.removeChild(this.currentIndicator);
    }

    // Show new indicator
    const indicator = this.indicators[type];
    this.updateIndicator(type, options);

    this.currentIndicator = indicator;
    this.currentType = type;
    this.addChild(indicator);
    this.invalidate();
  }

  private updateIndicator(
    type: StatusType,
    options?: { message?: string; retryCount?: number; progress?: number },
  ): void {
    const indicator = this.indicators[type];
    if (type === "working" && options?.message && indicator instanceof WorkingStatusIndicator) {
      indicator.setMessage(options.message);
    } else if (type === "retry" && indicator instanceof RetryStatusIndicator) {
      if (options?.message) indicator.setMessage(options.message);
      if (options?.retryCount !== undefined) indicator.setRetryCount(options.retryCount);
    } else if (type === "compaction" && indicator instanceof CompactionStatusIndicator) {
      if (options?.progress !== undefined) indicator.setProgress(options.progress);
    } else if (type === "idle" && options?.message && indicator instanceof IdleStatus) {
      indicator.setMessage(options.message);
    }
  }

  /** Get current status type */
  getCurrentType(): StatusType {
    return this.currentType;
  }

  /** Get current indicator */
  getCurrentIndicator(): Container | null {
    return this.currentIndicator;
  }
}
