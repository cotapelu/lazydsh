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
    // Parse command into [cmd, ...args] to avoid shell injection/quoting issues
    const parsed = parseEditorCommand(options.command);
    if (!parsed) {
      return { status: "failed", message: `Invalid editor command: ${options.command}` };
    }
    const exit = await new Promise<number | string | null>((resolve) => {
      const child = spawn(parsed.cmd, [...parsed.args, filePath], {
        stdio: "inherit",
        shell: false,
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

/**
 * Parse editor command string into cmd and args.
 * Handles basic shell-like quoting (single/double quotes, escaped chars).
 * Does not support complex shell features (pipes, redirects, etc.).
 */
function parseEditorCommand(command: string): { cmd: string; args: string[] } | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const args: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) args.push(current);
  if (args.length === 0) return null;

  return { cmd: args[0], args: args.slice(1) };
}
