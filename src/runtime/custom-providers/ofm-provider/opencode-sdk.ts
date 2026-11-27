/**
 * OpenCode free tier via `@opencode/client` against the local `opencode serve`
 * gateway, driven through a **session + agent** flow rather than a raw generate.
 *
 * Why a session and not `experimental.generate.text`? The OpenCode free-tier
 * cloud endpoint (`/inference/openai/v1`) does not meter by IP alone: it checks a
 * *client fingerprint* carried by the agent turn — the `build` agent's system
 * prompt, its `read`/`shell` tool declarations and the session/agent scaffolding
 * the CLI always sends. A raw text generate lacks that context and is answered
 * with `429 FreeUsageLimitError`; driving the same model through
 * `session.create` → `session.prompt` (agent `build`) reproduces the CLI shape
 * exactly and is served. See the analysis in the repo notes.
 *
 * This module borrows pi's OpenAI-Completions provider only for the request
 * body/headers the local server speaks; the actual turn is an OpenCode session
 * streamed over the server's event feed, which we re-shape into pi-ai
 * `AssistantMessageEvent`s (text + reasoning + tool calls).
 *
 * Requires: `opencode` CLI in PATH (v2.x), `@opencode/client`.
 *
 * @module pi-extension/opencode-sdk.js
 */
import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
  type ProviderId,
  type ModelInputModality,
  type ModelCost,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
} from "@earendil-works/pi-ai/compat";
import { OpenCode } from "@opencode/client/promise";
import { spawn } from "node:child_process";
import { OFM_OPENCODE_SDK_MODELS } from "../ofm-opencode-sdk-models.js";
import { BRIDGE_BASE_URL } from "./opencode-bridge.js";

/** Provider id, also the pi model prefix: `ofm-opencode-sdk/<model>`. */
export const PROVIDER_ID = "ofm-opencode-sdk";
/** Display name shown by selectors and configuration surfaces. */
export const OFM_OPENCODE_SDK_DISPLAY_NAME = "OFM OpenCode Free (SDK)";

/** The agent the free tier gate fingerprints; the default "build" agent. */
const FREE_LANE_AGENT = "build";
/** Local port the spawned `opencode serve` listens on. */
const SERVER_PORT = Number(process.env.OFM_OPENCODE_SDK_PORT ?? 4096);
/** Upper bound for one session turn before we give up, so a wedged feed cannot hang the caller. */
const TURN_TIMEOUT_MS = Number(process.env.OFM_OPENCODE_SDK_TURN_TIMEOUT_MS ?? 300_000);

/** Singleton server/client instances. */
let serverInstance: { url: string; close(): void; password?: string } | null = null;
let serverStarting: Promise<void> | null = null;
let sdkClient: ReturnType<typeof OpenCode.make> | null = null;

/** Ensure the local opencode server is running; spawn it once and wait for readiness. */
async function ensureServer(): Promise<string> {
  if (serverInstance) return serverInstance.url;
  if (!serverStarting) {
    serverStarting = (async () => {
      const proc = spawn("opencode", ["serve", "--hostname=127.0.0.1", `--port=${SERVER_PORT}`]);
      let capturedPassword = "";
      let capturedUrl = "";
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          proc.kill();
          reject(new Error("Timeout waiting for opencode server to start"));
        }, 30000);
        let output = "";
        const onData = (chunk: Buffer) => {
          output += chunk.toString();
          for (const line of output.split("\n")) {
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
                resolve();
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
          if (capturedUrl === "") reject(new Error(`opencode serve exited with code ${code}`));
        });
      });
      serverInstance = { url: capturedUrl, close: () => proc.kill(), password: capturedPassword };
      const headers: Record<string, string> = {};
      if (capturedPassword) {
        const auth = Buffer.from(`opencode:${capturedPassword}`).toString("base64");
        headers["Authorization"] = `Basic ${auth}`;
      }
      sdkClient = OpenCode.make({ baseUrl: capturedUrl, headers });
    })();
  }
  await serverStarting;
  return serverInstance!.url;
}

/** A blank pi-ai AssistantMessage the streaming bridge accumulates into. */
function blankMessage(model: Model<Api>, modelId: string): AssistantMessage {
  const baseCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as ModelCost;
  return {
    role: "assistant",
    content: [],
    api: "openai-completions",
    provider: (String(model.provider ?? "openai") || "openai") as ProviderId,
    model: modelId,
    usage: {
      input: 0,
      output: 0,
      total: 0,
      cost: baseCost,
    } as unknown as AssistantMessage["usage"],
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function cloneMessage(message: AssistantMessage): AssistantMessage {
  return { ...message, content: message.content.map((block) => ({ ...block })) };
}

/**
 * One free-tier turn, driven through an OpenCode session so the cloud sees the
 * CLI-shaped fingerprint. Text, reasoning and tool calls are re-shaped into
 * pi-ai assistant events; the caller's abort signal interrupts the turn.
 */
export function streamOpencodeSdk(
  model: Model<Api>,
  context: TranscriptContext,
  options?: SimpleStreamOptions,
) {
  const outer = createAssistantMessageEventStream();
  const message = blankMessage(model, String(model.id));
  // Per-block-type cursors into `message.content`; models interleave rarely, so
  // each kind keeps its own block and index, matching pi-ai's contentIndex.
  let textIndex = -1;
  let thinkingIndex = -1;
  const toolIndices = new Map<string, number>();
  const signal = options?.signal;

  void (async () => {
    try {
      await ensureServer();
      if (!sdkClient) throw new Error("opencode server client is not initialized");
      const modelId = String(model.id);
      const providerID = (model.provider as string) || "opencode";

      // The user text is the last user message's text parts joined.
      const messages = context.messages ?? [];
      const last = messages[messages.length - 1];
      const promptText =
        (last as any)?.content
          ?.filter((part: any) => part?.type === "text")
          ?.map((part: any) => part.text)
          .join("\n") ?? "";

      // Subscribe BEFORE prompting: the turn streams over the shared event feed.
      const subscribeController = new AbortController();
      if (signal) {
        if (signal.aborted) throw abortError();
        signal.addEventListener("abort", () => subscribeController.abort(), { once: true });
      }

      const events = sdkClient.event.subscribe({ signal: subscribeController.signal });

      // Create the session with the model + build agent pre-selected.
      const session = await sdkClient.session.create({
        model: { id: modelId, providerID },
        agent: FREE_LANE_AGENT,
      });
      const sessionID = session.id;

      // The step start carries the definitive model ref; emit `start` lazily then.
      const started = () => {
        if (message.content.length === 0) {
          outer.push({ type: "start", partial: cloneMessage(message) });
        }
      };

      let stopped = false;
      const deadline = Date.now() + TURN_TIMEOUT_MS;
      let failed: string | undefined;

      // Fire the turn; it returns immediately and streams via events.
      void sdkClient.session.prompt({ sessionID, text: promptText }).catch((error: unknown) => {
        failed = error instanceof Error ? error.message : String(error);
      });

      for await (const event of events) {
        const data = (event as any)?.data;
        if (!data || data.sessionID !== sessionID) continue;
        switch (event.type) {
          case "session.step.started":
            started();
            break;
          case "session.reasoning.started":
            started();
            thinkingIndex = message.content.length;
            message.content.push({ type: "thinking", thinking: "" } as ThinkingContent);
            outer.push({
              type: "thinking_start",
              contentIndex: thinkingIndex,
              partial: cloneMessage(message),
            });
            break;
          case "session.reasoning.delta": {
            if (thinkingIndex < 0) {
              thinkingIndex = message.content.length;
              message.content.push({ type: "thinking", thinking: "" } as ThinkingContent);
              outer.push({
                type: "thinking_start",
                contentIndex: thinkingIndex,
                partial: cloneMessage(message),
              });
            }
            const block = message.content[thinkingIndex] as ThinkingContent;
            block.thinking += data.delta ?? "";
            outer.push({
              type: "thinking_delta",
              contentIndex: thinkingIndex,
              delta: data.delta ?? "",
              partial: cloneMessage(message),
            });
            break;
          }
          case "session.reasoning.ended": {
            if (thinkingIndex >= 0) {
              const block = message.content[thinkingIndex] as ThinkingContent;
              outer.push({
                type: "thinking_end",
                contentIndex: thinkingIndex,
                content: block.thinking,
                partial: cloneMessage(message),
              });
            }
            break;
          }
          case "session.text.started":
            started();
            textIndex = message.content.length;
            message.content.push({ type: "text", text: "" } as TextContent);
            outer.push({
              type: "text_start",
              contentIndex: textIndex,
              partial: cloneMessage(message),
            });
            break;
          case "session.text.delta": {
            if (textIndex < 0) {
              textIndex = message.content.length;
              message.content.push({ type: "text", text: "" } as TextContent);
              outer.push({
                type: "text_start",
                contentIndex: textIndex,
                partial: cloneMessage(message),
              });
            }
            const block = message.content[textIndex] as TextContent;
            block.text += data.delta ?? "";
            outer.push({
              type: "text_delta",
              contentIndex: textIndex,
              delta: data.delta ?? "",
              partial: cloneMessage(message),
            });
            break;
          }
          case "session.text.ended": {
            if (textIndex >= 0) {
              const block = message.content[textIndex] as TextContent;
              outer.push({
                type: "text_end",
                contentIndex: textIndex,
                content: block.text,
                partial: cloneMessage(message),
              });
            }
            break;
          }
          case "session.tool.input.started":
          case "session.tool.called": {
            if (event.type === "session.tool.called") {
              started();
              const key = String(
                data.callID ?? data.toolCall?.id ?? data.id ?? `tool-${toolIndices.size}`,
              );
              const name = String(data.tool ?? data.toolCall?.name ?? "tool");
              const args = data.toolCall?.arguments ?? data.input ?? {};
              if (!toolIndices.has(key)) {
                const index = message.content.length;
                message.content.push({
                  type: "toolCall",
                  id: key,
                  name,
                  arguments: args,
                } as ToolCall); // shape already carries type: toolCall
                toolIndices.set(key, index);
                outer.push({
                  type: "toolcall_start",
                  contentIndex: index,
                  partial: cloneMessage(message),
                });
                outer.push({
                  type: "toolcall_end",
                  contentIndex: index,
                  toolCall: { type: "toolCall", id: key, name, arguments: args },
                  partial: cloneMessage(message),
                });
              }
            }
            break;
          }
          case "session.step.failed":
            failed = data?.error?.message ?? data?.message ?? "the free tier turn failed";
            break;
          case "session.idle":
            stopped = true;
            break;
        }
        if (stopped || failed !== undefined) break;
        if (Date.now() > deadline) {
          failed = "the free-tier turn exceeded its time budget";
          break;
        }
      }

      subscribeController.abort();
      // Stop any trailing background work on the session so it does not run tools.
      void sdkClient.session.interrupt({ sessionID }).catch(() => {});

      if (signal?.aborted) {
        message.stopReason = "aborted";
        message.errorMessage = "aborted";
        outer.push({ type: "error", reason: "aborted", error: message });
        outer.end();
        return;
      }
      if (failed !== undefined) {
        message.stopReason = "error";
        message.errorMessage = failed;
        outer.push({ type: "error", reason: "error", error: message });
        outer.end();
        return;
      }
      const hasToolCalls = toolIndices.size > 0;
      message.stopReason = hasToolCalls ? "toolUse" : "stop";
      outer.push({ type: "done", reason: hasToolCalls ? "toolUse" : "stop", message });
      outer.end();
    } catch (error) {
      message.stopReason = "error";
      message.errorMessage = error instanceof Error ? error.message : String(error);
      outer.push({ type: "error", reason: "error", error: message });
      outer.end();
    }
  })();

  return outer;
}

/** The AbortError shape a cancelled read is rejected with. */
function abortError() {
  return Object.assign(new Error("the request was aborted"), { name: "AbortError" });
}

/** pi-ai route profile (for llm-pi-ai config). */
export function opencodeSdkProfile() {
  return {
    apiKeyEnv: "OFM_OPENCODE_SDK_API_KEY",
    displayName: OFM_OPENCODE_SDK_DISPLAY_NAME,
    api: "openai-completions",
    baseURL: BRIDGE_BASE_URL,
    models: OFM_OPENCODE_SDK_MODELS.map((m) => ({
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
    })),
    retryPolicy: { mode: "normal" as const, maxRetries: 2 },
  };
}

/** Extension registration payload (for pi.registerProvider). */
export function opencodeSdkProvider({ models }: { models: Model<Api>[] }) {
  return {
    name: "Our Free Model · OpenCode (SDK)",
    baseUrl: `http://127.0.0.1:${SERVER_PORT}`,
    api: "openai-completions",
    apiKey: "public",
    models,
    refreshModels: async () => opencodeSdkModels(),
    streamSimple: streamOpencodeSdk,
  };
}

/** The offline roster as pi-ai models; no server needed to list them. */
export function opencodeSdkModels(): Model<Api>[] {
  return OFM_OPENCODE_SDK_MODELS.map(toModel);
}

/** The route table this module contributes, keyed by provider. */
export function ofmOpencodeSdkRoutes() {
  return { [PROVIDER_ID]: opencodeSdkProfile() };
}

/** Static snapshot model → pi-ai Model shape. */
function toModel(m: (typeof OFM_OPENCODE_SDK_MODELS)[number]): Model<Api> {
  const baseCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as ModelCost;
  return {
    id: m.id,
    name: m.name,
    api: "openai-completions" as Api,
    provider: "opencode" as ProviderId,
    baseUrl: BRIDGE_BASE_URL,
    input: m.vision
      ? (["text", "image"] as ModelInputModality[])
      : (["text"] as ModelInputModality[]),
    cost: baseCost,
    contextWindow: m.contextWindow,
    maxTokens: m.maxTokens,
    reasoning: m.reasoning,
    thinkingLevelMap: m.reasoning
      ? ({ off: "none", low: "low", medium: "medium", high: "high" } as const)
      : undefined,
    compat: { supportsStore: false, maxTokensField: "max_tokens" as const },
  };
}

// Kept for the profile builder's typing convenience.
type _UnusedModelConfig = (typeof OFM_OPENCODE_SDK_MODELS)[number];
void (undefined as unknown as _UnusedModelConfig);
