import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import { cacheHitRate, formatStats, latestRequestStats } from "../src/stats.ts";

const usage = {
  inputTokens: 70,
  outputTokens: 50,
  cacheReadTokens: 20,
  cacheWriteTokens: 10,
  reasoningTokens: 15,
};

test("cache hit ratio uses disjoint input buckets and distinguishes zero from unknown", () => {
  assert.equal(cacheHitRate(usage), 20);
  assert.equal(cacheHitRate({ inputTokens: 10, outputTokens: 0, cacheReadTokens: 0 }), 0);
  assert.equal(cacheHitRate({ inputTokens: 10, outputTokens: 0 }), undefined);
  assert.equal(cacheHitRate({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }), undefined);
});

test("speed uses durable first-token to finish time, including reasoning once", () => {
  const event = {
    type: "assistant/message",
    data: {
      usage,
      stream: [
        { type: "reasoning-chunks", time0: 1000, index: 0, dt: [], texts: ["thinking"] },
        { type: "text-chunks", time0: 2000, index: 1, dt: [], texts: ["answer"] },
        { type: "chunk", time: 3000, chunk: { type: "finish", reason: { kind: "stop" } } },
      ],
    },
  } as unknown as SessionEvent;
  const stats = latestRequestStats([event]);
  assert.equal(stats.generationMs, 2000);
  assert.equal(stats.outputTokensPerSecond, 25);
  assert.deepEqual(stats.latest, usage);
  assert.deepEqual(latestRequestStats([]), {});
});

test("usage inside failed attempts is read; zero-duration and missing timing remain unavailable", () => {
  const event = {
    type: "assistant/attempt",
    data: {
      stream: [
        { type: "text-chunks", time0: 1000, index: 0, dt: [], texts: ["answer"] },
        { type: "chunk", time: 1000, chunk: { type: "usage", usage } },
        { type: "chunk", time: 1000, chunk: { type: "finish", reason: { kind: "error" } } },
      ],
    },
  } as unknown as SessionEvent;
  const stats = latestRequestStats([event]);
  assert.deepEqual(stats.latest, usage);
  assert.equal(stats.outputTokensPerSecond, undefined);
  assert.equal(stats.generationMs, undefined);
  assert.equal(formatStats({}), "");
});

test("status uses numeric cache hits and unannotated token totals", () => {
  const text = formatStats({
    latest: usage,
    context: { projectedTokens: 750, pressureTokens: 700, contextWindow: 1000 },
    totals: {
      uncachedInputTokens: 70,
      cacheReadTokens: 20,
      cacheWriteTokens: 10,
      outputTokens: 50,
    },
  });
  assert.match(text, /Context window: +25% left \(750 used \/ 1K\)/);
  assert.match(text, /Cache hit: +20.0%/);
  assert.doesNotMatch(text, /[A-Z]{2,}/);
  assert.match(text, /Tokens: +100 in \/ 50 out/);
  assert.doesNotMatch(text, /last request|\(session\)|[█░]/);
});

test("connection checks expose model capacity but hide probe measurements", () => {
  const text = formatStats({
    latestSource: "connection check",
    latest: usage,
    generationMs: 1000,
    outputTokensPerSecond: 50,
    context: { contextWindow: 131072 },
    totals: { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
  });
  assert.doesNotMatch(text, /Connection:/);
  assert.match(text, /Context window: +131.1K capacity/);
  assert.doesNotMatch(text, /connection check|Cache hit:|Cache tokens:|Speed:|Generation time:/);
  assert.match(text, /Tokens: +0 in \/ 0 out/);
  assert.doesNotMatch(text, /last request/);
});

test("status omits headings and unsupported rows, preserving zero values and single blank separators", () => {
  const text = formatStats({
    model: { provider: "example", name: "test" },
    settings: { mode: "Default" },
    limits: { windows: [], unavailable: "Not reported by provider" },
    latest: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0 },
    generationMs: 0,
    outputTokensPerSecond: 0,
  });
  assert.match(text, /Model: +test\n\nCache hit:/);
  assert.match(text, /Cache tokens: +0 read\n\nMode:/);
  assert.match(text, /Speed: +0.0 tok\/s/);
  assert.match(text, /Generation time: +0s/);
  assert.doesNotMatch(
    text,
    /—|Not reported|written|Usage limits:|Effort:|Output limit:|Sandbox:|Approval:|Permissions:/,
  );
  assert.ok(text.split("\n").every((line) => !line || line.includes(":")));
  assert.doesNotMatch(text, /\n{3}|^\n|\n$/);
});
