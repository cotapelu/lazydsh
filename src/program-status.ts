/**
 * Program Status (OSC 7501)
 *
 * Reports the session's state to terminals that support the Program Status
 * protocol: idle, working, blocked (waiting for permission/question/auth),
 * done, or error. pi-tui owns the encoding; this module owns when to report.
 */

import { formatProgramStatus, type ProgramStatus } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";

const APP = "lazydsh";

/** No-op on terminals without status support: writes are plain text writes. */
export class ProgramStatusReporter {
  private last: ProgramStatus["state"] | undefined;

  private readonly tui: TUI;

  constructor(tui: TUI) {
    this.tui = tui;
  }

  private report(status: ProgramStatus): void {
    if (status.state === this.last) return;
    this.last = status.state;
    try {
      this.tui.terminal.write(formatProgramStatus({ app: APP, ...status }));
    } catch {
      // A terminal that rejects the sequence must not break the UI.
    }
  }

  idle(message?: string): void {
    this.report({ state: "idle", ...(message === undefined ? {} : { message }) });
  }

  working(message = "Working"): void {
    this.report({ state: "working", message });
  }

  blocked(kind: "permission" | "question" | "auth", message: string): void {
    this.report({ state: "blocked", kind, message });
  }

  done(message = "Done"): void {
    this.report({ state: "done", message });
  }

  error(message: string): void {
    this.report({ state: "error", message });
  }

  /** Clear the status line. */
  clear(): void {
    this.report({ state: "clear" });
  }
}
