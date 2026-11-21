import type { AccountLimits } from "./limits.ts";
import { formatDuration } from "./format.ts";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import type { TokenUsage } from "@deepseek-ai/dsh-llm";
import {
  assistantStreamFirstTokenTime,
  lastAssistantStreamChunk,
} from "@deepseek-ai/dsh-llm/assistant-stream";
import type {
  ContextPressureProjection,
  TokenUsageProjection,
} from "@deepseek-ai/dsh-token-meter/client";

export interface SessionStats {
  totals?: TokenUsageProjection;
  context?: ContextPressureProjection;
  latest?: TokenUsage;
  latestSource?: "connection check";
  model?: { provider: string; name: string; effort?: string; maxOutput?: number };
  session?: { id: string; directory: string };
  settings?: { mode?: string; permission?: string; sandbox?: string; approval?: string };
  limits?: AccountLimits;
  generationMs?: number;
  outputTokensPerSecond?: number;
}

export function latestRequestStats(
  events: readonly SessionEvent[],
): Pick<SessionStats, "latest" | "generationMs" | "outputTokensPerSecond"> {
  const event = events.findLast(
    (item) => item.type === "assistant/message" || item.type === "assistant/attempt",
  );
  if (!event || (event.type !== "assistant/message" && event.type !== "assistant/attempt"))
    return {};
  const stream = event.data.stream;
  const latest =
    (event.type === "assistant/message" ? event.data.usage : undefined) ??
    lastAssistantStreamChunk(stream, "usage")?.usage;
  const first = assistantStreamFirstTokenTime(stream);
  const finish = stream.findLast(
    (record) => record.type === "chunk" && record.chunk.type === "finish",
  );
  const generationMs =
    first !== undefined && finish?.type === "chunk" && finish.time > first
      ? finish.time - first
      : undefined;
  return {
    latest,
    generationMs,
    outputTokensPerSecond:
      latest && generationMs !== undefined
        ? (latest.outputTokens * 1000) / generationMs
        : undefined,
  };
}

export function cacheHitRate(usage?: TokenUsage): number | undefined {
  if (!usage || usage.cacheReadTokens === undefined) return undefined;
  const input = usage.inputTokens + usage.cacheReadTokens + (usage.cacheWriteTokens ?? 0);
  return input > 0 ? (usage.cacheReadTokens / input) * 100 : undefined;
}

function barCells(percent?: number, width = 20): string {
  if (percent === undefined || !Number.isFinite(percent)) return "[" + "·".repeat(width) + "]";
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

export function formatStats(stats: SessionStats): string {
  const count = (value?: number) =>
    value === undefined
      ? "—"
      : value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const used = stats.context?.projectedTokens;
  const capacity = stats.context?.contextWindow;
  const left = used !== undefined && capacity ? Math.max(0, 1 - used / capacity) * 100 : undefined;
  const input = stats.totals
    ? stats.totals.uncachedInputTokens +
      stats.totals.cacheReadTokens +
      stats.totals.cacheWriteTokens
    : undefined;
  const latest = stats.latestSource === "connection check" ? undefined : stats.latest;
  const measured = stats.latestSource !== "connection check";
  const row = (label: string, value?: string) =>
    value === undefined ? [] : [`${(label + ":").padEnd(17)}${value}`];
  const context =
    capacity === undefined
      ? used === undefined
        ? undefined
        : `${count(used)} used`
      : used === undefined
        ? `${count(capacity)} capacity`
        : `${Math.round(left!)}% left (${count(used)} used / ${count(capacity)})`;
  const cache = cacheHitRate(latest);
  const cacheTokens = [
    ...(latest?.cacheReadTokens === undefined ? [] : [`${count(latest.cacheReadTokens)} read`]),
    ...(latest?.cacheWriteTokens === undefined
      ? []
      : [`${count(latest.cacheWriteTokens)} written`]),
  ].join(" / ");
  const groups = [
    [
      ...row("Provider", stats.model?.provider),
      ...row("Model", stats.model?.name),
      ...row("Session", stats.session?.id),
      ...row("Directory", stats.session?.directory),
    ],
    [
      ...row("Context window", context),
      ...row("Cache hit", cache === undefined ? undefined : `${cache.toFixed(1)}%`),
      ...row(
        "Speed",
        measured && stats.outputTokensPerSecond !== undefined
          ? `${stats.outputTokensPerSecond.toFixed(1)} tok/s`
          : undefined,
      ),
      ...row(
        "Generation time",
        measured && stats.generationMs !== undefined
          ? formatDuration(stats.generationMs / 1000)
          : undefined,
      ),
      ...row(
        "Tokens",
        stats.totals ? `${count(input)} in / ${count(stats.totals.outputTokens)} out` : undefined,
      ),
      ...row("Cache tokens", cacheTokens ? cacheTokens : undefined),
    ],
    [
      ...row("Plan", stats.limits?.plan),
      ...(stats.limits?.windows ?? []).flatMap((window) => {
        const reset =
          window.resetsAt === undefined
            ? ""
            : ` (resets ${new Date(window.resetsAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })})`;
        return row(
          window.name,
          `${barCells(window.left)} ${Math.round(window.left)}% left${reset}`,
        );
      }),
      ...row("Credits", stats.limits?.credits),
      ...(stats.limits?.usage ?? []).flatMap((item) => row(item.name, item.value)),
    ],
    [
      ...row("Mode", stats.settings?.mode),
      ...row("Effort", stats.model?.effort),
      ...row(
        "Output limit",
        stats.model?.maxOutput === undefined
          ? undefined
          : `${count(stats.model.maxOutput)} tokens / request`,
      ),
      ...row("Permissions", stats.settings?.permission),
      ...row("Sandbox", stats.settings?.sandbox),
      ...row("Approval", stats.settings?.approval),
    ],
  ];
  return groups
    .filter((group) => group.length)
    .map((group) => group.join("\n"))
    .join("\n\n");
}
