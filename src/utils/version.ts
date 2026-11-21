import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The running package version, read once from the manifest that ships next to
 * the bundle. The lookup walks up from this file so it works both from source
 * (`src/utils/`) and from the bundled entry (`dist/cli.mjs`), wherever the
 * package.json actually lives. Falls back to "dev" when no manifest is found,
 * so the header still renders.
 */
let cached: string | undefined;

export function packageVersion(): string {
  if (cached !== undefined) return cached;
  cached = "dev";
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let depth = 0; depth < 6; depth++) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
          name?: string;
          version?: unknown;
        };
        if (manifest.name === "lazydsh" && typeof manifest.version === "string") {
          cached = manifest.version;
          break;
        }
      } catch {}
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {}
  return cached;
}
