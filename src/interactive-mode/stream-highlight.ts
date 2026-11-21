/**
 * Incremental syntax highlighting for code that is still streaming in.
 */

/** One-shot highlighter: returns one ANSI-styled string per input line. */
export type HighlightFn = (code: string, language?: string) => string[];

interface QuoteRule {
  open: string;
  close: string;
  /** Escape character, if the language uses one. */
  escape?: string;
  /** The closing delimiter is escaped by doubling it (SQL, YAML). */
  doubled?: boolean;
  /** The token may continue on the next line. */
  multiline?: boolean;
}

interface LanguageRules {
  lineComments: string[];
  blockComments: [open: string, close: string][];
  quotes: QuoteRule[];
}

interface ScanState {
  /** Closing delimiter of the block comment we are inside, if any. */
  block?: string;
  /** Quote rule of the multi-line string we are inside, if any. */
  quote?: QuoteRule;
}

/* ------------------------------------------------------------------ */
/* Language rules                                                      */
/* ------------------------------------------------------------------ */

const C_STYLE: LanguageRules = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: [
    { open: '"', close: '"', escape: "\\" },
    { open: "'", close: "'", escape: "\\" },
  ],
};

const JAVASCRIPT: LanguageRules = {
  ...C_STYLE,
  quotes: [...C_STYLE.quotes, { open: "`", close: "`", escape: "\\", multiline: true }],
};

const GO: LanguageRules = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: [
    { open: '"', close: '"', escape: "\\" },
    { open: "'", close: "'", escape: "\\" },
    { open: "`", close: "`", multiline: true },
  ],
};

const RUST: LanguageRules = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  // Char literals are skipped on purpose: `'a` lifetimes would otherwise be
  // mistaken for an unterminated string and hide the rest of the line.
  quotes: [{ open: '"', close: '"', escape: "\\" }],
};

const PYTHON: LanguageRules = {
  lineComments: ["#"],
  blockComments: [],
  quotes: [
    { open: '"""', close: '"""', escape: "\\", multiline: true },
    { open: "'''", close: "'''", escape: "\\", multiline: true },
    { open: '"', close: '"', escape: "\\" },
    { open: "'", close: "'", escape: "\\" },
  ],
};

const SHELL: LanguageRules = {
  lineComments: ["#"],
  blockComments: [],
  quotes: [
    { open: "'", close: "'", multiline: true },
    { open: '"', close: '"', escape: "\\", multiline: true },
    { open: "`", close: "`", escape: "\\", multiline: true },
  ],
};

const JSON_RULES: LanguageRules = {
  lineComments: [],
  blockComments: [],
  quotes: [{ open: '"', close: '"', escape: "\\" }],
};

const YAML: LanguageRules = {
  lineComments: ["#"],
  blockComments: [],
  quotes: [
    { open: "'", close: "'", doubled: true, multiline: true },
    { open: '"', close: '"', escape: "\\", multiline: true },
  ],
};

const TOML: LanguageRules = {
  lineComments: ["#"],
  blockComments: [],
  quotes: [
    { open: '"""', close: '"""', escape: "\\", multiline: true },
    { open: "'''", close: "'''", multiline: true },
    { open: '"', close: '"', escape: "\\" },
    { open: "'", close: "'" },
  ],
};

const HTML: LanguageRules = {
  lineComments: [],
  blockComments: [["<!--", "-->"]],
  quotes: [
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};

const CSS: LanguageRules = {
  lineComments: [],
  blockComments: [["/*", "*/"]],
  quotes: [
    { open: '"', close: '"', escape: "\\" },
    { open: "'", close: "'", escape: "\\" },
  ],
};

const SQL: LanguageRules = {
  lineComments: ["--"],
  blockComments: [["/*", "*/"]],
  quotes: [
    { open: "'", close: "'", doubled: true, multiline: true },
    { open: '"', close: '"', doubled: true, multiline: true },
  ],
};

const RUBY: LanguageRules = {
  lineComments: ["#"],
  blockComments: [],
  quotes: [
    { open: '"', close: '"', escape: "\\", multiline: true },
    { open: "'", close: "'", escape: "\\", multiline: true },
  ],
};

const LUA: LanguageRules = {
  lineComments: ["--"],
  blockComments: [["--[[", "]]"]],
  quotes: [
    { open: '"', close: '"', escape: "\\" },
    { open: "'", close: "'", escape: "\\" },
  ],
};

const HASKELL: LanguageRules = {
  lineComments: ["--"],
  blockComments: [["{-", "-}"]],
  quotes: [{ open: '"', close: '"', escape: "\\" }],
};

const PHP: LanguageRules = {
  lineComments: ["//", "#"],
  blockComments: [["/*", "*/"]],
  quotes: [
    { open: '"', close: '"', escape: "\\", multiline: true },
    { open: "'", close: "'", escape: "\\", multiline: true },
  ],
};

const CANONICAL: Record<string, string> = {
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
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  yml: "yaml",
  html: "xml",
  htm: "xml",
  svg: "xml",
  vue: "xml",
  cs: "csharp",
  "c#": "csharp",
  "c++": "cpp",
  cc: "cpp",
  h: "c",
  hpp: "cpp",
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
  ini: "toml",
  conf: "toml",
};

const LANGUAGE_RULES = new Map<string, LanguageRules>([
  ["typescript", JAVASCRIPT],
  ["javascript", JAVASCRIPT],
  ["python", PYTHON],
  ["rust", RUST],
  ["go", GO],
  ["bash", SHELL],
  ["json", JSON_RULES],
  ["yaml", YAML],
  ["toml", TOML],
  ["xml", HTML],
  ["css", CSS],
  ["sql", SQL],
  ["java", C_STYLE],
  ["c", C_STYLE],
  ["cpp", C_STYLE],
  ["csharp", C_STYLE],
  ["kotlin", C_STYLE],
  ["swift", C_STYLE],
  ["scala", C_STYLE],
  ["dart", C_STYLE],
  ["groovy", C_STYLE],
  ["objectivec", C_STYLE],
  ["ruby", RUBY],
  ["lua", LUA],
  ["haskell", HASKELL],
  ["php", PHP],
]);

function rulesFor(language: string | undefined): LanguageRules | undefined {
  if (language === undefined) return undefined;
  const name =
    language
      .trim()
      .toLowerCase()
      .split(/[\s,;]/)[0] ?? "";
  if (name === "") return undefined;
  return LANGUAGE_RULES.get(CANONICAL[name] ?? name);
}

/* ------------------------------------------------------------------ */
/* Line scanner                                                        */
/* ------------------------------------------------------------------ */

function scanLine(line: string, state: ScanState, rules: LanguageRules): ScanState {
  let block = state.block;
  let quote = state.quote;
  let index = 0;

  while (index < line.length) {
    if (block !== undefined) {
      const close = line.indexOf(block, index);
      if (close < 0) return { block };
      index = close + block.length;
      block = undefined;
      continue;
    }

    if (quote !== undefined) {
      const rule = quote;
      let cursor = index;
      let closed = false;
      while (cursor < line.length) {
        if (rule.escape !== undefined && line[cursor] === rule.escape) {
          cursor += 2;
          continue;
        }
        if (line.startsWith(rule.close, cursor)) {
          if (rule.doubled && line.startsWith(rule.close, cursor + rule.close.length)) {
            cursor += rule.close.length * 2;
            continue;
          }
          cursor += rule.close.length;
          closed = true;
          break;
        }
        cursor += 1;
      }
      // An unterminated single-line string ends at EOL, matching highlight.js
      // with `ignoreIllegals`.
      if (!closed) return rule.multiline ? { quote: rule } : {};
      quote = undefined;
      index = cursor;
      continue;
    }

    if (rules.lineComments.some((prefix) => line.startsWith(prefix, index))) return {};

    const blockOpen = rules.blockComments.find(([open]) => line.startsWith(open, index));
    if (blockOpen !== undefined) {
      block = blockOpen[1];
      index += blockOpen[0].length;
      continue;
    }

    const quoteOpen = rules.quotes.find((rule) => line.startsWith(rule.open, index));
    if (quoteOpen !== undefined) {
      quote = quoteOpen;
      index += quoteOpen.open.length;
      continue;
    }

    index += 1;
  }

  if (block !== undefined) return { block };
  if (quote !== undefined) return { quote };
  return {};
}

/* ------------------------------------------------------------------ */
/* Incremental highlighter                                             */
/* ------------------------------------------------------------------ */

export interface IncrementalHighlighterOptions {
  /**
   * Unstable regions longer than this (an unterminated block comment, for
   * instance) are refreshed at most once per `maxRefreshMs`. Between refreshes
   * the new lines are emitted unstyled so the text still streams.
   */
  maxPendingLines?: number;
  maxRefreshMs?: number;
}

export interface IncrementalHighlighterStats {
  /** Characters handed to the underlying highlighter over the session. */
  charactersHighlighted: number;
  /** Lines handed to the underlying highlighter over the session. */
  linesHighlighted: number;
  /** `highlight()` calls served from the memo without touching the lexer. */
  cacheHits: number;
}

interface RefreshCache {
  text: string;
  lines?: string[];
  nextAt: number;
}

/**
 * Languages without rules (or without a language tag at all) still use the
 * one-shot highlighter. Once such a snippet is longer than this, refreshes are
 * rate limited and the extra lines are emitted unstyled until the next refresh.
 */
const OPAQUE_REFRESH_LINES = 48;

/**
 * Highlights a growing code string by re-tokenizing only its unstable tail.
 *
 * The class is stateful: call `reset()` when the code block being streamed is
 * replaced by a different one (the first call after a rewrite resets itself).
 */
export class IncrementalHighlighter {
  private readonly base: HighlightFn;
  private readonly maxPendingLines: number;
  private readonly maxRefreshMs: number;

  private language?: string;
  private rules?: LanguageRules;
  private code = "";
  private offsets: number[] = [0];
  private scanOffset = 0;
  private state: ScanState = {};
  /** Number of leading complete lines whose lexer state is neutral. */
  private safeLine = 0;
  /** Number of leading lines already highlighted and frozen. */
  private frozen = 0;
  private frozenLines: string[] = [];

  private pending: RefreshCache = { text: "", nextAt: 0 };
  private opaque: RefreshCache = { text: "", nextAt: 0 };

  private memoCode?: string;
  private memoOutput?: string[];

  readonly stats: IncrementalHighlighterStats = {
    charactersHighlighted: 0,
    linesHighlighted: 0,
    cacheHits: 0,
  };

  constructor(base: HighlightFn, options: IncrementalHighlighterOptions = {}) {
    this.base = base;
    this.maxPendingLines = options.maxPendingLines ?? 400;
    this.maxRefreshMs = options.maxRefreshMs ?? 200;
  }

  reset(language?: string): void {
    this.language = language;
    this.rules = rulesFor(language);
    this.code = "";
    this.offsets = [0];
    this.scanOffset = 0;
    this.state = {};
    this.safeLine = 0;
    this.frozen = 0;
    this.frozenLines = [];
    this.pending = { text: "", nextAt: 0 };
    this.opaque = { text: "", nextAt: 0 };
    this.memoCode = undefined;
    this.memoOutput = undefined;
  }

  highlight(code: string, language?: string): string[] {
    if (language !== this.language || !code.startsWith(this.code)) this.reset(language);

    if (this.memoCode === code && this.memoOutput !== undefined) {
      this.stats.cacheHits += 1;
      return this.memoOutput;
    }

    this.code = code;

    // Unknown languages: no state to carry, so fall back to the whole-snippet
    // path. It is correct, just not linear, so long snippets are throttled.
    if (this.rules === undefined) {
      const output = this.refresh(code, language, this.opaque, OPAQUE_REFRESH_LINES);
      this.memoCode = code;
      this.memoOutput = output;
      return output;
    }

    this.scan(this.rules);

    if (this.safeLine > this.frozen) {
      const stable = this.sliceLines(this.frozen, this.safeLine);
      this.frozenLines.push(...this.run(stable, language));
      this.frozen = this.safeLine;
      this.pending = { text: "", nextAt: 0 };
    }

    const pending = this.sliceLines(this.safeLine, this.offsets.length);
    const tail = this.refresh(pending, language, this.pending, this.maxPendingLines);
    const output = this.frozenLines.concat(tail);

    this.memoCode = code;
    this.memoOutput = output;
    return output;
  }

  /** Absolute character offset of the first unsafe line (for debugging). */
  get unstableOffset(): number {
    return this.offsets[this.safeLine] ?? this.code.length;
  }

  private scan(rules: LanguageRules): void {
    let cursor = this.scanOffset;
    for (;;) {
      const newline = this.code.indexOf("\n", cursor);
      if (newline < 0) break;

      const raw = this.code.slice(cursor, newline);
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      this.state = scanLine(line, this.state, rules);

      cursor = newline + 1;
      this.offsets.push(cursor);

      if (this.state.block === undefined && this.state.quote === undefined) {
        this.safeLine = this.offsets.length - 1;
      }
    }
    this.scanOffset = cursor;
  }

  /** Slice whole lines `[from, to)`; `to` may point at the partial last line. */
  private sliceLines(from: number, to: number): string {
    const start = this.offsets[from] ?? this.code.length;
    const end = to < this.offsets.length ? (this.offsets[to] ?? 0) - 1 : this.code.length;
    return this.code.slice(start, Math.max(start, end));
  }

  /**
   * Highlights `text` unless a slow refresh is still cooling down, in which case
   * the previous lines are kept and the new ones are appended unstyled so the
   * text itself never stalls behind the lexer.
   */
  private refresh(
    text: string,
    language: string | undefined,
    cache: RefreshCache,
    throttleFrom: number,
  ): string[] {
    if (text === cache.text && cache.lines !== undefined) return cache.lines;

    const lines = text.split("\n");
    if (lines.length > throttleFrom && Date.now() < cache.nextAt && cache.lines !== undefined) {
      return cache.lines.concat(lines.slice(cache.lines.length));
    }

    const started = Date.now();
    const output = this.run(text, language);
    cache.nextAt = started + Math.min(this.maxRefreshMs, Math.max(16, (Date.now() - started) * 4));
    cache.text = text;
    cache.lines = output;
    return output;
  }

  private run(text: string, language?: string): string[] {
    this.stats.charactersHighlighted += text.length;
    this.stats.linesHighlighted += text === "" ? 1 : text.split("\n").length;
    return this.base(text, language);
  }
}
