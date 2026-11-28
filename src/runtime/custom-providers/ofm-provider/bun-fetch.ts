/**
 * Bun-tunnel transport for the OpenCode free-tier gateway.
 *
 * dsh-llm-pi-ai streams through Node's global `fetch` (undici), whose TLS/JA3
 * fingerprint the OpenCode free-tier gateway refuses with `429` even when the
 * request headers and body are correct. The gateway only serves TLS of a real
 * OpenCode client (Bun/Go). This module tunnels the request through a **Bun
 * worker** so the socket leaves via Bun's TLS, transparently, while the caller
 * still hands us a `(input, init)` fetch call.
 *
 * Pattern ported from `vendor/dsh-our-free-model/src/bun-fetch.js`: the worker
 * speaks one JSON request on stdin and returns one JSON metadata line plus raw
 * response bytes on stdout; nothing evaluates request content.
 *
 * @module pi-extension/bun-fetch.js
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  gatewayHeaders as o2aGatewayHeaders,
  shapeToolSurface,
  injectOfficialPrompt,
  ensureChatUsage,
  ensureV2CompletionLimit,
} from "./opencode-o2a.js";

/** Host whose `/inference` traffic must ride the Bun TLS. */
const BUN_TUNNEL_HOST = "opencode.ai";

/**
 * Rebuild the request the way a genuine OpenCode client does, so the free-tier
 * gate (body fingerprint + TLS) accepts it: canonical session, the four session
 * headers, `x-opencode-project` derived from the session (never the burned
 * `global` bucket), the W3C trace headers, the official system prompt and the
 * verbatim `read`/`shell` tool surface.
 */
function o2aShape(bodyText: string | null): { headers: [string, string][]; body: string | null } {
  let payload: any = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    payload = null;
  }
  if (payload && typeof payload === "object" && Array.isArray(payload.messages)) {
    // The free gateway only serves the CLI's minimal shape (official prompt,
    // the verbatim read/shell tools, max_completion_tokens, streaming). DSH's
    // rich 43-tool surface and max_tokens are refused with a bare 400, so the
    // request is reduced to that shape; extra keys are dropped.
    const model = String(payload.model ?? "");
    const minimal: any = {
      model: payload.model,
      stream: true,
      messages: payload.messages,
    };
    // Collapse to the clean [system, user] shape the gateway accepts (it refuses
    // DSH's long, non-alternating multi-user/multi-system transcript).
    const userText = payload.messages
      .filter((m: any) => m.role === "user")
      .map((m: any) =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
      )
      .join("\n\n");
    minimal.messages = [{ role: "user", content: userText }];
    shapeToolSurface(minimal, "chat");
    injectOfficialPrompt(minimal, "chat", { model, toolNames: ["read", "shell"] });
    ensureV2CompletionLimit(minimal, "chat");
    ensureChatUsage(minimal, "chat");
    payload = minimal;
  }
  const headers = (o2aGatewayHeaders as any)({ stream: true });
  return { headers: Object.entries(headers), body: payload ? JSON.stringify(payload) : bodyText };
}

const WORKER_SOURCE = `try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const init = { method: request.method, headers: request.headers, redirect: request.redirect ?? 'error' };
  if (request.body !== null && request.body !== undefined) init.body = Buffer.from(request.body, 'base64');
  const response = await fetch(request.url, init);
  const headers = [...response.headers].filter(([key]) => ![
    'content-encoding','content-length','transfer-encoding','connection','keep-alive','trailer','upgrade',
  ].includes(key.toLowerCase()));
  const metadata = Buffer.from(JSON.stringify({ status: response.status, statusText: response.statusText, headers }) + '\\n');
  process.stdout.write(metadata);
  if (response.body) {
    for await (const chunk of response.body) process.stdout.write(Buffer.from(chunk));
  }
} catch {
  process.exitCode = 1;
}
`;

let workerPath: string | undefined;
function workerFile(): string {
  if (workerPath !== undefined && existsSync(workerPath)) return workerPath;
  try {
    const dir = join(tmpdir(), "lazydsh-ofm");
    mkdirSync(dir, { recursive: true });
    workerPath = join(dir, "ofm-bun-worker.mjs");
    writeFileSync(workerPath, WORKER_SOURCE, { mode: 0o600 });
  } catch {
    const dir = mkdtempSync(join(tmpdir(), "lazydsh-ofm-"));
    workerPath = join(dir, "ofm-bun-worker.mjs");
    writeFileSync(workerPath, WORKER_SOURCE);
  }
  return workerPath;
}

/** Locate the Bun executable; none means the lane stays on Node (and 429s). */
function findBun(): string | undefined {
  const name = process.platform === "win32" ? "bun.exe" : "bun";
  const candidates = [
    process.env.OFM_OPENCODE_BUN,
    process.env.BUN_INSTALL ? join(process.env.BUN_INSTALL, "bin", name) : undefined,
    join(homedir(), ".bun", "bin", name),
    ...(process.env.PATH ?? "")
      .split(delimiter)
      .filter(Boolean)
      .map((p) => join(p, name)),
  ].filter((c): c is string => typeof c === "string" && c.length > 0);
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // continue
    }
  }
  return undefined;
}

/** Parse the worker's first stdout line (metadata) and hand back the byte stream behind it. */
async function readTunneledResponse(proc: ReturnType<typeof spawn>): Promise<Response> {
  const stdout = proc.stdout!;
  const iterator = stdout[Symbol.asyncIterator]();
  const decoder = new TextDecoder();
  let buffered = "";
  let metaLine: string | undefined;
  let rawTail = new Uint8Array(0);
  const readMore = async (): Promise<boolean> => {
    const { value, done } = await iterator.next();
    if (done === true || value === undefined) return done === true;
    const combined = new Uint8Array(rawTail.length + value.length);
    combined.set(rawTail);
    combined.set(value, rawTail.length);
    rawTail = combined;
    buffered += decoder.decode(value, { stream: true });
    const nl = buffered.indexOf("\n");
    if (nl !== -1 && metaLine === undefined) metaLine = buffered.slice(0, nl);
    return false;
  };
  while (metaLine === undefined) {
    const done = await readMore();
    if (done) throw new Error("bun worker closed before emitting metadata");
  }
  // Body = whatever bytes follow the metadata line's terminating newline.
  const metaBytes = new TextEncoder().encode(metaLine + "\n");
  const parsed = JSON.parse(metaLine) as {
    status: number;
    statusText: string;
    headers: [string, string][];
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (rawTail.length > metaBytes.length) controller.enqueue(rawTail.slice(metaBytes.length));
      void (async () => {
        try {
          while (true) {
            const { value, done } = await iterator.next();
            if (done === true) {
              controller.close();
              return;
            }
            if (value !== undefined) controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      })();
    },
    cancel() {
      iterator.return?.(undefined).catch(() => {});
    },
  });
  return new Response(body, {
    status: parsed.status,
    statusText: parsed.statusText,
    headers: parsed.headers,
  });
}

/** Issue `(input, init)` through the Bun worker; returns a fetch `Response`. */
export async function bunFetch(input: any, init?: any): Promise<Response> {
  const bun = findBun();
  if (bun === undefined) return fetch(input, init); // graceful degradation (Node TLS → 429)
  const url = typeof input === "string" ? input : input?.url;
  const method = init?.method ?? (typeof input === "object" ? input.method : undefined) ?? "POST";
  let rawText: string | null = null;
  const raw = init?.body;
  if (raw !== undefined && raw !== null)
    rawText = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
  const shaped = o2aShape(rawText);
  // The worker decodes the body from base64; send it that way (JSON → base64),
  // otherwise the raw JSON is base64-decoded into garbage and the gateway 400s.
  const request = {
    method,
    url,
    headers: shaped.headers,
    redirect: init?.redirect ?? "error",
    body: shaped.body === null ? null : Buffer.from(shaped.body, "utf8").toString("base64"),
  };
  if (process.env.OFM_DEBUG_SHAPE === "1") {
    process.stderr.write(`[ofm-http] -> ${url} ${method}\n`);
  }
  const proc = spawn(bun, [workerFile()], { stdio: ["pipe", "pipe", "pipe"] });
  let workerErr: string | undefined;
  proc.stderr?.on("data", (chunk: Buffer) => {
    workerErr ??= chunk.toString();
  });
  proc.stdin?.end(Buffer.from(JSON.stringify(request), "utf8"));
  let response: Response;
  try {
    response = await readTunneledResponse(proc);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`bun worker failed: ${msg}${workerErr ? ` — ${workerErr}` : ""}`);
  }
  if (response.status >= 400 && process.env.OFM_DEBUG_SHAPE === "1") {
    const cloned = response.clone();
    cloned
      .text()
      .then((t) =>
        process.stderr.write(`[ofm-http] status=${response.status} body=${t.slice(0, 500)}\n`),
      )
      .catch(() => {});
  }
  return response;
}

/**
 * Whether this fetch target should ride the Bun TLS. Only the free-lane
 * inference paths (`/inference/…`), NOT the same host's account/usage endpoints
 * (`/zen/go/…`, `/inference/go/…`) or anything else — those must pass through
 * untouched so per-provider limits reads keep working.
 */
export function shouldTunnel(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.host === BUN_TUNNEL_HOST &&
      parsed.pathname.startsWith("/inference/") &&
      !parsed.pathname.startsWith("/inference/go/")
    );
  } catch {
    return false;
  }
}

/**
 * Wrap `fetch` so OpenCode inference traffic rides the Bun worker; everything
 * else passes through unchanged.
 */
export function withBunTunnel(base: typeof fetch): typeof fetch {
  const prior = base;
  const wrapper = ((input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url;
    if (typeof url === "string" && shouldTunnel(url)) return bunFetch(input, init);
    // Passthrough prefers the CURRENT global fetch, so a later monkeypatch (a
    // test stub) is honoured rather than this wrapper shadowing it.
    const current = (globalThis as any).fetch;
    const target = current !== undefined && current !== wrapper ? current : prior;
    return (target ?? fetch)(input, init);
  }) as typeof fetch;
  return wrapper;
}
