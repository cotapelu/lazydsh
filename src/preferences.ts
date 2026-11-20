import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { Route } from "./interfaces.ts";

export type SavedRoute = Route & { effort?: string };

export function preferencesPath(home?: string) {
  return join(
    resolve(home ?? process.env.DSH_HOME ?? join(homedir(), ".dsh")),
    "lazydsh-model.json",
  );
}
export async function loadModel(path: string): Promise<SavedRoute | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (
      value &&
      typeof value === "object" &&
      typeof value.provider === "string" &&
      value.provider.trim() &&
      typeof value.model === "string" &&
      value.model.trim()
    )
      return {
        provider: value.provider,
        model: value.model,
        ...(typeof value.effort === "string" && value.effort.trim()
          ? { effort: value.effort }
          : {}),
      };
  } catch (error) {
    if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT")
      throw error;
  }
}
export async function saveModel(path: string, route: SavedRoute) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + "." + process.pid + ".tmp";
  const value = {
    provider: route.provider,
    model: route.model,
    ...(route.effort ? { effort: route.effort } : {}),
  };
  await writeFile(temporary, JSON.stringify(value) + "\n", { mode: 0o600 });
  await rename(temporary, path);
}
