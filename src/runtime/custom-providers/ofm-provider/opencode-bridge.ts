/**
 * OpenCode free-tier bridge: a tiny local OpenAI-compatible HTTP shim in front
 * of the OpenCode *background service* (the same one the CLI drives).
 *
 * lazydsh reaches LLMs through dsh-llm-pi-ai, whose configured routes may only
 * name a *built-in* wire protocol (`openai-completions`, …). That table cannot
 * carry a custom session/agent turn, so this shim is the seam: it speaks plain
 * OpenAI Chat-Completions (streaming SSE) to lazydsh, and behind that it drives
 * an OpenCode `build`-agent session against the running service.
 *
 * The whole point of the indirection is the free-tier gate (see the notes on
 * `opencode-sdk.ts`): the cloud only serves requests that carry the CLI's
 * agent/session fingerprint, so a raw completions call is refused while a
 * `build`-agent session turn is answered. This bridge reproduces the latter.
 *
 * Lifecycle:
 *  - the shim's own HTTP server starts immediately and cheaply, so llm-pi-ai
 *    never sees ECONNREFUSED;
 *  - the OpenCode background service is (re)used lazily on the first request
 *    via `opencode service start`, with its password read from the CLI's own
 *    `service.json` — identical to how the working CLI authenticates.
 *
 * Requires: `opencode` CLI in PATH (v2.x), `@opencode/client`.
 *
 * @module pi-extension/opencode-bridge.js
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { OpenCode } from "@opencode/client/promise";

/**
 * The port our OpenAI-compatible shim listens on. Distinct from common agent
 * runtime ports (which can occupy 4097 on a dev box), overridable via
 * OFM_OPENCODE_SDK_BRIDGE_PORT.
 */
export const BRIDGE_PORT = Number(process.env.OFM_OPENCODE_SDK_BRIDGE_PORT ?? 47183);
/** The agent the free-tier gate fingerprints. */
const FREE_LANE_AGENT = "build";
/** Provider id under which every free model is served on the OpenCode gateway. */
const GATEWAY_PROVIDER = "opencode";
/** Upper bound for one session turn before we give up, so a wedged feed cannot hang the caller. */
const TURN_TIMEOUT_MS = Number(process.env.OFM_OPENCODE_SDK_TURN_TIMEOUT_MS ?? 300_000);
/** Read the request body up to this many bytes. */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

/** The OpenAI base lazydsh should point its `ofm-opencode-sdk` route at. */
export const BRIDGE_BASE_URL = `http://127.0.0.1:${BRIDGE_PORT}/v1`;

const execAsync = promisify(exec);

/** Where the OpenCode background service records its password (XDG-aware). */
function servicePasswordPath(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "opencode", "service.json");
}

/**
 * Connect to the running OpenCode *background service* — the same one the CLI
 * uses. Reusing the shared service reproduces the CLI turn exactly (and is what
 * the free-tier gate recognises); a private `opencode serve` carries a different
 * credential and is answered `401`.
 */
async function connectService(): Promise<ReturnType<typeof OpenCode.make>> {
  const { stdout } = await execAsync("opencode service start", { timeout: 30000 });
  const url = /https?:\/\/[^\s]+/.exec(stdout)?.[0] ?? "http://127.0.0.1:4096";
  let password = "";
  try {
    const parsed = JSON.parse(await readFile(servicePasswordPath(), "utf8")) as {
      password?: string;
    };
    password = parsed.password ?? "";
  } catch {
    // No service.json: proceed unauthenticated; the request then fails clearly.
  }
  const headers: Record<string, string> = {};
  if (password) {
    headers["Authorization"] = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;
  }
  return OpenCode.make({ baseUrl: url, headers });
}

// ── Shared-service client (connected lazily, reused) ──────────────────────────
let client: ReturnType<typeof OpenCode.make> | null = null;
let clientStarting: Promise<ReturnType<typeof OpenCode.make>> | null = null;

async function ensureServe(): Promise<ReturnType<typeof OpenCode.make>> {
  if (client) return client;
  if (!clientStarting) {
    clientStarting = connectService().then((made) => {
      client = made;
      return made;
    });
  }
  return clientStarting;
}

// ── The shim HTTP server (starts immediately; no opencode dependency here) ────
let bridge: { url: string; close(): void } | null = null;
let bridgeStarting: Promise<void> | null = null;

/**
 * Start the shim once and keep it up for the life of the process.
 *
 * Mirrors opencode's {@link probeResult}: a shim a prior run left behind is
 * *probed* (not assumed) and reused, so repeated runs do not fight over the
 * port. `undici`-style fetch is the global one; a 1s timeout keeps a wedged
 * listener from stalling boot.
 */
export async function ensureBridge(): Promise<string> {
  if (bridge) return bridge.url;
  if (!bridgeStarting) {
    bridgeStarting = (async () => {
      if (await probe()) {
        bridge = { url: BRIDGE_BASE_URL, close: () => {} };
        return;
      }
      const server = createServer((req, res) => {
        void handleRequest(req, res).catch((error) => {
          sendError(res, error instanceof Error ? error : new Error(String(error)));
        });
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", (error: NodeJS.ErrnoException) => {
          if (error.code === "EADDRINUSE") {
            // Lost a race with a just-starting shim: wait for it to answer
            // rather than assuming the port is usable.
            void (async () => {
              for (let attempt = 0; attempt < 50; attempt += 1) {
                if (await probe()) {
                  bridge = { url: BRIDGE_BASE_URL, close: () => {} };
                  resolve();
                  return;
                }
                await new Promise((r) => setTimeout(r, 100));
              }
              reject(new Error("port held but no healthy bridge answered"));
            })();
            return;
          }
          reject(error);
        });
        server.listen(BRIDGE_PORT, "127.0.0.1", () => {
          bridge = { url: BRIDGE_BASE_URL, close: () => server.close() };
          resolve();
        });
      });
      const stop = () => {
        try {
          server.close();
        } catch {
          // best-effort
        }
      };
      process.once("exit", stop);
    })();
  }
  await bridgeStarting;
  return bridge!.url;
}

/** Health probe: is a shim already listening and answering here? */
async function probe(): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}/models`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Tear the shim down (tests / shutdown). The shared service is left running. */
export function closeBridge(): void {
  if (bridge) {
    bridge.close();
    bridge = null;
    bridgeStarting = null;
  }
  client = null;
  clientStarting = null;
}

// ── HTTP handling ──────────────────────────────────────────────────────────────
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${BRIDGE_PORT}`);
  // Health/listing route the reuse probe (and OpenAI clients) hit.
  if (req.method === "GET" && url.pathname.endsWith("/models")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [] }));
    return;
  }
  if (req.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Not found. Use POST /v1/chat/completions." } }));
    return;
  }
  const body = await readBody(req);
  let request: Record<string, any>;
  try {
    request = JSON.parse(body);
  } catch {
    sendError(res, new Error("Request body is not valid JSON"));
    return;
  }
  const model = String(request.model ?? "");
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const promptText = messagesToPrompt(messages);
  if (promptText.trim() === "") {
    sendError(res, new Error("No user message to send"));
    return;
  }

  const sdk = await ensureServe();

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const chunkId = `chatcmpl-${Math.random().toString(36).slice(2)}`;
  const sendDelta = (delta: Record<string, unknown>, finish: string | null = null) => {
    res.write(
      `data: ${JSON.stringify({
        id: chunkId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta, finish_reason: finish }],
      })}\n\n`,
    );
  };
  // Announce the role once so OpenAI clients assemble a message.
  sendDelta({ role: "assistant" });

  let sessionID: string | undefined;
  try {
    const session = await sdk.session.create({
      model: { id: model, providerID: GATEWAY_PROVIDER },
      agent: FREE_LANE_AGENT,
    });
    sessionID = session.id;
    // The light path: ONE model call (`session.generate`), no agent loop and no
    // tool execution. It still sends the build-agent system prompt + tool list,
    // which is the fingerprint the free-tier gate checks, but opencode does the
    // least possible work — one forward, one answer.
    const out = await Promise.race([
      sdk.session.generate({ sessionID, prompt: promptText }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("generate exceeded its time budget")), TURN_TIMEOUT_MS),
      ),
    ]);
    const text = String(out?.text ?? "");
    if (text !== "") sendDelta({ content: text }, "stop");
    else sendDelta({}, "stop");
  } catch (error) {
    sendDelta({}, "stop");
    res.write(
      `data: ${JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: "server_error",
        },
      })}\n\n`,
    );
  } finally {
    if (sessionID !== undefined) {
      void sdk.session.interrupt({ sessionID }).catch(() => {});
      void sdk.session.remove({ sessionID }).catch(() => {});
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

/** Flatten an OpenAI messages array into one prompt string. */
function messagesToPrompt(messages: any[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    if (Array.isArray(message.content)) {
      for (const piece of message.content)
        if (piece?.type === "text" && typeof piece.text === "string") parts.push(piece.text);
    } else if (typeof message.content === "string") {
      parts.push(message.content);
    }
  }
  return parts.join("\n\n");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendError(res: ServerResponse, error: Error): void {
  if (res.headersSent) {
    res.end(`data: ${JSON.stringify({ error: { message: error.message } })}\n\ndata: [DONE]\n\n`);
    return;
  }
  res.writeHead(500, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { message: error.message, type: "server_error" } }));
}
