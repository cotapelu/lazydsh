/**
 * OpenCode free tier via @opencode/sdk v2 — spawns real `opencode serve` binary.
 *
 * The free tier gateway only allows the genuine OpenCode CLI binary (TLS fingerprint,
 * process signature, timing). This provider uses the official SDK to launch
 * `opencode serve` locally, then routes requests through it. The binary handles
 * all fingerprinting transparently.
 *
 * Requires: `opencode` CLI in PATH (v2.x), `@opencode/sdk` npm package.
 *
 * @module pi-extension/opencode-sdk.js
 */
import {
  openAICompletionsApi,
  type Api,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
  type ProviderId,
  type ModelInputModality,
  type ModelCost,
} from "@earendil-works/pi-ai/compat";
import { OpenCode } from "@opencode/client/promise";
import { composeFetches, sseGuard } from "./lane.js";
import { spawn } from "node:child_process";
import { OFM_OPENCODE_SDK_MODELS } from "../ofm-opencode-sdk-models.js";

/** Provider id: `ofm-opencode-sdk/<model>`. */
export const PROVIDER_ID = "ofm-opencode-sdk";
/** Display name shown by selectors and configuration surfaces. */
export const OFM_OPENCODE_SDK_DISPLAY_NAME = "OFM OpenCode Free (SDK)";

/** DeepSeek v4 sometimes leaks DSML control markup into visible text. */
const DSML_FAMILY = /deepseek/i;

/** Singleton server/client instances. */
let serverInstance: { url: string; close(): void; password?: string } | null = null;
let serverStarting: Promise<void> | null = null;
let sdkClient: ReturnType<typeof OpenCode.make> | null = null;
let modelsCache: Model<Api>[] | null = null;
let modelsFetching: Promise<Model<Api>[]> | null = null;

/** Ensure the local opencode server is running. */
async function ensureServer(): Promise<string> {
  if (serverInstance) return serverInstance.url;

  if (!serverStarting) {
    serverStarting = (async () => {
      // Spawn opencode serve as a child process
      const proc = spawn("opencode", ["serve", "--hostname=127.0.0.1", "--port=4096"]);

      let capturedPassword = "";
      let capturedUrl = "";

      await new Promise<{ url: string; close(): void; password?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          proc.kill();
          reject(new Error("Timeout waiting for opencode server to start"));
        }, 30000);

        let output = "";
        const onData = (chunk: Buffer) => {
          output += chunk.toString();
          const lines = output.split("\n");
          for (const line of lines) {
            // Capture password
            const passMatch = line.match(/server password\s+(\S+)/);
            if (passMatch) capturedPassword = passMatch[1];
            if (
              line.startsWith("server listening") ||
              line.startsWith("opencode server listening")
            ) {
              const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
              if (match) {
                capturedUrl = match[1];
                clearTimeout(timeout);
                proc.stdout?.removeListener("data", onData);
                proc.stderr?.removeListener("data", onData);
                resolve({
                  url: capturedUrl,
                  close: () => proc.kill(),
                  password: capturedPassword,
                });
                return;
              }
            }
          }
        };
        proc.stdout?.on("data", onData);
        proc.stderr?.on("data", onData);
        proc.on("error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
        proc.on("exit", (code: number) => {
          clearTimeout(timeout);
          if (code !== 0) reject(new Error(`opencode serve exited with code ${code}`));
        });
      }).then((instance) => {
        serverInstance = instance;
        // Create client connected to the server with Basic auth
        const headers: Record<string, string> = {};
        if (instance.password) {
          const auth = Buffer.from(`opencode:${instance.password}`).toString("base64");
          headers["Authorization"] = `Basic ${auth}`;
        }
        sdkClient = OpenCode.make({ baseUrl: instance.url, headers });
      });
    })();
  }
  await serverStarting;
  return serverInstance!.url;
}

/** Fetch models from the local opencode server. */
export async function fetchModels(): Promise<Model<Api>[]> {
  if (modelsCache) return modelsCache;

  if (!modelsFetching) {
    modelsFetching = (async (): Promise<Model<Api>[]> => {
      await ensureServer();
      if (!sdkClient) throw new Error("SDK client not initialized");

      try {
        // Use the SDK to list models from the running opencode instance
        const result = await sdkClient.model.list();
        const models = result.data ?? [];
        const mapped: Model<Api>[] = models
          .map(mapModel)
          .filter((m: Model<Api> | null): m is Model<Api> => m !== null);
        modelsCache = mapped.length > 0 ? mapped : staticModels();
        return modelsCache;
      } catch (error) {
        console.warn("[ofm-opencode-sdk] Failed to fetch models, using static:", error);
        modelsCache = staticModels();
        return modelsCache;
      }
    })();
  }
  return modelsFetching;
}

/** Map opencode model to pi-ai model format. */
function mapModel(m: any): Model<Api> | null {
  if (!m?.id) return null;
  return {
    id: String(m.id),
    name: String(m.name ?? m.id),
    api: "openai-completions" as Api,
    provider: "openai" as ProviderId,
    baseUrl: "http://127.0.0.1:4096",
    input: (m.capabilities?.vision ? ["text", "image"] : ["text"]) as ModelInputModality[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as ModelCost,
    contextWindow: Number(m.limits?.context ?? 128000),
    maxTokens: Number(m.limits?.output ?? 4096),
    reasoning: !!m.capabilities?.reasoning,
    thinkingLevelMap: m.capabilities?.reasoning
      ? ({ off: "none", low: "low", medium: "medium", high: "high" } as const)
      : undefined,
    compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
  };
}

/** Static fallback models (offline snapshot). */
function staticModels(): Model<Api>[] {
  const baseCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as ModelCost;
  return [
    {
      id: "beam-free",
      name: "Beam (Free)",
      api: "openai-completions" as Api,
      provider: "openai" as ProviderId,
      baseUrl: "http://127.0.0.1:4096",
      input: ["text"] as ModelInputModality[],
      cost: baseCost,
      contextWindow: 131072,
      maxTokens: 32768,
      reasoning: true,
      thinkingLevelMap: { off: "none", low: "low", medium: "medium", high: "high" },
      compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
    },
    {
      id: "qwen-2.5-coder",
      name: "Qwen 2.5 Coder",
      api: "openai-completions" as Api,
      provider: "openai" as ProviderId,
      baseUrl: "http://127.0.0.1:4096",
      input: ["text"] as ModelInputModality[],
      cost: baseCost,
      contextWindow: 131072,
      maxTokens: 32768,
      reasoning: true,
      thinkingLevelMap: { off: "none", low: "low", medium: "medium", high: "high" },
      compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
    },
  ];
}

/** Stream via local opencode server (binary handles fingerprint). */
export async function streamOpencodeSdk(
  model: Model<Api>,
  context: TranscriptContext,
  options?: SimpleStreamOptions,
) {
  await ensureServer();
  const baseUrl = model.baseUrl ?? "http://127.0.0.1:4096";
  const inner = openAICompletionsApi().streamSimple(
    { ...model, baseUrl, api: "openai-completions" },
    context,
    {
      ...options,
      fetch: composeFetches(options?.fetch ?? fetch, sseGuard),
    },
  );

  const scrubber = DSML_FAMILY.test(String(model.id)) ? createDsmlScrubber() : null;
  if (!scrubber) return inner;

  const outer = openAICompletionsApi().streamSimple(
    { ...model, baseUrl, api: "openai-completions" },
    context,
    options,
  );

  // Simple DSML scrub wrapper
  let cleanSoFar = "";
  let lastTextEvent: any = null;
  void (async () => {
    try {
      for await (const event of inner) {
        if (event.type === "text_delta" && typeof event.delta === "string") {
          lastTextEvent = event;
          const scrubbed = scrubber!.push(event.delta);
          cleanSoFar += scrubbed;
          event.delta = scrubbed;
          const block = event.partial?.content?.[event.contentIndex];
          if (block?.type === "text") block.text = cleanSoFar;
        }
        outer.push(event);
      }
      if (lastTextEvent) {
        const tail = scrubber!.flush();
        if (tail) {
          lastTextEvent.delta = `${lastTextEvent.delta ?? ""}${tail}`;
          const block = lastTextEvent.partial?.content?.[lastTextEvent.contentIndex];
          if (block?.type === "text") block.text = cleanSoFar + tail;
        }
      }
      outer.end();
    } catch (error) {
      const errMsg = String(error);
      const errMessage: any = {
        role: "assistant",
        content: [],
        api: "openai-completions",
        provider: "openai",
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0 },
        },
        stopReason: "error",
        errorMessage: errMsg,
        timestamp: Date.now(),
      };
      outer.push({ type: "error", reason: "error", error: errMessage });
      outer.end();
    }
  })();

  return outer;
}

/** DSML scrubber (copied from transport.ts). */
function createDsmlScrubber() {
  const DSML_OPENING = "<｜DSML｜";
  const DSML_TAG = /<｜DSML｜[^>]*>/g;
  let held = "";
  return {
    push(delta: string) {
      let text = held + delta;
      held = "";
      const cut = text.lastIndexOf("<");
      if (cut !== -1) {
        const tail = text.slice(cut);
        if (
          DSML_OPENING.startsWith(tail) ||
          (tail.startsWith(DSML_OPENING) && !tail.includes(">"))
        ) {
          held = tail;
          text = text.slice(0, cut);
        }
      }
      return text.replace(DSML_TAG, "");
    },
    flush() {
      const out = held;
      held = "";
      if (
        out === "" ||
        DSML_OPENING.startsWith(out) ||
        (out.startsWith(DSML_OPENING) && !out.includes(">"))
      )
        return "";
      return out.replace(DSML_TAG, "");
    },
  };
}

/** pi-ai route profile (for llm-pi-ai config). */
export function opencodeSdkProfile() {
  const modelProfiles = OFM_OPENCODE_SDK_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    contextWindow: m.contextWindow,
    maxTokens: m.maxTokens,
    input: m.vision
      ? (["text", "image"] as ("text" | "image")[])
      : (["text"] as ("text" | "image")[]),
    reasoningEfforts: m.reasoning
      ? ({ off: "none", low: "low", medium: "medium", high: "high" } as const)
      : false,
    compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
  }));

  return {
    apiKeyEnv: "OFM_OPENCODE_SDK_API_KEY",
    displayName: OFM_OPENCODE_SDK_DISPLAY_NAME,
    api: "openai-completions",
    baseURL: "http://127.0.0.1:4096",
    models: modelProfiles,
    retryPolicy: { mode: "normal" as const, maxRetries: 2 },
  };
}

/** Extension registration payload (for pi.registerProvider). */
export function opencodeSdkProvider({ models }: { models: Model<Api>[] }) {
  return {
    name: "Our Free Model · OpenCode (SDK)",
    baseUrl: "http://127.0.0.1:4096",
    api: "openai-completions",
    apiKey: "public",
    models,
    refreshModels: async (_ctx: { signal?: AbortSignal }) => fetchModels(),
    streamSimple: streamOpencodeSdk,
  };
}

/** The route table this module contributes, keyed by provider. */
export function ofmOpencodeSdkRoutes() {
  return { [PROVIDER_ID]: opencodeSdkProfile() };
}
