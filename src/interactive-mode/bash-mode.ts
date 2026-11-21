/**
 * Bash mode
 *
 * `!cmd` runs a local shell command and its output joins the next prompt;
 * `!!cmd` runs it without touching the conversation. Pure so the prefix rules
 * are testable without a shell.
 */

/** The parsed intent of a bash-mode line, or undefined for ordinary prompts. */
export interface BashIntent {
  command: string;
  /** The original prefix text (`!` or `!!`) that triggered bash mode. */
  prefix: string;
  /** Output is kept out of the model context. */
  excludeFromContext: boolean;
}

/** Parse a submitted line as bash mode, or return undefined for a normal prompt. */
export function parseBashMode(text: string): BashIntent | undefined {
  const match = /^(!{1,2})\s*(\S[\s\S]*)$/.exec(text.trim());
  if (match === null) return undefined;
  const prefix = match[1]!;
  const command = match[2]!.trim();
  return { command, prefix, excludeFromContext: prefix === "!!" };
}

/**
 * Fold a finished bash run into the conversation prefix: the command, its exit
 * status, and its captured output — skipped entirely for excluded runs.
 */
export function bashContextBlock(
  intent: BashIntent,
  result: { exitCode?: number | null; stdout?: string; stderr?: string },
): string {
  if (intent.excludeFromContext) return "";
  const exit = result.exitCode === undefined ? "?" : String(result.exitCode);
  const body = [result.stdout?.trimEnd(), result.stderr?.trimEnd()]
    .filter((part) => part !== undefined && part !== "")
    .join("\n");
  return `[${intent.prefix} ${intent.command} — exit ${exit}]\n${body}`;
}
