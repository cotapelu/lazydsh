/**
 * Status Indicator Container
 *
 * Manages transitions between working/retry/compaction/idle status indicators.
 * Ported from pi-coding-agent's status handling in interactive-mode.ts.
 */

import { Container } from "@earendil-works/pi-tui";
import type { TuiHost } from "../../interfaces.ts";
import {
  WorkingStatusIndicator,
  RetryStatusIndicator,
  CompactionStatusIndicator,
  IdleStatus,
} from "./status-indicator.ts";

export interface StatusOptions {
  message?: string;
  retryCount?: number;
  /** Attempt ceiling shown in the retry label; DSH's policy supplies it. */
  maxAttempts?: number;
  delayMs?: number;
  reason?: "manual" | "overflow";
}

export class StatusIndicatorContainer extends Container {
  private tui: TuiHost;
  private currentIndicator:
    | WorkingStatusIndicator
    | RetryStatusIndicator
    | CompactionStatusIndicator
    | IdleStatus
    | null = null;
  private currentKind: string | null = null;

  constructor(tui: TuiHost) {
    super();
    this.tui = tui;
  }

  show(kind: "working" | "retry" | "compaction" | "idle", options: StatusOptions = {}): void {
    // Dispose of current indicator
    if (this.currentIndicator) {
      this.currentIndicator.dispose();
      this.removeChild(this.currentIndicator);
      this.currentIndicator = null;
    }

    // Create new indicator
    switch (kind) {
      case "working":
        this.currentIndicator = new WorkingStatusIndicator(
          this.tui,
          options.message ?? "Working",
          undefined,
        );
        break;
      case "retry":
        this.currentIndicator = new RetryStatusIndicator(
          this.tui,
          options.retryCount ?? 1,
          options.maxAttempts ?? 3,
          options.delayMs ?? 1000,
        );
        break;
      case "compaction":
        this.currentIndicator = new CompactionStatusIndicator(this.tui, options.reason ?? "manual");
        break;
      case "idle":
        this.currentIndicator = new IdleStatus(options.message ?? "Ready");
        break;
    }

    this.currentKind = kind;
    this.addChild(this.currentIndicator);
    this.tui.requestRender();
  }

  getCurrentKind(): string | null {
    return this.currentKind;
  }

  invalidate(): void {
    if (this.currentIndicator) {
      this.currentIndicator.invalidate();
    }
  }
}
