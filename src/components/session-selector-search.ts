/**
 * Session Selector Search Utilities
 *
 * Filtering, sorting, and tree building for sessions.
 * Ported from pi-coding-agent's session-selector-search.js
 */

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

/**
 * Filter and sort sessions for flat list display.
 */
export function filterAndSortSessions(
  sessions: SessionRecord[],
  query: string,
  sortMode: "threaded" | "recent" | "relevance",
  nameFilter: "all" | "named",
): SessionRecord[] {
  const trimmed = query.trim();
  const nameFiltered = nameFilter === "all" ? sessions : sessions.filter(hasSessionName);

  if (sortMode === "threaded" && !trimmed) {
    // Threaded mode without search returns tree structure (handled elsewhere)
    return nameFiltered;
  }

  let filtered = nameFiltered;
  if (trimmed) {
    const lowerQuery = trimmed.toLowerCase();
    filtered = filtered.filter(
      (session) =>
        session.title.toLowerCase().includes(lowerQuery) ||
        session.id.toLowerCase().includes(lowerQuery) ||
        (session.directory && session.directory.toLowerCase().includes(lowerQuery)),
    );
  }

  if (sortMode === "recent") {
    // Sort by modified date descending (most recent first)
    filtered.sort((a, b) => b.modified - a.modified);
  } else if (sortMode === "relevance" && trimmed) {
    const lowerQuery = trimmed.toLowerCase();
    // Relevance sort: exact matches first, then prefix, then substring
    const exact = filtered.filter(
      (s) => s.title.toLowerCase() === lowerQuery || s.id === lowerQuery,
    );
    const prefix = filtered.filter(
      (s) =>
        !exact.includes(s) &&
        (s.title.toLowerCase().startsWith(lowerQuery) || s.id.startsWith(lowerQuery)),
    );
    const substring = filtered.filter((s) => !exact.includes(s) && !prefix.includes(s));
    filtered = [...exact, ...prefix, ...substring];
  } else if (trimmed) {
    // Default: sort by modified date for search results
    filtered.sort((a, b) => b.modified - a.modified);
  }

  return filtered;
}

/** Comparison key for a session file path; follows symlinks and ignores case on Windows. */
export function getSessionPathKey(path: string): string {
  // Simple implementation - in pi-coding-agent this uses canonicalizePath and getPathComparisonKey
  return path;
}

/**
 * Build a tree structure from sessions.
 * Since DSH sessions don't have parentSessionId, this creates a flat tree.
 * Returns root nodes sorted by modified date (descending).
 */
export function buildSessionTree(sessions: SessionRecord[]): SessionTreeNode[] {
  const byPath = new Map<string, SessionTreeNode>();

  for (const session of sessions) {
    const sessionPath = getSessionPathKey(session.id);
    byPath.set(sessionPath, {
      session,
      children: [],
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

/**
 * Flatten tree into display list with tree structure metadata.
 */
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

export interface FlattenedSessionNode {
  session: SessionRecord;
  depth: number;
  isLast: boolean;
  ancestorContinues: boolean[];
}
