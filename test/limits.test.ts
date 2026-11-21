import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import type { CredentialProvider } from "@deepseek-ai/dsh-credentials";
import { parseLimits, parseProviderUsage, readLimits } from "../src/utils/limits.ts";
import { formatStats } from "../src/utils/stats.ts";

test("account limits use actual window durations, remaining percentages, and credits", () => {
  const limits = parseLimits({
    plan_type: "plus",
    rate_limit: {
      primary_window: { used_percent: 75, limit_window_seconds: 18000, reset_at: 1800000000 },
      secondary_window: { used_percent: 20, limit_window_seconds: 604800 },
    },
    credits: { balance: "12.50" },
  });
  assert.deepEqual(limits.windows, [
    { name: "5h limit", left: 25, resetsAt: 1800000000 },
    { name: "Weekly limit", left: 80, resetsAt: undefined },
  ]);
  const output = formatStats({ limits });
  assert.match(output, /5h limit: +\[█{5}░{15}\] 25% left \(resets/);
  assert.match(output, /Plan: +plus/);
  assert.match(output, /Credits: +12.50/);
  assert.doesNotMatch(output, /Connection:/);
  assert.deepEqual(parseLimits(null).windows, []);
  assert.equal(
    parseLimits({
      rate_limit: { primary_window: { used_percent: 1, limit_window_seconds: 604800 } },
    }).windows[0]?.name,
    "Weekly limit",
  );
  assert.deepEqual(
    parseLimits({
      rate_limit: { primary_window: { used_percent: "10", limit_window_seconds: 18000 } },
    }).windows,
    [],
  );
});

test("limits requests use only dsh OAuth at a fixed host, without following redirects or exposing errors", async () => {
  const original = globalThis.fetch;
  const credentials = {
    readRecord: async (key: string) => {
      assert.equal(key, "llm-pi-ai/openai-codex");
      return { kind: "grant", payload: { access: "test-secret", accountId: "test-account" } };
    },
  } as unknown as CredentialProvider;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://chatgpt.com/backend-api/wham/usage");
    assert.equal(options?.redirect, "error");
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer test-secret");
    assert.equal(new Headers(options?.headers).get("ChatGPT-Account-Id"), "test-account");
    return calls === 1
      ? Response.json({ plan_type: "plus", credits: { unlimited: true } })
      : new Response("private body", { status: 401 });
  };
  try {
    assert.match((await readLimits(credentials, "groq")).unavailable!, /Not reported/);
    assert.equal(calls, 0);
    assert.equal((await readLimits(credentials, "openai-codex")).credits, "Unlimited");
    await assert.rejects(
      readLimits(credentials, "openai-codex"),
      /^Error: Could not read account usage \(HTTP 401\)\.$/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("provider quota, balance, and spending payloads keep only reported values", () => {
  const go = parseProviderUsage("opencode-go", {
    usage: {
      rolling: { percent: 75, resetsAt: "2026-11-15T00:00:00Z" },
      weekly: { percent: 0 },
      monthly: { percent: 110 },
    },
  });
  assert.deepEqual(
    go.windows.map((item) => [item.name, item.left]),
    [
      ["5h limit", 25],
      ["Weekly limit", 100],
      ["Monthly limit", 0],
    ],
  );
  assert.equal(go.windows[0]?.resetsAt, Date.parse("2026-11-15T00:00:00Z") / 1000);
  const router = parseProviderUsage("openrouter", {
    data: { usage: 1.25, usage_daily: 0, usage_monthly: 1, limit: null, limit_remaining: 10 },
  });
  assert.match(formatStats({ limits: router }), /Provider usage: +\$1.25/);
  assert.match(formatStats({ limits: router }), /Daily usage: +\$0.00/);
  assert.doesNotMatch(formatStats({ limits: router }), /Budget:/);
  const deepseek = parseProviderUsage("deepseek", {
    balance_infos: [
      { currency: "CNY", total_balance: "110.00" },
      { currency: "USD", total_balance: "0.00" },
    ],
  });
  assert.deepEqual(deepseek.usage, [
    { name: "Balance", value: "110.00 CNY" },
    { name: "Balance", value: "0.00 USD" },
  ]);
  const claude = parseProviderUsage("anthropic", {
    five_hour: { utilization: 80, resets_at: "invalid" },
    seven_day: { utilization: 30 },
    seven_day_opus: null,
  });
  assert.deepEqual(
    claude.windows.map((item) => [item.name, item.left]),
    [
      ["5h limit", 20],
      ["Weekly limit", 70],
    ],
  );
  assert.equal(claude.windows[0]?.resetsAt, undefined);
  const kimi = parseProviderUsage("kimi-coding", {
    usage: { limit: "100", used: "100" },
    limits: [
      {
        window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
        detail: { limit: "100", remaining: "50" },
      },
    ],
  });
  assert.deepEqual(
    kimi.windows.map((item) => [item.name, item.left]),
    [
      ["Weekly limit", 0],
      ["5h limit", 50],
    ],
  );
  assert.deepEqual(
    parseProviderUsage("opencode-go", { usage: { weekly: { percent: "75" } } }).windows,
    [],
  );
  assert.deepEqual(
    parseProviderUsage("deepseek", { balance_infos: [{ currency: "USD", total_balance: "NaN" }] })
      .usage,
    [],
  );
});

test("provider usage uses dsh's stored keys and environment resolution, and hides permission-only failures", async () => {
  const original = globalThis.fetch;
  let stored: unknown = { kind: "api-key", key: "stored-test-key" };
  let status = 200;
  const envReads: string[] = [];
  const calls: string[] = [];
  const credentials = {
    readRecord: async () => stored,
    resolve: async (ref: string) => {
      envReads.push(ref);
      return { value: "env-test-key", source: "test" };
    },
  } as unknown as CredentialProvider;
  globalThis.fetch = async (url, options) => {
    calls.push(url instanceof Request ? url.url : url.toString());
    assert.equal(options?.redirect, "error");
    const key = new Headers(options?.headers).get("Authorization");
    assert.equal(key, stored ? "Bearer stored-test-key" : "Bearer env-test-key");
    return status === 200
      ? Response.json({ usage: { rolling: { percent: 25 } } })
      : new Response("private body", { status });
  };
  try {
    assert.equal((await readLimits(credentials, "opencode-go")).windows[0]?.left, 75);
    assert.equal(calls.at(-1), "https://opencode.ai/zen/go/v1/usage");
    assert.equal(envReads.length, 0);
    stored = undefined;
    await readLimits(credentials, "opencode-go");
    assert.deepEqual(envReads, ["OPENCODE_API_KEY"]);
    await readLimits(credentials, "deepseek-official");
    assert.equal(envReads.at(-1), "DEEPSEEK_API_KEY");
    assert.equal(calls.at(-1), "https://api.deepseek.com/user/balance");
    status = 403;
    assert.match((await readLimits(credentials, "opencode-go")).unavailable!, /not available/);
    const count = calls.length;
    assert.match((await readLimits(credentials, "anthropic")).unavailable!, /OAuth/);
    assert.equal(calls.length, count);
    status = 404;
    await readLimits(credentials, "opencode-go");
    assert.equal(calls.at(-1), "https://opencode.ai/inference/go/v1/usage");
  } finally {
    globalThis.fetch = original;
  }
});
