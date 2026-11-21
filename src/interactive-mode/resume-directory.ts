import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type { SelectItem } from "@earendil-works/pi-tui";

export const SESSION_DIRECTORY = "session";
export const CURRENT_DIRECTORY = "current";

/** Choices offered when a resumed session was saved in another directory. */
export function resumeDirectoryOptions(
  sessionDirectory: string,
  currentDirectory: string,
): SelectItem[] {
  return [
    { value: SESSION_DIRECTORY, label: "Session directory", description: sessionDirectory },
    { value: CURRENT_DIRECTORY, label: "Current directory", description: currentDirectory },
  ];
}

/** The directory override for a resume-directory choice, if the session should move. */
export function resumeDirectoryTarget(
  choice: string,
  currentDirectory: string,
): string | undefined {
  return choice === CURRENT_DIRECTORY ? currentDirectory : undefined;
}

/** Compare directories after resolving `..` and symlinks when both paths exist. */
export async function sameDirectory(a: string, b: string): Promise<boolean> {
  if (resolve(a) === resolve(b)) return true;
  try {
    return (await realpath(a)) === (await realpath(b));
  } catch {
    return false;
  }
}
