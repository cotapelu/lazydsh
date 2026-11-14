import {
  credentialKey,
  credentialRef,
  type CredentialProvider,
} from "@deepseek-ai/dsh-credentials";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { formatDuration } from "./format.ts";

export interface AccountLimits {
  plan?: string;
  credits?: string;
  usage?: { name: string; value: string }[];
  windows: { name: string; left: number; resetsAt?: number }[];
  unavailable?: string;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseLimits(value: unknown): AccountLimits {
  const data = object(value);
  const rate = object(data.rate_limit);
  const windows: AccountLimits["windows"] = [];
  for (const key of ["primary_window", "secondary_window"]) {
    const window = object(rate[key]);
    if (
      typeof window.used_percent !== "number" ||
      !Number.isFinite(window.used_percent) ||
      typeof window.limit_window_seconds !== "number" ||
      !Number.isFinite(window.limit_window_seconds) ||
      window.limit_window_seconds <= 0
    )
      continue;
    windows.push({
      name:
        window.limit_window_seconds === 604800
          ? "Weekly limit"
          : `${formatDuration(window.limit_window_seconds).replace(/ 0s$/, "")} limit`,
      left: Math.max(0, Math.min(100, 100 - window.used_percent)),
      resetsAt:
        typeof window.reset_at === "number" &&
        Number.isFinite(window.reset_at) &&
        window.reset_at > 0
          ? window.reset_at
          : undefined,
    });
  }
  const credits = object(data.credits);
  return {
    plan: typeof data.plan_type === "string" ? data.plan_type : undefined,
    credits:
      credits.unlimited === true
        ? "Unlimited"
        : typeof credits.balance === "string" || typeof credits.balance === "number"
          ? String(credits.balance)
          : undefined,
    windows,
  };
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function resetTime(value: unknown): number | undefined {
  const time = typeof value === "string" ? Date.parse(value) / 1000 : undefined;
  return time !== undefined && Number.isFinite(time) && time > 0 ? time : undefined;
}

export function parseProviderUsage(provider: string, value: unknown): AccountLimits {
  if (provider === "openai-codex") return parseLimits(value);
  const data = object(value);
  const windows: AccountLimits["windows"] = [];
  const usage: { name: string; value: string }[] = [];
  const result = { windows, usage };
  if (provider === "opencode-go") {
    const usage = object(data.usage);
    for (const [key, name] of [
      ["rolling", "5h limit"],
      ["weekly", "Weekly limit"],
      ["monthly", "Monthly limit"],
    ] as const) {
      const window = object(usage[key]);
      if (finite(window.percent))
        result.windows.push({
          name,
          left: Math.max(0, 100 - window.percent),
          resetsAt: resetTime(window.resetsAt),
        });
    }
  } else if (provider === "anthropic") {
    for (const [key, name] of [
      ["five_hour", "5h limit"],
      ["seven_day", "Weekly limit"],
      ["seven_day_opus", "Opus limit"],
      ["seven_day_sonnet", "Sonnet limit"],
    ] as const) {
      const window = object(data[key]);
      if (finite(window.utilization))
        result.windows.push({
          name,
          left: Math.max(0, 100 - window.utilization),
          resetsAt: resetTime(window.resets_at),
        });
    }
  } else if (provider === "deepseek" || provider === "deepseek-official") {
    for (const item of Array.isArray(data.balance_infos) ? data.balance_infos : []) {
      const balance = object(item);
      if (
        (balance.currency === "USD" || balance.currency === "CNY") &&
        typeof balance.total_balance === "string" &&
        /^\d+(?:\.\d+)?$/.test(balance.total_balance)
      )
        result.usage.push({
          name: "Balance",
          value: `${balance.total_balance} ${balance.currency}`,
        });
    }
  } else if (provider === "openrouter") {
    const usage = object(data.data);
    for (const [key, name] of [
      ["usage", "Provider usage"],
      ["usage_daily", "Daily usage"],
      ["usage_weekly", "Weekly usage"],
      ["usage_monthly", "Monthly usage"],
      ["limit", "Budget"],
      ["limit_remaining", "Budget left"],
    ] as const) {
      const amount = usage[key];
      if (finite(amount) && amount >= 0)
        result.usage.push({ name, value: `$${amount.toFixed(2)}` });
    }
  } else if (provider === "kimi-coding") {
    // Prefer the account API's explicit used/limit totals over optional ratio summaries.
    const usage = object(data.usage);
    const limit = Number(usage.limit);
    const used = Number(usage.used);
    if (
      typeof usage.limit === "string" &&
      typeof usage.used === "string" &&
      Number.isFinite(limit) &&
      limit > 0 &&
      Number.isFinite(used)
    )
      result.windows.push({
        name: "Weekly limit",
        left: Math.max(0, 100 - (used / limit) * 100),
        resetsAt: resetTime(usage.resetTime),
      });
    for (const item of Array.isArray(data.limits) ? data.limits : []) {
      const entry = object(item);
      const window = object(entry.window);
      const detail = object(entry.detail);
      const limit = Number(detail.limit);
      const remaining = Number(detail.remaining);
      if (
        window.timeUnit === "TIME_UNIT_MINUTE" &&
        finite(window.duration) &&
        typeof detail.limit === "string" &&
        typeof detail.remaining === "string" &&
        Number.isFinite(limit) &&
        limit > 0 &&
        Number.isFinite(remaining)
      )
        result.windows.push({
          name: `${formatDuration(window.duration * 60).replace(/ 0s$/, "")} limit`,
          left: Math.max(0, (remaining / limit) * 100),
          resetsAt: resetTime(detail.resetTime),
        });
    }
  }
  return result;
}

export async function readLimits(
  credentials: CredentialProvider,
  provider: string,
  signal?: AbortSignal,
): Promise<AccountLimits> {
  const endpoints: Record<string, string> = {
    "openai-codex": "https://chatgpt.com/backend-api/wham/usage",
    "opencode-go": "https://opencode.ai/zen/go/v1/usage",
    "deepseek-official": "https://api.deepseek.com/user/balance",
    deepseek: "https://api.deepseek.com/user/balance",
    openrouter: "https://openrouter.ai/api/v1/key",
    anthropic: "https://api.anthropic.com/api/oauth/usage",
    "kimi-coding": "https://api.kimi.com/coding/v1/usages",
  };
  const endpoint = endpoints[provider];
  if (!endpoint) return { windows: [], unavailable: "Not reported by provider" };
  const record = await credentials.readRecord(credentialKey("llm-pi-ai", provider));
  const grant = record?.kind === "grant" ? object(record.payload) : {};
  let key = typeof grant.access === "string" ? grant.access : undefined;
  if ((provider === "openai-codex" || provider === "anthropic") && !key)
    return { windows: [], unavailable: "Requires subscription OAuth" };
  if (!key) {
    if (provider === "deepseek-official")
      key = (await credentials.resolve(credentialRef("DEEPSEEK_API_KEY")))?.value;
    else {
      const catalog = builtinProviders().find((item) => item.id === provider);
      const auth = await catalog?.auth.apiKey?.resolve({
        ctx: {
          env: async (name) => (await credentials.resolve(credentialRef(name)))?.value,
          fileExists: async () => false,
        },
        credential:
          record?.kind === "api-key"
            ? { type: "api_key", key: record.key, env: record.env }
            : undefined,
        signal: signal ?? new AbortController().signal,
      });
      key = auth?.auth.apiKey;
    }
  }
  if (!key) return { windows: [], unavailable: "Account credential unavailable" };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "User-Agent": "lazydsh/0.1.0",
  };
  if (provider === "openai-codex" && typeof grant.accountId === "string")
    headers["ChatGPT-Account-Id"] = grant.accountId;
  if (provider === "anthropic") headers["anthropic-beta"] = "oauth-2025-04-20";
  // shortcut: subscription usage APIs can change; keep their response parsers covered with fixtures.
  const request = {
    headers,
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
  } satisfies RequestInit;
  let response = await fetch(endpoint, request);
  if (provider === "opencode-go" && response.status === 404)
    response = await fetch("https://opencode.ai/inference/go/v1/usage", request);
  if (response.status === 403 || response.status === 404)
    return { windows: [], unavailable: "Account usage is not available for this credential" };
  if (!response.ok) throw new Error(`Could not read account usage (HTTP ${response.status}).`);
  return parseProviderUsage(provider, await response.json());
}
