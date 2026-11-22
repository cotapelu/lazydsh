/**
 * Reusable countdown timer for dialog components.
 * Ported from pi-coding-agent's countdown-timer.js
 */

import type { TuiHost } from "../../interfaces.ts";

export class CountdownTimer {
  intervalId: ReturnType<typeof setInterval> | undefined;
  remainingSeconds: number;
  tui: TuiHost;
  onTick: (seconds: number) => void;
  onExpire: () => void;

  constructor(
    timeoutMs: number,
    tui: TuiHost,
    onTick: (seconds: number) => void,
    onExpire: () => void,
  ) {
    this.tui = tui;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.remainingSeconds = Math.ceil(timeoutMs / 1000);
    this.onTick(this.remainingSeconds);
    this.intervalId = setInterval(() => {
      this.remainingSeconds--;
      this.onTick(this.remainingSeconds);
      this.tui?.requestRender();
      if (this.remainingSeconds <= 0) {
        this.dispose();
        this.onExpire();
      }
    }, 1000);
  }

  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
