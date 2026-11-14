import { Container, ProcessTerminal, TuiAltScreen, matchesKey } from "@earendil-works/pi-tui";
import { SearchPicker } from "./picker.ts";
import type { Runtime } from "./runtime.ts";

// Open a standalone session picker before the main TUI starts.
export async function selectSession(
  runtime: Runtime,
  lifetimeSignal: AbortSignal,
): Promise<string | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("Session selection requires an interactive terminal.");
  const controller = new AbortController();
  const signal = AbortSignal.any([lifetimeSignal, controller.signal]);
  const tui = new TuiAltScreen(new ProcessTerminal());
  const container = new Container();
  tui.addChild(container);
  tui.addInputListener((data) => {
    if (matchesKey(data, "ctrl+c")) {
      controller.abort();
      return { consume: true };
    }
  });
  try {
    signal.throwIfAborted();
    tui.start();
    const picker = new SearchPicker(
      [],
      "Sessions",
      Math.max(1, Math.min(10, tui.terminal.rows - 6)),
      undefined,
      true,
    );
    picker.setLoading();
    container.addChild(picker);
    tui.setFocus(picker);
    tui.requestRender();
    return await new Promise<string | null>((resolve, reject) => {
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        resolve(value);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      const abort = () => settle(null);
      signal.addEventListener("abort", abort, { once: true });
      picker.onSelect = settle;
      picker.onCancel = abort;
      runtime.choices("sessions").then((choices) => {
        if (settled) return;
        if (!choices.options.length) {
          fail(new Error("No saved sessions to resume."));
          return;
        }
        picker.setItems(choices.options);
        tui.requestRender();
      }, fail);
    });
  } finally {
    tui.stop({ preserveScreen: true });
  }
}
