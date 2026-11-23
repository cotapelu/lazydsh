/**
 * CLI authentication
 *
 * `lazydsh login` / `lazydsh logout` reuse the TUI's auth flows
 * (`auth-flow.ts`) but run without a TUI: transcript notices become stdout
 * lines, and the login dialogs become stdin prompts. This module is the
 * terminal implementation of `AuthHost` plus those prompts, so both entry
 * points share one auth path instead of duplicating it.
 */

import { createInterface } from "node:readline";
import { formatNotification, safeText, terminalColor } from "./theme.ts";
import { openAuthUrl } from "./open-url.ts";
import { authenticateProvider, type AuthHost } from "./auth-flow.ts";
import type { Callbacks } from "../interfaces.ts";
import type { Runtime } from "../runtime/runtime.ts";

/** One option row a terminal picker can offer. */
export interface CliOption {
  value: string;
  label: string;
  description?: string;
}

/** One line of terminal input. Resolves `null` on EOF (Ctrl+D). */
export function askLine(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    rl.on("close", () => settle(null));
    rl.question(prompt, (answer) => {
      settle(answer);
      rl.close();
    });
  });
}

/** One line of terminal input with the typed characters masked (API keys). */
export function askSecret(prompt: string): Promise<string | null> {
  const input = process.stdin;
  // A piped stdin cannot echo, so a plain read is the honest fallback.
  if (!input.isTTY) return askLine(prompt);
  return new Promise((resolve) => {
    input.setRawMode(true);
    input.resume();
    output(prompt);
    let value = "";
    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      output("\n");
      resolve(result);
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") return finish(value.trim() || null);
        // Ctrl+C and Ctrl+D abandon the prompt without submitting.
        if (char === "\u0003" || char === "\u0004") return finish(null);
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        // C0 controls, DEL, and C1 (CSI and friends, e.g. bracketed paste)
        // carry no key material.
        const code = char.codePointAt(0)!;
        if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
        value += char;
      }
    };
    input.on("data", onData);
  });
}

function output(text: string) {
  process.stdout.write(text);
}

/** Resolve a typed answer (1-based number or exact value) against options. */
export function resolveChoice<T extends CliOption>(
  answer: string,
  options: readonly T[],
): T | undefined {
  const trimmed = answer.trim();
  if (trimmed === "") return undefined;
  return options[Number(trimmed) - 1] ?? options.find((option) => option.value === trimmed);
}

/** Print a numbered list and read one choice; throws when none is made. */
export async function pickCliProvider(
  options: readonly CliOption[],
  title: string,
): Promise<string> {
  if (options.length === 0) throw new Error("No providers available.");
  output(`${safeText(title)}\n`);
  for (const [index, option] of options.entries()) {
    const description = option.description?.trim() ? ` — ${safeText(option.description)}` : "";
    output(`  ${index + 1}) ${safeText(option.label)}${description}\n`);
  }
  const answer = await askLine(`Choose (1-${options.length}, or a provider id): `);
  if (answer === null) throw new Error("Provider selection cancelled.");
  const chosen = resolveChoice(answer, options);
  if (chosen === undefined) throw new Error(`Unknown provider: ${answer.trim()}`);
  return chosen.value;
}

/**
 * The terminal prompts standing in for the TUI login dialogs. Both DSH prompt
 * shapes are handled here, so `runtime.authenticate()` runs unchanged.
 */
async function cliOnAuth(
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) return null;
  const message = typeof params.message === "string" ? params.message : "Login";
  // OAuth notices carry a URL and an optional device code: show them, open the
  // browser, and let the flow continue (the answer is not read here).
  if (method === "lazydsh/auth-notice") {
    const url = typeof params.url === "string" ? params.url : undefined;
    const code = typeof params.code === "string" ? params.code : undefined;
    output(`${safeText([message, url, code].filter(Boolean).join("\n"))}\n`);
    void openAuthUrl(url);
    return null;
  }
  if (params.kind === "select") {
    const options = Array.isArray(params.options)
      ? (params.options as { id: string; label: string; description?: string }[]).map((item) => ({
          value: item.id,
          label: item.label,
          ...(item.description === undefined ? {} : { description: item.description }),
        }))
      : [];
    if (options.length === 0) return null;
    output(`${safeText(message)}\n`);
    for (const [index, option] of options.entries()) {
      const description = option.description?.trim() ? ` — ${safeText(option.description)}` : "";
      output(`  ${index + 1}) ${safeText(option.label)}${description}\n`);
    }
    const answer = await askLine(`Choose (1-${options.length}): `);
    if (answer === null) return null;
    return resolveChoice(answer, options)?.value ?? null;
  }
  if (params.kind === "secret") {
    const answer = await askSecret(`${safeText(message)}: `);
    return answer === null ? null : answer;
  }
  const answer = await askLine(`${safeText(message)}: `);
  return answer === null ? null : answer.trim() || null;
}

/** The terminal stand-in for the TUI's `AuthHost`. */
export function createCliAuthHost(runtime: Runtime, signal: AbortSignal): AuthHost {
  const add = (label: string, text?: unknown) =>
    console.log(formatNotification(label, text, terminalColor(process.stdout)));
  return {
    runtime,
    callbacks: { onAuth: cliOnAuth } satisfies Callbacks,
    signal,
    tui: { requestRender: () => {}, setTerminalColorSchemeNotifications: () => {} },
    add,
    runBusy: async (action, errorLabel = "Error") => {
      try {
        await action();
      } catch (error) {
        add(errorLabel, error instanceof Error ? error.message : String(error));
      }
    },
    showPanel: () => {},
    dismissPanel: () => {},
    isClosing: () => false,
    editor: { getText: () => "", setText: () => {} },
    forgetAnnounced: () => {},
    takeBlockedPrompt: () => undefined,
    requestRender: () => {},
    refreshStats: async () => {},
  };
}

/** Providers a `/logout` picker can offer: those with stored credentials. */
export async function storedCredentialOptions(runtime: Runtime): Promise<CliOption[]> {
  const stored: CliOption[] = [];
  for (const provider of runtime.authProviders())
    if (await runtime.hasCredentials(provider.value))
      stored.push({
        value: provider.value,
        label: provider.label,
        description: provider.description,
      });
  return stored;
}

/** Run one CLI login through the shared provider-login flow. */
export async function cliLogin(
  runtime: Runtime,
  provider: string | undefined,
  signal: AbortSignal,
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("Provider selection and login require an interactive terminal.");
  const host = createCliAuthHost(runtime, signal);
  const target =
    provider ??
    (await pickCliProvider(
      runtime.authProviders().map((item) => ({
        value: item.value,
        label: item.label,
        description: item.description,
      })),
      "Choose a provider to log in to:",
    ));
  await authenticateProvider(host, target);
}

/** Run one CLI logout, picking a stored credential when none was given. */
export async function cliLogout(runtime: Runtime, provider: string | undefined): Promise<void> {
  let target = provider;
  if (target === undefined) {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new Error("Provider selection and login require an interactive terminal.");
    const stored = await storedCredentialOptions(runtime);
    if (stored.length === 0) {
      // Same notice the TUI /logout flow shows: env vars and config stay put.
      console.log(
        formatNotification(
          "Logout",
          "No stored credentials to remove. /logout only removes credentials saved by /login; environment variables and models.json config are unchanged.",
          terminalColor(process.stdout),
        ),
      );
      return;
    }
    target = await pickCliProvider(stored, "Choose a provider to log out of:");
  }
  const remaining = await runtime.logout(target);
  if (remaining === undefined) {
    console.log(
      formatNotification("Logout", `Not logged in to ${target}.`, terminalColor(process.stdout)),
    );
    return;
  }
  console.log(formatNotification("Logged out", target, terminalColor(process.stdout)));
  if (remaining.length)
    console.error(
      `Credentials are still available from ${remaining.join(", ")}. Unset them to disconnect.`,
    );
}
