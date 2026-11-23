/**
 * Approval grants
 *
 * DSH's approval seam only speaks `allowed-once`, `rejected`, `cancelled`, and
 * `unavailable` — it has no persistent grant. The "always allow" choice the TUI
 * offers is therefore enforced here: the tool name is remembered for the life of
 * the runtime, and every later request for that tool is answered without asking
 * the human again. The memory never outlives the process, which is exactly what
 * the session-scoped wording on the panel promises.
 */

import type { ApprovalOutcome } from "../interfaces.ts";

/** Tool names the user told lazydsh to always allow, per runtime. */
export class ApprovalGrants {
  private readonly granted = new Set<string>();

  /** True when this tool was already granted for the session. */
  has(toolName: string): boolean {
    return this.granted.has(toolName);
  }

  /** Tool names currently granted, for notices and tests. */
  get tools(): readonly string[] {
    return [...this.granted];
  }

  /** Record a session grant; returns the outcome to report upstream. */
  allow(toolName: string): "allowed-once" {
    this.granted.add(toolName);
    return "allowed-once";
  }

  clear(): void {
    this.granted.clear();
  }
}

/**
 * The outcome to report back to DSH for one UI choice.
 *
 * Returns `allowed-once` for an `allowed-always` choice after recording the
 * grant, so the caller only ever forwards DSH's own vocabulary upstream.
 */
export function resolveApprovalOutcome(
  choice: ApprovalOutcome,
  grants: ApprovalGrants,
  toolName: string,
): "allowed-once" | "rejected" | "cancelled" {
  if (choice === "allowed-always") return grants.allow(toolName);
  return choice;
}
