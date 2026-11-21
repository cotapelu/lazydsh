/**
 * Theme Schema Validation
 *
 * Validates theme JSON against the theme token schema.
 * Ported from pi-coding-agent's theme-schema.js.
 */

import { Compile } from "typebox/compile";
import { THEME_TOKENS } from "./theme-tokens.ts";

type ThemeTokenName = keyof typeof THEME_TOKENS;

const ThemeTokenSlot = ["foreground", "background"] as const;
type ThemeTokenSlot = (typeof ThemeTokenSlot)[number];

interface ThemeTokenDescriptor {
  slot: ThemeTokenSlot;
  description: string;
  fallback?: string;
}

interface ThemeJson {
  name?: string;
  colors: Record<string, string | number>;
  vars?: Record<string, string | number>;
  appearance?: "light" | "dark";
  dim?: ThemeTokenName[];
}

const ThemeSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    colors: {
      type: "object",
      additionalProperties: {
        type: "string",
        pattern: "^(#[0-9a-fA-F]{6}|okl?ch\\([^)]+\\)|okhsl\\([^)]+\\)|)$",
      },
    },
    vars: {
      type: "object",
      additionalProperties: {
        type: "string",
        pattern: "^(#[0-9a-fA-F]{6}|okl?ch\\([^)]+\\)|okhsl\\([^)]+\\)|)$",
      },
    },
    appearance: { type: "string", enum: ["light", "dark"] },
    dim: {
      type: "array",
      items: { type: "string", enum: Object.keys(THEME_TOKENS) as [string, ...string[]] },
    },
  },
  required: ["colors"],
  additionalProperties: false,
} as const;

let themeValidator: ReturnType<typeof Compile> | undefined;

/**
 * Validate a theme JSON object. Throws on invalid theme.
 *
 * The validator compiles lazily on first use: built-in themes load without
 * paying for the typebox module graph, which only user-authored themes need.
 */
export function validateTheme(json: unknown): asserts json is ThemeJson {
  themeValidator ??= Compile(ThemeSchema);
  if (!themeValidator.Check(json)) {
    const errors = [...themeValidator.Errors(json)];
    throw new Error(`Invalid theme: ${errors.map((e) => e.message).join(", ")}`);
  }
}

/**
 * Validate and load a theme from a JSON object.
 */
export function loadThemeFromJson(json: unknown): ThemeJson {
  validateTheme(json);
  return json as ThemeJson;
}

export type { ThemeJson, ThemeTokenDescriptor, ThemeTokenSlot, ThemeTokenName };
export { THEME_TOKENS };
