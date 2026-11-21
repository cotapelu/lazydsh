import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { format } from "node:util";

type ConsoleMethod = "debug" | "log" | "info" | "warn" | "error";

/**
 * Keep plugin console output out of the alternate screen.
 *
 * The TUI owns the terminal while it is open, so a raw `console.warn` or
 * `console.error` from a provider plugin is painted on top of the chat and
 * the composer. Redirect every console method to a debug log for the lifetime
 * of the screen; a log failure drops the message rather than printing it over
 * the TUI.
 *
 * @param logFile - file that receives the captured console lines.
 * @returns a function that restores the original console methods.
 */
export function captureConsole(logFile: string) {
  const original = {
    debug: console.debug,
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  let ready = false;
  const write = (method: ConsoleMethod, args: unknown[]) => {
    if (!ready) {
      try {
        mkdirSync(dirname(logFile), { recursive: true, mode: 0o700 });
        ready = true;
      } catch {
        return;
      }
    }
    try {
      appendFileSync(
        logFile,
        `${new Date().toISOString()} ${method.toUpperCase()} ${format(...args)}\n`,
        {
          mode: 0o600,
        },
      );
    } catch {
      // Never print over the TUI when the log itself is unavailable.
    }
  };
  for (const method of ["debug", "log", "info", "warn", "error"] as const)
    console[method] = (...args: unknown[]) => write(method, args);
  return () => {
    console.debug = original.debug;
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  };
}
