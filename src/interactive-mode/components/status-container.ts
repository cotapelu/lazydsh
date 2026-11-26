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
  /** Label of a live `working` indicator, so a repeat call is a no-op. */
  private currentMessage: string | undefined;

  constructor(tui: TuiHost) {
    super();
    this.tui = tui;
  }

  show(kind: "working" | "retry" | "compaction" | "idle", options: StatusOptions = {}): void {
    // Re-asserting `working` is the one state that repeats on every streamed
    // event: rebuilding the indicator restarts its spinner, so a turn that
    // calls "working" per delta flickers. The label is the only thing that
    // changes, and `setMessage` keeps the animation alive. Other kinds build
    // fresh indicators, because their options (reason, attempts) mean the old
    // component is not reusable by relabelling alone.
    const message = options.message ?? "Working";
    if (kind === "working" && this.currentKind === "working" && this.currentMessage === message)
      return;
    this.currentMessage = kind === "working" ? message : undefined;
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
