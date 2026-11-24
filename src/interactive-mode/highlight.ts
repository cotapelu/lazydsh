import { createRequire } from "node:module";
import { accent, dim, fg, safeText } from "./theme.ts";

/**
 * The subset used for auto-detection when a code fence has no language. Each
 * grammar is still loaded on demand; this list only bounds the candidates.
 */
const AUTO_LANGUAGES = [
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
] as const;

/** Common fence names whose module file is named differently. */
const ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  python3: "python",
  rs: "rust",
  golang: "go",
  cs: "csharp",
  "c#": "csharp",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  yml: "yaml",
  html: "xml",
  htm: "xml",
  svg: "xml",
  vue: "xml",
  kt: "kotlin",
  kts: "kotlin",
  rb: "ruby",
  hs: "haskell",
  scss: "css",
  less: "css",
  mysql: "sql",
  postgres: "sql",
  postgresql: "sql",
  psql: "sql",
  ps1: "powershell",
  pwsh: "powershell",
  docker: "dockerfile",
  make: "makefile",
  mk: "makefile",
  "c++": "cpp",
  cc: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  h: "c",
  objc: "objectivec",
  "objective-c": "objectivec",
  hbs: "handlebars",
  coffee: "coffeescript",
  md: "markdown",
  tex: "latex",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
};

interface HighlightApi {
  highlight(
    code: string,
    options: { language: string; ignoreIllegals?: boolean },
  ): { value: string };
  highlightAuto(code: string, languageSubset?: readonly string[]): { value: string };
  registerLanguage(name: string, language: unknown): void;
  getLanguage(name: string): unknown;
}

type LanguageFn = (hljs: unknown) => unknown;

const require = createRequire(import.meta.url);
let api: HighlightApi | undefined;
const registered = new Set<string>();

function load(): HighlightApi {
  return (api ??= require("highlight.js/lib/core") as HighlightApi);
}

function normalize(language: string): string | undefined {
  const name = ALIASES[language] ?? language;
  return /^[a-z0-9][a-z0-9+#-]*$/.test(name) ? name : undefined;
}

/**
 * Register one grammar, loading only that language module. highlight.js
 * registers each language's own aliases, so `getLanguage` also accepts them.
 */
function ensureLanguage(requested: string): string | undefined {
  const hljs = load();
  if (hljs.getLanguage(requested)) return requested;
  const name = normalize(requested);
  if (name === undefined) return undefined;
  if (!registered.has(name)) {
    try {
      const module = require(`highlight.js/lib/languages/${name}`) as
        | LanguageFn
        | { default?: LanguageFn };
      const language = typeof module === "function" ? module : module.default;
      if (language === undefined) return undefined;
      hljs.registerLanguage(name, language);
      registered.add(name);
    } catch {
      return undefined;
    }
  }
  return hljs.getLanguage(requested) === undefined ? undefined : requested;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&nbsp;": "\u00a0",
};

const decode = (text: string) =>
  text.replace(/&(?:amp|lt|gt|quot|#x27|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);

const lines = (style: (text: string) => string) => (text: string) =>
  text.split("\n").map(style).join("\n");

const theme: Record<string, (text: string) => string> = {
  keyword: lines(accent),
  literal: lines(accent),
  number: lines(accent),
  type: lines(accent),
  built_in: lines(accent),
  title: lines(accent),
  attr: lines(accent),
  meta: lines(accent),
  string: lines((text) => fg.syntaxString(text)),
  comment: lines(dim),
  doctag: lines(dim),
};

/**
 * Turn highlight.js markup into ANSI. Only `span` tags are emitted, and every
 * token class is applied from the innermost span outwards so nested tokens
 * wrap in the same order the lexer opened them. Unknown tokens stay unstyled.
 */
function colorize(html: string): string {
  const stack: { token?: string; text: string }[] = [{ text: "" }];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open < 0) {
      stack[stack.length - 1].text += decode(html.slice(index));
      break;
    }
    if (open > index) stack[stack.length - 1].text += decode(html.slice(index, open));
    const close = html.indexOf(">", open);
    if (close < 0) {
      stack[stack.length - 1].text += decode(html.slice(open));
      break;
    }
    const tag = html.slice(open + 1, close);
    if (tag === "/span" && stack.length > 1) {
      const frame = stack.pop()!;
      const style = frame.token === undefined ? undefined : theme[frame.token];
      stack[stack.length - 1].text += style === undefined ? frame.text : style(frame.text);
    } else if (tag.startsWith("span")) {
      const classes = /class="([^"]*)"/.exec(tag)?.[1] ?? "";
      stack.push({ token: /hljs-([\w-]+)/.exec(classes)?.[1], text: "" });
    }
    index = close + 1;
  }
  while (stack.length > 1) {
    const frame = stack.pop()!;
    const style = frame.token === undefined ? undefined : theme[frame.token];
    stack[stack.length - 1].text += style === undefined ? frame.text : style(frame.text);
  }
  return stack[0].text;
}

export function highlightCode(code: string, language?: string): string[] {
  const source = safeText(code);
  const requested = language?.trim().toLowerCase().split(/\s/)[0];
  try {
    if (requested) {
      const resolved = ensureLanguage(requested);
      if (resolved === undefined) return source.split("\n");
      return colorize(
        load().highlight(source, { language: resolved, ignoreIllegals: true }).value,
      ).split("\n");
    }
    const subset = AUTO_LANGUAGES.filter((name) => ensureLanguage(name) !== undefined);
    if (subset.length === 0) return source.split("\n");
    return colorize(load().highlightAuto(source, subset).value).split("\n");
  } catch {
    return source.split("\n");
  }
}
