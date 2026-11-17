/**
 * Status Indicators
 *
 * Status indicators for working, retry, compaction, and idle states.
 * Ported from pi-coding-agent's status-indicator.js.
 */

import { Container, Loader, Spacer, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.js";
import { keyText } from "../keybinding-hints.js";

export class StatusIndicator extends Loader {
  kind: string;
  constructor(
    kind: string,
    ui: any,
    spinnerColorFn: (text: string) => string,
    messageColorFn: (text: string) => string,
    message: string,
    indicator?: any,
  ) {
    super(ui, spinnerColorFn, messageColorFn, message, indicator);
    this.kind = kind;
  }

  renderInBorder(width: number): string {
    const line = super.render(width + 2)[1] ?? "";
    return truncateToWidth(
      line.startsWith(" ") ? line.slice(1).trimEnd() : line.trimEnd(),
      width,
      "",
    );
  }

  renderSpinnerInBorder(width: number): string {
    return truncateToWidth(this.getRenderedIndicator(), width, "");
  }

  dispose(): void {
    this.stop();
  }
}

export class WorkingStatusIndicator extends StatusIndicator {
  constructor(ui: any, message: string, indicator?: any, colorFn?: (text: string) => string) {
    super(
      "working",
      ui,
      colorFn ?? ((text: string) => theme.fg("accent", text)),
      colorFn ?? ((text: string) => theme.fg("muted", text)),
      message,
      indicator,
    );
  }
}

export class RetryStatusIndicator extends StatusIndicator {
  countdown: CountdownTimer | undefined;
  constructor(ui: any, attempt: number, maxAttempts: number, delayMs: number) {
    const retryMessage = (seconds: number) =>
      `Retrying (${attempt}/${maxAttempts}) in ${seconds}s... (${keyText("app.interrupt")} to cancel)`;
    super(
      "retry",
      ui,
      (spinner: string) => theme.fg("warning", spinner),
      (text: string) => theme.fg("muted", text),
      retryMessage(Math.ceil(delayMs / 1000)),
    );
    this.countdown = new CountdownTimer(
      delayMs,
      ui,
      (seconds: number) => {
        this.setMessage(retryMessage(seconds));
      },
      () => {
        this.countdown = undefined;
      },
    );
  }

  dispose(): void {
    this.countdown?.dispose();
    this.countdown = undefined;
    super.dispose();
  }
}

export class CompactionStatusIndicator extends StatusIndicator {
  constructor(ui: any, reason: "manual" | "overflow", colorFn?: (text: string) => string) {
    const cancelHint = `(${keyText("app.interrupt")} to cancel)`;
    const label =
      reason === "manual"
        ? `Compacting context... ${cancelHint}`
        : `${reason === "overflow" ? "Context overflow detected, " : ""}Auto-compacting... ${cancelHint}`;
    super(
      "compaction",
      ui,
      colorFn ?? ((spinner: string) => theme.fg("accent", spinner)),
      colorFn ?? ((text: string) => theme.fg("muted", text)),
      label,
    );
  }
}

export class BranchSummaryStatusIndicator extends StatusIndicator {
  constructor(ui: any) {
    super(
      "branchSummary",
      ui,
      (spinner: string) => theme.fg("accent", spinner),
      (text: string) => theme.fg("muted", text),
      `Summarizing branch... (${keyText("app.interrupt")} to cancel)`,
    );
  }
}

export class IdleStatus extends Container {
  private text: Text;
  private message: string;

  constructor(message = "Ready") {
    super();
    this.message = message;
    this.text = new Text(String(theme.fg("muted", message)), 1, 0);
    this.addChild(new Spacer(1));
    this.addChild(this.text);
    this.addChild(new Spacer(1));
  }

  setMessage(message: string): void {
    this.message = message;
    this.text.setText(String(theme.fg("muted", message)));
  }

  invalidate(): void {
    // No cached state to invalidate.
  }

  render(width: number): string[] {
    return super.render(width);
  }

  dispose(): void {
    // No resources to clean up
  }
}
