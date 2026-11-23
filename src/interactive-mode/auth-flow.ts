/**
 * Auth flows
 *
 * The `/login` and `/logout` flows: provider pickers, the DSH authenticate /
 * logout calls, and the transcript rows they leave behind. Extracted from
 * `ui.ts` so the orchestrator only wires the host services below and the
 * credential logic lives (and reads) on its own.
 */

import type { Component } from "@earendil-works/pi-tui";
import { AuthorizationDeclinedError } from "@deepseek-ai/dsh-authorization";
import { OAuthSelectorComponent, type ProviderOption } from "./components/oauth-selector.ts";
import type { Runtime } from "../runtime/runtime.ts";
import type { Callbacks, CredentialSource } from "../interfaces.ts";

/** Orchestrator services the login/logout flows need. */
export interface AuthHost {
  readonly runtime: Runtime;
  readonly callbacks: Callbacks;
  /** Abort signal handed to `runtime.authenticate`. */
  readonly signal: AbortSignal | undefined;
  /** TUI handle the OAuth selector needs for placement and rendering. */
  readonly tui: {
    requestRender: () => void;
    setTerminalColorSchemeNotifications: (enabled: boolean) => void;
  };
  /** Append a transcript row. */
  add(label: string, text?: unknown): void;
  /** Wrap an action in the busy indicator; a throw surfaces as an Error row. */
  runBusy(action: () => Promise<unknown>, errorLabel?: string): Promise<void>;
  showPanel(panel: Component): void;
  dismissPanel(): void;
  /** True once the TUI started shutting down — in-flight flows must bail. */
  isClosing(): boolean;
  /** Editor access: a login blocked mid-prompt restores the draft afterwards. */
  editor: { getText: () => string; setText: (text: string) => void };
  /** Drop the per-provider "notice already announced" marker. */
  forgetAnnounced(provider: string): void;
  /** Take the prompt that was waiting for this login, if any. */
  takeBlockedPrompt(): string | undefined;
  /** Repaint after the prompt is restored. */
  requestRender(): void;
  /** Re-read the token/cache stats after credentials change. */
  refreshStats(): Promise<void>;
}

/** Build the two rows (OAuth + API key) the login selector shows per provider. */
export async function buildLoginProviderOptions(host: AuthHost): Promise<ProviderOption[]> {
  const options: ProviderOption[] = [];
  const flows = host.runtime.ctx.authorization.list();
  for (const provider of host.runtime.authProviders()) {
    const providerId = provider.value;
    const authStatus: CredentialSource = await host.runtime.credentialSource(providerId);
    const status =
      authStatus.kind !== "none"
        ? {
            type: (authStatus.kind === "keyless" ? "oauth" : "api_key") as "oauth" | "api_key",
            source: authStatus.label,
          }
        : undefined;
    const flow = flows.find((entry) => entry.key === `llm-pi-ai/${providerId}`);
    const methods = flow?.methods ?? [];
    if (methods.length === 0) {
      // Providers without an authorization flow (e.g. DeepSeek) authenticate
      // with an API key only.
      options.push({
        id: providerId,
        name: provider.label,
        authType: "api_key",
        status,
        subscription: false,
      });
      continue;
    }
    for (const method of methods) {
      const authType = method.id === "oauth" ? "oauth" : "api_key";
      options.push({
        id: providerId,
        name: provider.label,
        authType,
        status,
        subscription: false,
        method: { loginLabel: method.label },
      });
    }
  }
  return options.sort((a: ProviderOption, b: ProviderOption) => a.name.localeCompare(b.name));
}

/**
 * Run one provider login. Both auth types go through the same DSH call — the
 * callbacks own the OAuth notice and the API-key prompt — so this is a single
 * path, not a per-type branch.
 */
export async function authenticateProvider(host: AuthHost, providerId: string): Promise<void> {
  try {
    const notice = await host.runtime.authenticate(host.signal, {
      provider: providerId,
      onAuth: host.callbacks.onAuth,
    });
    if (notice !== undefined) {
      host.add("Login", notice);
      return;
    }
  } catch (error) {
    if (host.isClosing()) return;
    if (error instanceof AuthorizationDeclinedError) {
      host.add("Login", "Cancelled.");
      return;
    }
    throw error;
  }
  if (host.isClosing()) return;
  host.forgetAnnounced(providerId);
  host.add("Logged in", providerId);
  // A login that unblocked a queued prompt puts the draft back in the editor.
  const blocked = host.takeBlockedPrompt();
  if (blocked !== undefined) {
    if (host.editor.getText().length === 0) host.editor.setText(blocked);
    host.requestRender();
  }
}

/** `/login` — pick a provider (or use the given one) and authenticate it. */
export async function signIn(host: AuthHost, provider?: string): Promise<void> {
  await host.runBusy(async () => {
    if (provider === undefined) {
      const selector = new OAuthSelectorComponent(
        "login",
        await buildLoginProviderOptions(host),
        async (providerId, _authType) => {
          host.dismissPanel();
          await authenticateProvider(host, providerId);
        },
        () => host.dismissPanel(),
        undefined,
        host.tui,
      );
      host.showPanel(selector);
      return;
    }
    await authenticateProvider(host, provider);
  }, "Error");
}

/** Providers with a stored credential the `/logout` selector can remove. */
export async function buildLogoutProviderOptions(host: AuthHost): Promise<ProviderOption[]> {
  const options: ProviderOption[] = [];
  for (const provider of host.runtime.authProviders()) {
    const providerId = provider.value;
    if (!(await host.runtime.hasCredentials(providerId))) continue;
    const isOAuth = provider.description.includes("OAuth");
    options.push({
      id: providerId,
      name: providerId,
      authType: isOAuth ? "oauth" : "api_key",
      status: { type: isOAuth ? "oauth" : "api_key", source: "stored credential" },
      subscription: false,
    });
  }
  return options.sort((a: ProviderOption, b: ProviderOption) => a.name.localeCompare(b.name));
}

/** Remove one provider's stored credential and refresh the footer stats. */
export async function performLogout(
  host: AuthHost,
  providerId: string,
  onLoggedOut: () => Promise<void>,
): Promise<void> {
  try {
    await host.runtime.logout(providerId);
    await onLoggedOut();
    host.add("Logged out", providerId);
  } catch (error) {
    if (host.isClosing()) return;
    host.add("Logout failed", error instanceof Error ? error.message : String(error));
  }
}

/** `/logout` — pick a stored credential to remove (or use the given provider). */
export async function signOut(host: AuthHost, provider?: string): Promise<void> {
  await host.runBusy(async () => {
    if (provider === undefined) {
      const logoutOptions = await buildLogoutProviderOptions(host);
      if (logoutOptions.length === 0) {
        host.add(
          "Logout",
          "No stored credentials to remove. /logout only removes credentials saved by /login; environment variables and models.json config are unchanged.",
        );
        return;
      }
      const selector = new OAuthSelectorComponent(
        "logout",
        logoutOptions,
        async (providerId, _authType) => {
          host.dismissPanel();
          await performLogout(host, providerId, () => host.refreshStats());
        },
        () => host.dismissPanel(),
        undefined,
        host.tui,
      );
      host.showPanel(selector);
      return;
    }
    await performLogout(host, provider, () => host.refreshStats());
  }, "Error");
}
