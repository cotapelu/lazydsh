/**
 * Session Selector Search Utilities
 *
 * Filtering, sorting, and tree building for sessions.
 * Merged: tiered fuzzy search (from top-level session-selector-search.ts)
 * + DSH-native SessionRecord type + canonicalized path keys.
 * Ported from pi-coding-agent's session-selector-search.js
 */

import { fuzzyMatch } from "@earendil-works/pi-tui";
import { realpathSync } from "node:fs";

/** Session record from DSH runtime. */
export interface SessionRecord {
  id: string;
  title: string;
  directory: string;
  archived: boolean;
  pinned: boolean;
  /** Epoch millis of the last event; used for age and relevance ordering. */
  modified: number;
  messageCount: number;
  cwd?: string;
  parentSessionId?: string;
}

export type SessionScope = "all" | "current";
export type SessionSortMode = "threaded" | "recent" | "relevance";
export type SessionNameFilter = "all" | "named";

/** Check if a session has a name set. */
export function hasSessionName(session: SessionRecord): boolean {
  return !!session.title && session.title.trim() !== "";
}

/** Format session date relative to now. */
export function formatSessionDate(modified: number): string {
  const now = Date.now();
  const diffMs = now - modified;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

/* ------------------------------------------------------------------ */
/* Tiered fuzzy search (ported from pi-coding-agent)                  */
/* ------------------------------------------------------------------ */

function normalizeWhitespaceLower(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Match tiers, best first */
const TIER_NAME = 0; // query text appears in the session name
const TIER_TEXT = 1; // query text appears in the session id or directory
const TIER_FUZZY = 2; // query characters appear scattered in the session name or directory
const TIER_WEIGHT = 1_000_000;

function tierScore(tier: number, score = 0): number {
  return tier * TIER_WEIGHT + score;
}

/** Exact (case-insensitive) text match. */
function matchLiteralToken(session: SessionRecord, value: string): number | undefined {
  const name = session.title?.toLowerCase() ?? "";
  if (name.includes(value)) return tierScore(TIER_NAME, fuzzyMatch(value, name).score);
  if (session.id.toLowerCase().includes(value)) return tierScore(TIER_TEXT);
  if (session.directory.toLowerCase().includes(value)) return tierScore(TIER_TEXT);
  return undefined;
}

function matchFuzzyToken(session: SessionRecord, value: string): number | undefined {
  const literal = matchLiteralToken(session, value.toLowerCase());
  if (literal !== undefined) return literal;
  let best: number | undefined;
  for (const field of [session.title ?? "", session.directory]) {
    const m = fuzzyMatch(value, field);
    if (m.matches && (best === undefined || m.score < best)) best = m.score;
  }
  return best === undefined ? undefined : tierScore(TIER_FUZZY, best);
}

function matchPhraseToken(session: SessionRecord, phrase: string): number | undefined {
  const name = normalizeWhitespaceLower(session.title ?? "");
  if (name.includes(phrase)) return tierScore(TIER_NAME, fuzzyMatch(phrase, name).score);
  if (session.id.toLowerCase().includes(phrase)) return tierScore(TIER_TEXT);
  if (normalizeWhitespaceLower(session.directory).includes(phrase)) return tierScore(TIER_TEXT);
  return undefined;
}

function matchRegex(session: SessionRecord, regex: RegExp): number | undefined {
  if (session.title && regex.test(session.title)) return tierScore(TIER_NAME);
  if (regex.test(session.id) || regex.test(session.directory)) return tierScore(TIER_TEXT);
  return undefined;
}

export interface ParsedSearchQuery {
  mode: "tokens" | "regex";
  tokens: Array<{ kind: "fuzzy" | "phrase"; value: string }>;
  regex: RegExp | null;
  error?: string;
}

/** Parse search query into tokens (regex mode, phrase mode, fuzzy mode). */
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
  session: SessionRecord,
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

/* ------------------------------------------------------------------ */
/* Tree building (ported from pi-coding-agent)                         */
/* ------------------------------------------------------------------ */

/** Comparison key for a session file path; follows symlinks and ignores case on Windows. */
export function getSessionPathKey(path: string): string {
  let canonical = path;
  try {
    canonical = realpathSync.native(path);
  } catch {
    // Path doesn't exist or can't be resolved — use as-is.
  }
  if (process.platform === "win32") {
    return canonical.toLowerCase();
  }
  return canonical;
}

/** Filter and sort sessions based on query and options (tiered search). */
export function filterAndSortSessions(
  sessions: SessionRecord[],
  query: string,
  sortMode: "threaded" | "recent" | "relevance",
  nameFilter: "all" | "named" = "all",
): SessionRecord[] {
  const nameFiltered = nameFilter === "all" ? sessions : sessions.filter(hasSessionName);
  const trimmed = query.trim();

  if (!trimmed) return nameFiltered;

  const parsed = parseSearchQuery(query);
  if (parsed.error) return [];

  // Recent mode: filter only, keep incoming order.
  if (sortMode === "recent") {
    const filtered: SessionRecord[] = [];
    for (const s of nameFiltered) {
      const res = matchSession(s, parsed);
      if (res.matches) filtered.push(s);
    }
    return filtered;
  }

  // Relevance mode: sort by score, tie-break by modified desc.
  const scored: Array<{ session: SessionRecord; score: number }> = [];
  for (const s of nameFiltered) {
    const res = matchSession(s, parsed);
    if (!res.matches) continue;
    scored.push({ session: s, score: res.score });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.session.modified - a.session.modified;
  });
  return scored.map((r) => r.session);
}

/** Build a tree structure from sessions based on parentSessionId. */
export function buildSessionTree(sessions: SessionRecord[]): SessionTreeNode[] {
  const byPath = new Map<string, SessionTreeNode>();

  for (const session of sessions) {
    const sessionPath = getSessionPathKey(session.id);
    byPath.set(sessionPath, {
      session,
      children: [] as SessionTreeNode[],
      latestActivity: session.modified,
    });
  }

  const roots: SessionTreeNode[] = [];
  for (const session of sessions) {
    const sessionPath = getSessionPathKey(session.id);
    const node = byPath.get(sessionPath);
    if (node) roots.push(node);
  }

  const updateLatestActivity = (node: SessionTreeNode): number => {
    let latestActivity = node.session.modified;
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
  const sortNodes = (nodes: SessionTreeNode[]): void => {
    nodes.sort((a, b) => b.latestActivity - a.latestActivity);
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

export interface SessionTreeNode {
  session: SessionRecord;
  children: SessionTreeNode[];
  latestActivity: number;
}

/** Flatten tree into display list with tree structure metadata. */
export function flattenSessionTree(roots: SessionTreeNode[]): FlattenedSessionNode[] {
  const result: FlattenedSessionNode[] = [];
  const walk = (
    node: SessionTreeNode,
    depth: number,
    ancestorContinues: boolean[],
    isLast: boolean,
  ): void => {
    result.push({ session: node.session, depth, isLast, ancestorContinues });
    for (let i = 0; i < node.children.length; i++) {
      const childIsLast = i === node.children.length - 1;
      const continues = depth > 0 ? !isLast : false;
      walk(node.children[i], depth + 1, [...ancestorContinues, continues], childIsLast);
    }
  };
  for (let i = 0; i < roots.length; i++) {
    walk(roots[i], 0, [], i === roots.length - 1);
  }
  return result;
}

export interface FlattenedSessionNode {
  session: SessionRecord;
  depth: number;
  isLast: boolean;
  ancestorContinues: boolean[];
}
