/**
 * Footer Component
 *
 * Context bar showing: pwd, git branch, tokens, cache hit rate, cost,
 * context usage %, model, thinking level, routed model, extension statuses.
 * Ported from pi-coding-agent's FooterComponent.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";
import { formatTokens, formatCwdForFooter, FooterDataProvider } from "./footer-data-provider.ts";
import type { AccountLimits } from "../../../utils/limits.ts";

interface FooterOptions {
  session: {
    sessionManager: {
      getCwd(): string;
      getSessionId(): string;
      getLeafId(): string;
      getEntryCount(): number;
      getSessionName(): string | undefined;
      getEntries(): any[];
    };
    routedModel?: { model: any; thinkingLevel?: string } | undefined;
    model?: { provider: string; id: string; reasoning?: any; contextWindow?: number } | undefined;
    thinkingLevel?: string;
    autoCompactionEnabled?: boolean;
    getContextUsage(): { percent: number | null; contextWindow?: number } | undefined;
    limits?: AccountLimits;
  };
  footerData: FooterDataProvider;
}

/**
 * Footer component rendering a two-line status bar:
 * Line 1: pwd (git branch) • session name
 * Line 2: tokens ↑↓ R/W CH% $cost context% model thinking
 */
export class FooterComponent {
  private session: FooterOptions["session"];
  private footerData: FooterDataProvider;
  private autoCompactEnabled = true;
  private sessionStats: {
    session: FooterOptions["session"];
    sessionId: string;
    leafId: string;
    entryCount: number;
    limitsModel: FooterOptions["session"]["model"];
    usageTotals: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      cost: number;
    };
    latestCacheHitRate: number | undefined;
    contextUsage: { percent: number | null; contextWindow?: number } | undefined;
  } | null = null;

  constructor(options: FooterOptions) {
    this.session = options.session;
    this.footerData = options.footerData;
  }

  setSession(session: FooterOptions["session"]): void {
    this.session = session;
  }

  setAutoCompactEnabled(enabled: boolean): void {
    this.autoCompactEnabled = enabled;
  }

  invalidate(): void {
    this.sessionStats = null;
  }

  dispose(): void {
    // No persistent resources to clean up
  }

  /** Compute session stats with caching */
  private getSessionStats(): NonNullable<typeof this.sessionStats> {
    const sessionManager = this.session.sessionManager;
    const entryCount = sessionManager.getEntryCount();
    const sessionId = sessionManager.getSessionId();
    const leafId = sessionManager.getLeafId();
    const limitsModel = this.session.routedModel?.model ?? this.session.model;
    const cached = this.sessionStats;

    if (
      cached &&
      cached.session === this.session &&
      cached.sessionId === sessionId &&
      cached.leafId === leafId &&
      cached.entryCount === entryCount &&
      cached.limitsModel === limitsModel
    ) {
      return cached;
    }

    // Calculate cumulative usage from ALL session entries
    const usageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
    let latestCacheHitRate: number | undefined;

    for (const entry of sessionManager.getEntries()) {
      if (entry.type === "usage") {
        usageTotals.input += entry.usage.input ?? 0;
        usageTotals.output += entry.usage.output ?? 0;
        usageTotals.cacheRead += entry.usage.cacheRead ?? 0;
        usageTotals.cacheWrite += entry.usage.cacheWrite ?? 0;
        usageTotals.cost += entry.usage.cost ?? 0;
        const latestPromptTokens =
          (entry.usage.input ?? 0) + (entry.usage.cacheRead ?? 0) + (entry.usage.cacheWrite ?? 0);
        if (latestPromptTokens > 0) {
          latestCacheHitRate = ((entry.usage.cacheRead ?? 0) / latestPromptTokens) * 100;
        }
      } else if (entry.type === "message" && entry.message.role === "assistant") {
        usageTotals.input += entry.message.usage?.input ?? 0;
        usageTotals.output += entry.message.usage?.output ?? 0;
        usageTotals.cacheRead += entry.message.usage?.cacheRead ?? 0;
        usageTotals.cacheWrite += entry.message.usage?.cacheWrite ?? 0;
        usageTotals.cost += entry.message.usage?.cost ?? 0;
        const latestPromptTokens =
          (entry.message.usage?.input ?? 0) +
          (entry.message.usage?.cacheRead ?? 0) +
          (entry.message.usage?.cacheWrite ?? 0);
        if (latestPromptTokens > 0) {
          latestCacheHitRate = ((entry.message.usage?.cacheRead ?? 0) / latestPromptTokens) * 100;
        }
      } else if (
        entry.type === "message" &&
        entry.message.role === "toolResult" &&
        entry.message.usage
      ) {
        usageTotals.input += entry.message.usage.input ?? 0;
        usageTotals.output += entry.message.usage.output ?? 0;
        usageTotals.cacheRead += entry.message.usage.cacheRead ?? 0;
        usageTotals.cacheWrite += entry.message.usage.cacheWrite ?? 0;
        usageTotals.cost += entry.message.usage.cost ?? 0;
      } else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
        usageTotals.input += entry.usage.input ?? 0;
        usageTotals.output += entry.usage.output ?? 0;
        usageTotals.cacheRead += entry.usage.cacheRead ?? 0;
        usageTotals.cacheWrite += entry.usage.cacheWrite ?? 0;
        usageTotals.cost += entry.usage.cost ?? 0;
      }
    }

    // Context usage from session
    const contextUsage = this.session.getContextUsage();

    this.sessionStats = {
      session: this.session,
      sessionId,
      leafId,
      entryCount,
      limitsModel,
      usageTotals,
      latestCacheHitRate,
      contextUsage,
    };
    return this.sessionStats;
  }

  render(width: number): string[] {
    const state = this.session;
    const { usageTotals, latestCacheHitRate, contextUsage } = this.getSessionStats();
    const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
    const contextPercentValue = contextUsage?.percent ?? 0;
    const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";

    // Line 1: pwd + git branch + session name
    let pwd = formatCwdForFooter(this.footerData.getCwd(), homedir());
    const branch = this.footerData.getGitBranch();
    if (branch) {
      pwd = `${pwd} (${branch})`;
    }
    const sessionName = this.session.sessionManager.getSessionName();
    if (sessionName) {
      pwd = `${pwd} ${theme.fg("dim", "•")} ${sessionName}`;
    }
    const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));

    // Line 2: tokens + context % + model
    const statsParts: string[] = [];

    if (usageTotals.input > 0) statsParts.push(`↑${formatTokens(usageTotals.input)}`);
    if (usageTotals.output > 0) statsParts.push(`↓${formatTokens(usageTotals.output)}`);
    if (usageTotals.cacheRead > 0) statsParts.push(`R${formatTokens(usageTotals.cacheRead)}`);
    if (usageTotals.cacheWrite > 0) statsParts.push(`W${formatTokens(usageTotals.cacheWrite)}`);
    if (
      (usageTotals.cacheRead > 0 || usageTotals.cacheWrite > 0) &&
      latestCacheHitRate !== undefined
    ) {
      statsParts.push(`CH${latestCacheHitRate.toFixed(1)}%`);
    }

    // Cost (subscription-aware)
    const usingSubscription = state.limits?.plan !== undefined;
    if (usageTotals.cost > 0 || usingSubscription) {
      const costStr = `$${usageTotals.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
      statsParts.push(costStr);
    }

    // Context percentage with color coding
    const autoIndicator = this.autoCompactEnabled ? " (auto)" : "";
    const contextPercentDisplay =
      contextPercent === "?"
        ? `?/${formatTokens(contextWindow)}${autoIndicator}`
        : `${contextPercent}%/${formatTokens(contextWindow)}${autoIndicator}`;

    let contextPercentStr: string;
    if (contextPercentValue > 90) {
      contextPercentStr = theme.fg("error", contextPercentDisplay);
    } else if (contextPercentValue > 70) {
      contextPercentStr = theme.fg("warning", contextPercentDisplay);
    } else {
      contextPercentStr = contextPercentDisplay;
    }
    statsParts.push(contextPercentStr);

    // Experimental features indicator
    // if (areExperimentalFeaturesEnabled()) {
    //   statsParts.push(`${theme.fg("dim", "•")} ${theme.bold(theme.fg("warning", "xp"))}`);
    // }

    let statsLeft = statsParts.join(" ");

    // Right side: model name + thinking level + routed model
    const modelName = state.model?.id || "no-model";
    let statsLeftWidth = visibleWidth(statsLeft);

    // Truncate left if too wide
    if (statsLeftWidth > width) {
      statsLeft = truncateToWidth(statsLeft, width, "...");
      statsLeftWidth = visibleWidth(statsLeft);
    }

    const minPadding = 2;

    // Build right side with thinking level
    let rightSideWithoutProvider = modelName;
    if (state.model?.reasoning) {
      const thinkingLevel = state.thinkingLevel || "off";
      rightSideWithoutProvider =
        thinkingLevel === "off"
          ? `${modelName} ${theme.fg("dim", "• thinking off")}`
          : `${modelName} ${theme.fg("dim", "•")} ${thinkingLevel}`;
    }

    // Routed model indicator
    const routed = state.routedModel;
    if (routed) {
      const level = routed.thinkingLevel ? ` ${theme.fg("dim", "•")} ${routed.thinkingLevel}` : "";
      rightSideWithoutProvider += ` ${theme.fg("dim", "→")} ${routed.model.id}${level}`;
    }

    // Prepend provider if multiple available and space permits
    let rightSide = rightSideWithoutProvider;
    if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
      rightSide = `${theme.fg("dim", "(")}${state.model.provider}${theme.fg("dim", ")")} ${rightSideWithoutProvider}`;
      if (statsLeftWidth + minPadding + visibleWidth(rightSide) > width) {
        rightSide = rightSideWithoutProvider;
      }
    }

    const rightSideWidth = visibleWidth(rightSide);
    const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

    let statsLine: string;
    if (totalNeeded <= width) {
      const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
      statsLine = statsLeft + padding + rightSide;
    } else {
      const availableForRight = width - statsLeftWidth - minPadding;
      if (availableForRight > 0) {
        const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
        const truncatedRightWidth = visibleWidth(truncatedRight);
        const padding = " ".repeat(Math.max(0, width - statsLeftWidth - truncatedRightWidth));
        statsLine = statsLeft + padding + truncatedRight;
      } else {
        statsLine = statsLeft;
      }
    }

    // Apply dim to parts separately to preserve color codes
    const dimStatsLeft = theme.fg("dim", statsLeft);
    const remainder = statsLine.slice(statsLeft.length); // padding + rightSide
    const dimRemainder = theme.fg("dim", remainder);

    // Extension statuses line (if any)
    const extensionStatuses = this.footerData.getExtensionStatuses();
    const lines = [pwdLine, dimStatsLeft + dimRemainder];

    if (extensionStatuses.size > 0) {
      const sortedStatuses = Array.from(extensionStatuses.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, text]) => sanitizeStatusText(text))
        .filter((text) => text !== "");
      if (sortedStatuses.length > 0) {
        const statusLine = sortedStatuses.join(" ");
        lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
      }
    }

    return lines;
  }
}

// Helper for homedir (inline to avoid circular import)
function homedir(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}
