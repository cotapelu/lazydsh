import { highlight, supportsLanguage, DEFAULT_THEME, type Theme } from "cli-highlight";
import { accent, dim, safeText } from "./theme.ts";

const identity = (text: string) => text;
const lines = (style: (text: string) => string) => (text: string) =>
  text.split("\n").map(style).join("\n");
const theme: Theme = {
  ...Object.fromEntries(Object.keys(DEFAULT_THEME).map((key) => [key, identity])),
  keyword: lines(accent),
  literal: lines(accent),
  number: lines(accent),
  type: lines(accent),
  built_in: lines(accent),
  title: lines(accent),
  attr: lines(accent),
  meta: lines(accent),
  string: lines((text) => `\x1b[38;2;155;175;255m${text}\x1b[0m`),
  comment: lines(dim),
  doctag: lines(dim),
  default: identity,
};

export function highlightCode(code: string, language?: string): string[] {
  const source = safeText(code);
  const lang = language?.trim().toLowerCase().split(/\s/)[0];
  if (lang && !supportsLanguage(lang)) return source.split("\n");
  try {
    return highlight(source, {
      language: lang || undefined,
      languageSubset: [
        "typescript",
        "javascript",
        "python",
        "rust",
        "csharp",
        "go",
        "bash",
        "json",
        "yaml",
        "xml",
        "css",
        "sql",
      ],
      ignoreIllegals: true,
      theme,
    }).split("\n");
  } catch {
    return source.split("\n");
  }
}
