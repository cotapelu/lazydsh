import { Container, ProcessTerminal, TuiAltScreen, matchesKey } from "@earendil-works/pi-tui";
import { SearchPicker } from "./picker.ts";
import type { Runtime } from "../runtime/runtime.ts";
import {
  resumeDirectoryOptions,
  resumeDirectoryTarget,
  sameDirectory,
} from "./resume-directory.ts";

export type SessionSelection = { id: string; directory?: string };
export type ResumeDirectorySelection = { directory?: string };

function requireInteractive() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("Session selection requires an interactive terminal.");
}

function pickerLimit(tui: TuiAltScreen) {
  return Math.max(1, Math.min(10, tui.terminal.rows - 6));
}

// Open a standalone session picker before the main TUI starts.
export async function selectSession(
  runtime: Runtime,
  lifetimeSignal: AbortSignal,
  currentDirectory: string,
): Promise<SessionSelection | null> {
  requireInteractive();
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
    const limit = pickerLimit(tui);
    return await new Promise<SessionSelection | null>((resolve, reject) => {
      let settled = false;
      const settle = (value: SessionSelection | null) => {
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
      const sessions = new SearchPicker([], "Sessions", limit, undefined, true);
      sessions.setLoading();
      container.addChild(sessions);
      tui.setFocus(sessions);
      tui.requestRender();
      const chooseDirectory = (id: string) => {
        const picker = new SearchPicker([], "Resume in directory", limit, "session", false);
        picker.setLoading();
        container.clear();
        container.addChild(picker);
        tui.setFocus(picker);
        tui.requestRender();
        let active = true;
        picker.onCancel = () => {
          active = false;
          container.clear();
          container.addChild(sessions);
          tui.setFocus(sessions);
          tui.requestRender();
        };
        runtime.sessionDirectory(id).then(async (sessionDirectory) => {
          if (settled || !active) return;
          if (!sessionDirectory || (await sameDirectory(sessionDirectory, currentDirectory))) {
            settle({ id });
            return;
          }
          picker.setItems(resumeDirectoryOptions(sessionDirectory, currentDirectory), "session");
          picker.onSelect = (choice) => {
            const directory = resumeDirectoryTarget(choice, currentDirectory);
            settle(directory === undefined ? { id } : { id, directory });
          };
          tui.requestRender();
        }, fail);
      };
      sessions.onSelect = chooseDirectory;
      sessions.onCancel = abort;
      runtime.choices("sessions").then((choices) => {
        if (settled) return;
        if (!choices.options.length) {
          fail(new Error("No saved sessions to resume."));
          return;
        }
        sessions.setItems(choices.options);
        tui.requestRender();
      }, fail);
    });
  } finally {
    tui.stop({ preserveScreen: true });
  }
}

// Ask whether an explicitly resumed session should keep its saved directory.
export async function selectResumeDirectory(
  runtime: Runtime,
  sessionId: string,
  currentDirectory: string,
  lifetimeSignal: AbortSignal,
): Promise<ResumeDirectorySelection | null> {
  const sessionDirectory = await runtime.sessionDirectory(sessionId);
  if (!sessionDirectory || (await sameDirectory(sessionDirectory, currentDirectory))) return {};
  requireInteractive();
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
      resumeDirectoryOptions(sessionDirectory, currentDirectory),
      "Resume in directory",
      pickerLimit(tui),
      "session",
      false,
    );
    container.addChild(picker);
    tui.setFocus(picker);
    tui.requestRender();
    return await new Promise<ResumeDirectorySelection | null>((resolve) => {
      let settled = false;
      const settle = (value: ResumeDirectorySelection | null) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        resolve(value);
      };
      const abort = () => settle(null);
      signal.addEventListener("abort", abort, { once: true });
      picker.onSelect = (choice) => {
        const directory = resumeDirectoryTarget(choice, currentDirectory);
        settle(directory === undefined ? {} : { directory });
      };
      picker.onCancel = () => settle(null);
    });
  } finally {
    tui.stop({ preserveScreen: true });
  }
}
