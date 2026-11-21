/**
 * Session Selector Search Utilities
 *
 * Fuzzy search, filtering, and tree building for sessions.
 * Ported from pi-coding-agent's session-selector-search.js.
 */

import { fuzzyMatch } from "@earendil-works/pi-tui";

function normalizeWhitespaceLower(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Match tiers, best first */
const TIER_NAME = 0; // query text appears in the session name
const TIER_TEXT = 1; // query text appears in the session id, messages, or cwd
const TIER_FUZZY = 2; // query characters appear scattered in the session name or cwd
const TIER_WEIGHT = 1_000_000;

/** Lowercased message text per session */
const messageTextCache = new WeakMap<any, { source: string; lower: string; normalized?: string }>();

function getMessageText(session: any) {
  let cached = messageTextCache.get(session);
  if (!cached || cached.source !== session.allMessagesText) {
    cached = { source: session.allMessagesText, lower: session.allMessagesText.toLowerCase() };
    messageTextCache.set(session, cached);
  }
  return cached;
}

function getNormalizedMessageText(session: any): string {
  const cached = getMessageText(session);
  cached.normalized ??= cached.lower.replace(/\s+/g, " ").trim();
  return cached.normalized;
}

function tierScore(tier: number, score = 0): number {
  return tier * TIER_WEIGHT + score;
}

/** Exact (case-insensitive) text match */
function matchLiteralToken(session: any, value: string): number | undefined {
  const name = session.name?.toLowerCase() ?? "";
  if (name.includes(value)) return tierScore(TIER_NAME, fuzzyMatch(value, name).score);
  if (session.id.toLowerCase().includes(value)) return tierScore(TIER_TEXT);
  if (getMessageText(session).lower.includes(value)) return tierScore(TIER_TEXT);
  if (session.cwd.toLowerCase().includes(value)) return tierScore(TIER_TEXT);
  return undefined;
}

function matchFuzzyToken(session: any, value: string): number | undefined {
  const literal = matchLiteralToken(session, value.toLowerCase());
  if (literal !== undefined) return literal;
  let best: number | undefined;
  for (const field of [session.name ?? "", session.cwd]) {
    const m = fuzzyMatch(value, field);
    if (m.matches && (best === undefined || m.score < best)) best = m.score;
  }
  return best === undefined ? undefined : tierScore(TIER_FUZZY, best);
}

function matchPhraseToken(session: any, phrase: string): number | undefined {
  const name = normalizeWhitespaceLower(session.name ?? "");
  if (name.includes(phrase)) return tierScore(TIER_NAME, fuzzyMatch(phrase, name).score);
  if (session.id.toLowerCase().includes(phrase)) return tierScore(TIER_TEXT);
  if (getNormalizedMessageText(session).includes(phrase)) return tierScore(TIER_TEXT);
  if (normalizeWhitespaceLower(session.cwd).includes(phrase)) return tierScore(TIER_TEXT);
  return undefined;
}

function matchRegex(session: any, regex: RegExp): number | undefined {
  if (session.name && regex.test(session.name)) return tierScore(TIER_NAME);
  if (regex.test(session.id) || regex.test(session.allMessagesText) || regex.test(session.cwd)) {
    return tierScore(TIER_TEXT);
  }
  return undefined;
}

export function hasSessionName(session: any): boolean {
  return Boolean(session.name?.trim());
}

function matchesNameFilter(session: any, filter: string): boolean {
  if (filter === "all") return true;
  return hasSessionName(session);
}

export interface ParsedSearchQuery {
  mode: "tokens" | "regex";
  tokens: Array<{ kind: "fuzzy" | "phrase"; value: string }>;
  regex: RegExp | null;
  error?: string;
}

/** Parse search query into tokens */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmed = query.trim();
  if (!trimmed) {
    return { mode: "tokens", tokens: [], regex: null };
  }

  // Regex mode: re:<pattern>
  if (trimmed.startsWith("re:")) {
    const pattern = trimmed.slice(3).trim();
    if (!pattern) {
      return { mode: "regex", tokens: [], regex: null, error: "Empty regex" };
    }
    try {
      return { mode: "regex", tokens: [], regex: new RegExp(pattern, "i") };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { mode: "regex", tokens: [], regex: null, error: msg };
    }
  }

  // Token mode with quote support
  const tokens: Array<{ kind: "fuzzy" | "phrase"; value: string }> = [];
  let buf = "";
  let inQuote = false;
  let hadUnclosedQuote = false;

  const flush = (kind: "fuzzy" | "phrase") => {
    const v = buf.trim();
    buf = "";
    if (!v) return;
    tokens.push({ kind, value: v });
  };

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      if (inQuote) {
        flush("phrase");
        inQuote = false;
      } else {
        flush("fuzzy");
        inQuote = true;
      }
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      flush("fuzzy");
      continue;
    }
    buf += ch;
  }
  if (inQuote) {
    hadUnclosedQuote = true;
  }

  // If quotes were unbalanced, fall back to plain whitespace tokenization
  if (hadUnclosedQuote) {
    return {
      mode: "tokens",
      tokens: trimmed
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => ({ kind: "fuzzy", value: t })),
      regex: null,
    };
  }
  flush(inQuote ? "phrase" : "fuzzy");
  return { mode: "tokens", tokens, regex: null };
}

/** Match a session against a parsed query */
export function matchSession(
  session: any,
  parsed: ParsedSearchQuery,
): { matches: boolean; score: number } {
  if (parsed.mode === "regex") {
    if (!parsed.regex) return { matches: false, score: 0 };
    const score = matchRegex(session, parsed.regex);
    return score === undefined ? { matches: false, score: 0 } : { matches: true, score };
  }

  let totalScore = 0;
  for (const token of parsed.tokens) {
    let score: number | undefined;
    if (token.kind === "phrase") {
      const phrase = normalizeWhitespaceLower(token.value);
      if (!phrase) continue;
      score = matchPhraseToken(session, phrase);
    } else {
      score = matchFuzzyToken(session, token.value);
    }
    if (score === undefined) return { matches: false, score: 0 };
    totalScore += score;
  }
  return { matches: true, score: totalScore };
}

/** Filter and sort sessions based on query and options */
export function filterAndSortSessions(
  sessions: any[],
  query: string,
  sortMode: "threaded" | "recent" | "relevance",
  nameFilter: "all" | "named" = "all",
): any[] {
  const nameFiltered =
    nameFilter === "all"
      ? sessions
      : sessions.filter((session) => matchesNameFilter(session, nameFilter));
  const trimmed = query.trim();

  if (!trimmed) return nameFiltered;

  const parsed = parseSearchQuery(query);
  if (parsed.error) return [];

  // Recent mode: filter only, keep incoming order
  if (sortMode === "recent") {
    const filtered: any[] = [];
    for (const s of nameFiltered) {
      const res = matchSession(s, parsed);
      if (res.matches) filtered.push(s);
    }
    return filtered;
  }

  // Relevance mode: sort by score, tie-break by modified desc
  const scored: Array<{ session: any; score: number }> = [];
  for (const s of nameFiltered) {
    const res = matchSession(s, parsed);
    if (!res.matches) continue;
    scored.push({ session: s, score: res.score });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.session.modified.getTime() - a.session.modified.getTime();
  });
  return scored.map((r) => r.session);
}

/** Build a tree structure from sessions based on parentSessionPath */
export function buildSessionTree(sessions: any[]): any[] {
  const byPath = new Map<string, any>();

  for (const session of sessions) {
    const sessionPath = getSessionPathKey(session.path);
    byPath.set(sessionPath, {
      session,
      children: [] as any[],
      latestActivity: session.modified.getTime(),
    });
  }

  const roots: any[] = [];
  for (const session of sessions) {
    const sessionPath = getSessionPathKey(session.path);
    const node = byPath.get(sessionPath);
    const parentPath = session.parentSessionPath
      ? getSessionPathKey(session.parentSessionPath)
      : undefined;
    if (parentPath && byPath.has(parentPath)) {
      byPath.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const updateLatestActivity = (node: any): number => {
    let latestActivity = node.session.modified.getTime();
    for (const child of node.children) {
      latestActivity = Math.max(latestActivity, updateLatestActivity(child));
    }
    node.latestActivity = latestActivity;
    return latestActivity;
  };

  for (const root of roots) {
    updateLatestActivity(root);
  }

  // Sort children and roots by latest activity in each subtree (descending)
  const sortNodes = (nodes: any[]) => {
    nodes.sort((a, b) => b.latestActivity - a.latestActivity);
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

/** Flatten tree into display list with tree structure metadata */
export function flattenSessionTree(roots: any[]): any[] {
  const result: any[] = [];

  const walk = (node: any, depth: number, ancestorContinues: boolean[], isLast: boolean) => {
    result.push({ session: node.session, depth, isLast, ancestorContinues });
    for (let i = 0; i < node.children.length; i++) {
      const childIsLast = i === node.children.length - 1;
      // Only show continuation line for non-root ancestors
      const continues = depth > 0 ? !isLast : false;
      walk(node.children[i], depth + 1, [...ancestorContinues, continues], childIsLast);
    }
  };

  for (let i = 0; i < roots.length; i++) {
    walk(roots[i], 0, [], i === roots.length - 1);
  }

  return result;
}

/** Comparison key for a session file path; follows symlinks and ignores case on Windows */
export function getSessionPathKey(path: string): string {
  return getPathComparisonKey(canonicalizePath(path));
}

function canonicalizePath(path: string): string {
  // Resolve symlinks and normalize
  try {
    return require("node:fs").realpathSync.native(path);
  } catch {
    return path;
  }
}

function getPathComparisonKey(path: string): string {
  // On Windows, compare case-insensitively
  if (process.platform === "win32") {
    return path.toLowerCase();
  }
  return path;
}
