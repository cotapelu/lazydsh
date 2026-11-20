import { readFileSync } from "node:fs";

/**
 * The running package version, read once from the manifest that ships next to
 * the bundle. Falls back to "dev" when the file is unavailable (for example a
 * tarball layout without package.json), so the header still renders.
 */
let cached: string | undefined;

export function packageVersion(): string {
  if (cached !== undefined) return cached;
  try {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    cached = typeof manifest.version === "string" ? manifest.version : "dev";
  } catch {
    cached = "dev";
  }
  return cached;
}
