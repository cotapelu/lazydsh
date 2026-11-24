/**
 * External Editor
 *
 * Opens `$VISUAL`/`$EDITOR` on the current draft in a temp file, then reads the
 * result back. Ported from pi-coding-agent's `external-editor.ts`.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

export interface ExternalEditorResult {
  status: "complete" | "failed";
  content?: string;
  message?: string;
}

/** The editor command to use, or undefined when none is configured. */
export function editorCommand(): string | undefined {
  const fromEnv = process.env.VISUAL ?? process.env.EDITOR;
  return fromEnv !== undefined && fromEnv.trim() !== "" ? fromEnv.trim() : undefined;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export async function editInExternalEditor(options: {
  content: string;
  command: string;
}): Promise<ExternalEditorResult> {
  const directory = mkdtempSync(join(tmpdir(), "lazydsh-editor-"));
  const filePath = join(directory, "prompt.md");
  try {
    writeFileSync(filePath, options.content, "utf-8");
    // Do not use spawnSync: synchronous child_process calls can keep Node's
    // console input read active after stdin is paused, racing the editor for
    // the input buffer. `null` means the editor could not be launched.
    const exit = await new Promise<number | string | null>((resolve) => {
      const child = spawn(options.command + " " + JSON.stringify(filePath), {
        stdio: "inherit",
        shell: true,
      });
      child.on("error", () => resolve(null));
      child.on("close", (code, signal) => resolve(code ?? signal));
    });
    if (exit === null)
      return { status: "failed", message: `Failed to launch external editor: ${options.command}` };
    if (exit !== 0)
      return {
        status: "failed",
        message: `External editor exited with ${typeof exit === "number" ? `code ${exit}` : exit}; prompt unchanged`,
      };
    return {
      status: "complete",
      content: stripVTControlCharacters(stripBom(readFileSync(filePath, "utf-8"))).replace(
        /\n$/,
        "",
      ),
    };
  } finally {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // Cleanup is best effort.
    }
  }
}
