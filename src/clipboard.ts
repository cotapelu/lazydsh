/**
 * Clipboard
 *
 * Copies text to the system clipboard. Uses pi-tui's native clipboard helper
 * when it exposes `setText`, and falls back to the platform CLI otherwise.
 * Ported from pi-coding-agent's `utils/clipboard.ts`.
 */

import { getNativeClipboard } from "@earendil-works/pi-tui";
import { spawn } from "node:child_process";

function run(command: string, args: string[], input?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });
    if (input !== undefined && child.stdin !== null) {
      child.stdin.on("error", () => resolve(false));
      child.stdin.end(input);
    }
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

/** Copy text. Resolves false when no clipboard mechanism is available. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (text === "") return false;
  const native = getNativeClipboard();
  if (native?.setText !== undefined) {
    try {
      await native.setText(text);
      return true;
    } catch {
      return false;
    }
  }
  if (process.platform === "darwin") return run("pbcopy", [], text);
  if (process.platform === "win32") return run("clip", [], text);
  // Wayland, then X11.
  if (await run("wl-copy", [], text)) return true;
  return run("xclip", ["-selection", "clipboard"], text);
}
