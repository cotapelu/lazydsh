import { QuestionPanel } from "./question.ts";
import { ApprovalPanel } from "./approval.ts";
import { historyRows, continuationCommand } from "./history.ts";
import { openAuthUrl } from "./open-url.ts";
import { homedir } from "node:os";
import { sep } from "node:path";
import { preferencesPath, saveModel } from "./preferences.ts";
import { normalizeProvider } from "./provider.ts";
import { SearchPicker, selectionTheme } from "./picker.ts";
import { highlightCode } from "./highlight.ts";
import type { SessionStats } from "./stats.ts";
import { Autocomplete } from "./autocomplete.ts";
import { commandMenu } from "./commands.ts";
import type { RuntimeOptions, QuestionResult } from "./runtime.ts";
import type { AdmittedPromptContentPart } from "@deepseek-ai/dsh-attachment";
import { ToolLog, ToolRow } from "./tools.ts";
import { SessionSelector } from "./session-selector.js";
import { LoginDialog } from "./components/login-dialog.js";
import { AssistantMessageComponent } from "./components/assistant-message.js";
import { UserMessageComponent } from "./components/user-message.js";
import { editInExternalEditor, editorCommand } from "./external-editor.ts";
import { reportBug } from "./bug-report.ts";
import { showChangelog } from "./show-changelog.ts";
import { extensionWidgets, createExtensionWidgetContainer } from "./extensions.ts";
import { copyToClipboard } from "./clipboard.ts";
import { ProgramStatusReporter } from "./program-status.ts";
import { StatusIndicatorContainer } from "./components/status-container.js";
import { FooterComponent } from "./footer.js";
import { createFooterDataProvider } from "./footer-data-provider.js";
import { getKeybindings } from "@earendil-works/pi-tui";
import type { SessionRecord } from "./components/session-selector-search.js";
import {
  TuiAltScreen,
  ScrollView,
  VStack,
  ProcessTerminal,
  Text,
  Container,
  type Component,
} from "@earendil-works/pi-tui";
import { eventText, isAuthFailure } from "./runtime-events.ts";
import { AuthorizationDeclinedError } from "@deepseek-ai/dsh-authorization";
import type { Runtime, Route, Callbacks, CredentialSource } from "./runtime.ts";
import {
  resumeDirectoryOptions,
  resumeDirectoryTarget,
  sameDirectory,
} from "./resume-directory.ts";
import { StreamingMarkdown } from "./streaming.ts";
import { captureConsole } from "./tui-console.ts";
import { dshCachePath } from "@deepseek-ai/dsh-home-paths";

import {
  StatusPanel,
  PromptEditor,
  QueuedMessage,
  QueueView,
  Notification,
  Transcript,
  ThinkingView,
  editorBorder,
} from "./presentation.ts";
import { HeaderComponent } from "./components/header.js";
import { safeText, accent, dim } from "./theme.ts";

const identity = (text: string) => text;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
export const markdownTheme = {
  highlightCode,
  heading: bold,
  link: accent,
  linkUrl: dim,
  code: accent,
  codeBlock: identity,
  codeBlockBorder: dim,
  quote: dim,
  quoteBorder: dim,
  hr: dim,
  listBullet: accent,
  bold,
  italic: identity,
  strikethrough: identity,
  underline: identity,
};

export function canRunDuringTurn(text: string) {
  return (
    /^\/plan(?:\s+off)?$/.test(text.trim()) ||
    /^\/(?:status|session|ps|stop|effort|permission|cd|file|clear|quit)(?:\s|$)/.test(text.trim())
  );
}

export function shouldQueueDuringTurn(text: string) {
  return Boolean(text.trim()) && !/^\s*\//.test(text) && !canRunDuringTurn(text);
}

/**
 * The Runtime handed to the TUI before the deferred plugins load is a proxy that
 * throws on any access. These helpers let the footer render an empty bar during
 * that window instead of failing the first paint.
 */
function safeRead<T>(runtime: Runtime, read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}
function safeSessionId(runtime: Runtime): string {
  try {
    return runtime.session?.id ?? "";
  } catch {
    return "";
  }
}
function safeLeafId(runtime: Runtime): string {
  try {
    return String(runtime.session?.seq ?? 0);
  } catch {
    return "0";
  }
}
function safeSessionName(runtime: Runtime): string | undefined {
  try {
    const name = runtime.sessionManager?.getSessionName?.();
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}

/** Map DSH session records onto the selector's view model. */
function toSessionRecords(
  records: Awaited<ReturnType<Runtime["sessions"]>>,
  currentDirectory: string,
): SessionRecord[] {
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    directory: record.directory ?? currentDirectory,
    archived: record.archived,
    pinned: record.pinned,
    modified: record.modified,
    messageCount: record.messageCount,
  }));
}

export async function runUI(
  options: RuntimeOptions & { cwd: string },
  initial: {
    provider: string;
    model?: string;
    resume?: string;
    resumeDirectory?: string;
    resumeArgs?: string[];
  },
  runtime: Runtime,
  hooks: { afterFirstPaint?: () => Promise<void> } = {},
) {
  const tui = new TuiAltScreen(new ProcessTerminal(), false, undefined, {
    mouse: true,
    scrollToEndIndicator: () => dim("↓ latest"),
  });
  const header = new HeaderComponent({ version: "0.2.0" });
  const transcript = new Transcript();
  // Prompts typed during a running turn wait below the transcript; drainQueue sends
  // them one at a time as each turn finishes.
  const queueView = new QueueView();
  const queue: { text: string; view: QueuedMessage }[] = [];
  const statusContainer = new StatusIndicatorContainer(tui);
  const programStatus = new ProgramStatusReporter(tui);

  // Context footer: pwd/git branch • session name, then tokens, cache hit
  // rate, cost, context %, model and thinking level. Data comes from the
  // provider (git/cwd) and from the session manager + projections.
  const footerDataProvider = createFooterDataProvider(
    options.cwd,
    () => {
      // The runtime is a lazy proxy until the deferred plugins attach, so every
      // read here must tolerate an unstarted runtime rather than throw during
      // the first paint.
      try {
        const name = runtime.sessionManager?.getSessionName?.();
        return typeof name === "string" ? name : undefined;
      } catch {
        return undefined;
      }
    },
    () => ({
      getAvailableSnapshot: () => [],
      getProviders: () => {
        try {
          return runtime.authProviders();
        } catch {
          return [];
        }
      },
    }),
  );
  footerDataProvider.onBranchChange(() => tui.requestRender());
  const footerContainer = new Container();

  /**
   * Build the footer on first use. Reading the runtime is only safe once the
   * deferred plugins have attached, so the component is created lazily and the
   * session adapter reads through safe accessors on every render.
   */
  let footer: FooterComponent | undefined;
  const footerSession = () => ({
    sessionManager: {
      getCwd: () => options.cwd,
      getSessionId: () => safeSessionId(runtime),
      getLeafId: () => safeLeafId(runtime),
      getEntryCount: () => 0,
      getSessionName: () => safeSessionName(runtime),
      getEntries: () => [],
    },
    routedModel: safeRead(runtime, () => runtime.routedModel),
    model: safeRead(runtime, () => {
      const selection = runtime.selection();
      return selection === undefined
        ? undefined
        : {
            provider: selection.provider,
            id: selection.model,
            contextWindow: runtime.contextUsage?.contextWindow,
          };
    }),
    thinkingLevel: safeRead(runtime, () => runtime.thinkingLevel),
    autoCompactionEnabled: true,
    getContextUsage: () => safeRead(runtime, () => runtime.contextUsage),
  });
  function ensureFooter(): FooterComponent {
    if (footer === undefined) {
      footer = new FooterComponent({ session: footerSession(), footerData: footerDataProvider });
      footerContainer.addChild(footer);
    }
    return footer;
  }
  const editor = new PromptEditor(tui, {
    borderColor: editorBorder,
    selectList: { ...selectionTheme, noMatch: dim },
  });
  const toolLog = new ToolLog();
  let route = initial;
  let resume = initial.resume;
  let resumeDirectory = initial.resumeDirectory;
  let commands = commandMenu();
  let stats: SessionStats | undefined;
  let pendingFiles: AdmittedPromptContentPart[] = [];
  let thinking: ThinkingView | undefined;
  let busy = false;
  let starting = false;
  let startupFailed = false;
  let checkingAuth = false;
  let blockedPrompt: string | undefined;
  const announcedAuth = new Set<string>();
  let running = false;
  let closing = false;
  // Set while Esc cancels the active turn so queued prompts wait for the
  // runtime to go idle instead of draining into the turn being cancelled.
  let stopping = false;
  let submittingQueued = false;
  let continuationId: string | undefined;
  let pendingStartupConnection: { route: Route; sessionId?: string } | undefined;
  let decision: ((value: string | null) => void) | undefined;
  let selecting = false;
  const { promise: done, resolve: finish } = Promise.withResolvers<void>();

  const history = new Container();
  history.addChild(header);
  history.addChild(transcript);
  history.addChild(queueView);
  const scroll = new ScrollView(history, { primary: true, follow: "end", scrollbar: "auto" });
  const widgetsAbove = createExtensionWidgetContainer(extensionWidgets, "above");
  const widgetsBelow = createExtensionWidgetContainer(extensionWidgets, "below");
  tui.setLayoutRoot(
    new VStack([
      { component: scroll, basis: 0, grow: 1, minSize: 1 },
      { component: statusContainer, shrink: 0 },
      { component: widgetsAbove, shrink: 0 },
      { component: editor, shrink: 0 },
      { component: widgetsBelow, shrink: 0 },
      { component: footerContainer, shrink: 0 },
    ]),
  );
  tui.setFocus(editor);
  setAutocomplete();

  function setAutocomplete() {
    editor.setAutocompleteProvider(
      new Autocomplete(commands, options.cwd, (query, signal) =>
        runtime.session ? runtime.references(query, signal) : Promise.resolve([]),
      ),
    );
  }

  async function runBusy(action: () => Promise<unknown>, label = "Error") {
    busy = true;
    update();
    try {
      await action();
    } catch (error) {
      add(label, error instanceof Error ? error.message : String(error));
    } finally {
      busy = false;
      update();
    }
  }

  function update() {
    const directory = stats?.session?.directory ?? options.cwd;
    const home = homedir();
    const displayDirectory =
      directory === home
        ? "~"
        : directory.startsWith(home + sep)
          ? "~" + directory.slice(home.length)
          : directory;
    const queued = queue.length ? ` · ${queue.length} queued` : "";
    // The route/context line lives in the footer; the queue count rides the status area.
    if (queued) {
      statusContainer.show("idle", { message: `Ready · ${queue.length} queued` });
      programStatus.idle(
        `${route.provider}/${route.model ?? "no model"} · ${displayDirectory}${queued}`,
      );
    } else {
      programStatus.idle(`${route.provider}/${route.model ?? "no model"} · ${displayDirectory}`);
    }
    editor.disableSubmit = (busy || starting || startupFailed || stopping) && !decision;
    tui.requestRender();
  }

  async function refreshStats() {
    const sessionId = runtime.session?.id;
    try {
      const next = await runtime.stats();
      if (runtime.session?.id === sessionId && !closing) {
        stats = next;
        footerDataProvider.setCwd(options.cwd);
        ensureFooter().invalidate();
        update();
      }
    } catch {
      if (runtime.session?.id === sessionId && !closing) {
        stats = undefined;
        update();
      }
    }
  }

  function add(label: string, text: unknown = "", stop?: "aborted" | "length" | "error") {
    if (label === "You") {
      transcript.addChild(new UserMessageComponent(String(text)));
      tui.requestRender();
      return;
    }
    if (label === "assistant") {
      // Final answers render as one assistant message: markdown text, OSC133
      // zone markers, and the stop reason (length/aborted/error).
      transcript.addChild(
        new AssistantMessageComponent({
          content: [{ type: "text", text: safeText(text) }],
          ...(stop === undefined ? {} : { stopReason: stop }),
        }),
      );
      tui.requestRender();
      return;
    }
    transcript.addChild(new Notification(label, text));
    tui.requestRender();
  }

  function clearQueue() {
    const count = queue.length;
    for (const item of queue) queueView.removeChild(item.view);
    queue.length = 0;
    if (count && !closing) update();
    return count;
  }

  function enqueue(text: string) {
    editor.addToHistory(text);
    editor.setText("");
    const view = new QueuedMessage(text);
    queue.push({ text, view });
    queueView.addChild(view);
    scroll.scrollToEnd();
    update();
  }

  function drainQueue() {
    if (closing || running || stopping || decision || !queue.length) return;
    const next = queue.shift()!;
    queueView.removeChild(next.view);
    submittingQueued = true;
    try {
      editor.onSubmit?.(next.text);
    } finally {
      submittingQueued = false;
    }
    update();
  }

  function ask(message: string, signal?: AbortSignal) {
    if (closing || signal?.aborted) return Promise.resolve(null);
    if (decision) return Promise.reject(new Error("Another question is already open."));
    add("Input", message);
    editor.setText("");
    return new Promise<string | null>((resolve) => {
      const settle = (value: string | null) => {
        signal?.removeEventListener("abort", abort);
        decision = undefined;
        editor.setText("");
        update();
        resolve(value);
      };
      const abort = () => settle(null);
      decision = settle;
      signal?.addEventListener("abort", abort, { once: true });
      update();
    });
  }

  const callbacks: Callbacks = {
    onAuth: async (method, params, signal) => {
      if (signal?.aborted) return null;
      if (decision) throw new Error("Another question is already awaiting an answer.");
      const message = typeof params.message === "string" ? params.message : "Login";
      // OAuth notices carry a URL and an optional device code; the dialog shows
      // both and opens the browser.
      if (method === "lazydsh/auth-notice") {
        void openAuthUrl(params.url);
        const dialog = new LoginDialog(
          {
            kind: "notice",
            message,
            ...(typeof params.url === "string" ? { url: params.url } : {}),
            ...(typeof params.code === "string" ? { code: params.code } : {}),
          },
          tui,
        );
        signal?.addEventListener("abort", () => dialog.cancel(), { once: true });
        showPanel(dialog);
        return await dialog.whenDone();
      }
      if (params.kind === "secret" || params.kind === "select") {
        const options =
          params.kind === "select" && Array.isArray(params.options)
            ? (params.options as { id: string; label: string; description?: string }[])
            : undefined;
        if (params.kind === "select" && (options?.length ?? 0) === 0) return null;
        const dialog: LoginDialog = new LoginDialog(
          {
            kind: params.kind,
            message,
            ...(options === undefined ? {} : { options }),
          },
          tui,
        );
        signal?.addEventListener("abort", () => dialog.cancel(), { once: true });
        showPanel(dialog);
        return await dialog.whenDone();
      }
      return ask(message, signal);
    },
    onApproval: async (params) => {
      if (closing || params.signal?.aborted) return { outcome: "cancelled" };
      if (decision) throw new Error("Another question is already awaiting an answer.");
      return new Promise<{ outcome: "allowed-once" | "rejected" | "cancelled" }>((resolve) => {
        const panel = new ApprovalPanel({
          toolName: params.toolName,
          reason: params.displayReason?.en ?? params.reason,
        });
        let settled = false;
        const settle = (outcome: "allowed-once" | "rejected" | "cancelled") => {
          if (settled) return;
          settled = true;
          params.signal?.removeEventListener("abort", abort);
          decision = undefined;
          dismissPanel();
          add(
            "Permission",
            outcome === "allowed-once"
              ? `${params.toolName}: allowed once`
              : `${params.toolName}: ${outcome}`,
          );
          resolve({ outcome });
        };
        const abort = () => settle("cancelled");
        panel.onSelect = settle;
        panel.onCancel = abort;
        decision = abort;
        params.signal?.addEventListener("abort", abort, { once: true });
        showPanel(panel);
        update();
      });
    },
    onUserQuestion: async (request, { signal }) => {
      if (closing || signal.aborted) return { cancelled: true };
      if (decision) throw new Error("Another question is already awaiting an answer.");
      return new Promise((resolve) => {
        const panel = new QuestionPanel(
          request.questions,
          Math.max(1, Math.min(6, tui.terminal.rows - 12)),
        );
        let settled = false;
        const settle = (answer: QuestionResult) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", abort);
          decision = undefined;
          dismissPanel();
          if ("answers" in answer)
            add(
              "Answered",
              answer.answers
                .map((item) => [...item.selected, ...(item.custom ? [item.custom] : [])].join(", "))
                .join(" · "),
            );
          resolve(answer);
        };
        const abort = () => settle({ cancelled: true });
        panel.onAnswer = settle;
        panel.onCancel = abort;
        decision = abort;
        signal.addEventListener("abort", abort, { once: true });
        showPanel(panel);
        update();
      });
    },
  };

  async function persistSelection() {
    const selection = runtime.selection();
    if (selection) await saveModel(preferencesPath(options.dshHome), selection);
  }

  async function connect(
    nextRoute: Route,
    sessionId?: string,
    notifyModel = false,
    startup = false,
    directory?: string,
  ) {
    pendingStartupConnection = undefined;
    busy = true;
    update();
    try {
      const id = await runtime.open(nextRoute, { ...callbacks, resume: sessionId });
      if (closing) return;
      const requestedDirectory =
        directory ??
        (sessionId !== undefined && sessionId === initial.resume ? resumeDirectory : undefined);
      if (sessionId !== undefined && requestedDirectory !== undefined) {
        await runtime.cd(requestedDirectory);
        if (resumeDirectory === requestedDirectory) resumeDirectory = undefined;
      }
      await persistSelection();
      // The provider count reads the runtime, which is only live after the
      // deferred plugins attach; seed it here rather than during first paint.
      try {
        footerDataProvider.setAvailableProviderCount(runtime.authProviders().length);
        footerDataProvider.setCwd(options.cwd);
        ensureFooter();
      } catch {
        // The footer is cosmetic; never block the session on it.
      }
      commands = commandMenu(await runtime.commands());
      options.cwd = await runtime.cd();
      setAutocomplete();
      continuationId = id;
      pendingFiles = [];
      toolLog.entries.clear();
      clearQueue();
      transcript.clear();
      if (sessionId) {
        for (const row of historyRows(await runtime.history(), id)) {
          if (row instanceof ToolRow) transcript.addChild(row);
          else if (row.kind === "metrics") transcript.addChild(new Text(dim(row.text), 2, 1));
          else
            add(
              row.kind === "user"
                ? "You"
                : row.kind === "assistant"
                  ? "assistant"
                  : (row.label ?? "dsh"),
              row.text,
            );
        }
        scroll.scrollToEnd();
      }
      route = nextRoute;
      if (notifyModel) add("Model", `${nextRoute.provider} / ${nextRoute.model}`);
      stats = undefined;
      await refreshStats();
      resume = undefined;
      if (sessionId) add("Resumed", id);
      if (requestedDirectory !== undefined) add("Directory", requestedDirectory);
      void probeCredentialSource(nextRoute.provider);
    } catch (error) {
      decision?.(null);
      await runtime.close();
      if (startup && isAuthFailure(error))
        pendingStartupConnection = { route: nextRoute, sessionId };
      else if (!closing)
        add(
          "Error",
          `${error instanceof Error ? error.message : String(error)}\n${
            isAuthFailure(error)
              ? `Run /login ${nextRoute.provider}, then resend.`
              : "Run /model to choose another model."
          }`,
        );
    } finally {
      busy = false;
      if (!closing) update();
    }
  }

  function dismissPanel() {
    selecting = false;
    tui.setFocus(editor);
    tui.requestRender();
  }

  /** Show a panel (picker, dialog) above the editor while keeping focus. */
  function showPanel(panel: Component) {
    selecting = true;
    programStatus.blocked("question", "Waiting for input");
    tui.setFocus(panel);
    tui.requestRender();
  }

  function select(
    items: import("@earendil-works/pi-tui").SelectItem[],
    title: string,
    onSelect: (value: string) => void,
    selected?: string,
    searchable = true,
  ) {
    const picker = new SearchPicker(
      items,
      title,
      Math.max(1, Math.min(6, tui.terminal.rows - 10)),
      selected,
      searchable,
    );
    picker.onCancel = dismissPanel;
    picker.onSelect = (value) => {
      dismissPanel();
      onSelect(value);
    };
    showPanel(picker);
    return picker;
  }

  async function chooseResumeDirectory(sessionId: string) {
    const sessionDirectory = await runtime.sessionDirectory(sessionId);
    if (!sessionDirectory || (await sameDirectory(sessionDirectory, options.cwd))) return undefined;
    const choice = await new Promise<string | null>((resolve) => {
      const picker: SearchPicker = select(
        resumeDirectoryOptions(sessionDirectory, options.cwd),
        "Resume in directory",
        resolve,
        "session",
        false,
      );
      picker.onCancel = () => {
        dismissPanel();
        resolve(null);
      };
    });
    return choice === null ? null : resumeDirectoryTarget(choice, options.cwd);
  }

  async function pickModel(sessionId = runtime.session?.id ?? resume) {
    const { providers } = await import("./catalog.ts");
    const providerPicker = select(
      providers.map((id) => ({ value: id, label: id })),
      "Providers",
      (provider) => {
        void pickProviderModel(provider, sessionId, providerPicker);
      },
      undefined,
      true,
    );
  }

  async function pickProviderModel(provider: string, sessionId?: string, parent?: SearchPicker) {
    const { models } = await import("./catalog.ts");
    const picker: SearchPicker = select(
      models(provider).map((model) => ({
        value: model.id,
        label: model.id,
        description: model.name,
      })),
      "Models",
      (model) => {
        void connect({ provider, model }, sessionId, true);
      },
      undefined,
      true,
    );
    picker.onCancel = () => {
      if (parent) showPanel(parent);
      else void pickModel(sessionId);
    };
  }

  function chooseAuthProvider(command: "login" | "logout") {
    return new Promise<string | null>((resolve) => {
      const picker: SearchPicker = select(
        runtime.authProviders(),
        command === "login" ? "Choose a provider to log in to" : "Choose a provider to log out of",
        (value) => resolve(value),
        undefined,
        true,
      );
      picker.onCancel = () => {
        dismissPanel();
        resolve(null);
      };
    });
  }

  function announceCredentialSource(provider: string, source: CredentialSource) {
    if (source.kind !== "environment") {
      announcedAuth.delete(provider);
      return;
    }
    if (announcedAuth.has(provider)) return;
    announcedAuth.add(provider);
    add("Credentials", `Using ${source.label} for ${provider}. Unset it to switch.`);
  }

  async function probeCredentialSource(provider: string) {
    try {
      announceCredentialSource(provider, await runtime.credentialSource(provider));
    } catch {
      // An auth-source probe must never interrupt the UI.
    }
  }

  async function signIn(provider?: string) {
    await runBusy(async () => {
      provider ??= (await chooseAuthProvider("login")) ?? undefined;
      if (provider === undefined || closing) return;
      try {
        const notice = await runtime.authenticate(options.signal, {
          provider,
          onAuth: callbacks.onAuth,
        });
        if (notice !== undefined) {
          add("Login", notice);
          return;
        }
      } catch (error) {
        if (closing) return;
        if (error instanceof AuthorizationDeclinedError) {
          add("Login", "Cancelled.");
          return;
        }
        throw error;
      }
      if (closing) return;
      // A startup connection that failed before login can now be retried.
      const pending = pendingStartupConnection;
      if (pending && !runtime.session) {
        pendingStartupConnection = undefined;
        await connect(pending.route, pending.sessionId);
      }
      announcedAuth.delete(provider);
      add("Logged in", provider);
      if (blockedPrompt !== undefined) {
        if (editor.getText().length === 0) editor.setText(blockedPrompt);
        blockedPrompt = undefined;
        update();
      }
    }, "Error");
  }

  async function signOut(provider?: string) {
    await runBusy(async () => {
      provider ??= (await chooseAuthProvider("logout")) ?? undefined;
      if (provider === undefined || closing) return;
      const remaining = await runtime.logout(provider);
      if (closing) return;
      if (remaining === undefined) {
        add("Logout", `Not logged in to ${provider}.`);
        return;
      }
      announcedAuth.delete(provider);
      add("Logged out", provider);
      if (remaining.length)
        add("Credentials", `Still available from ${remaining.join(", ")}. Unset to disconnect.`);
    }, "Error");
  }

  async function stop() {
    if (closing) return;
    closing = true;
    decision?.(null);
    selecting = false;
    update();
    try {
      await runtime.close();
    } catch (error) {
      add("Error", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    } finally {
      finish();
    }
  }

  editor.onSubmit = async (text: string) => {
    const fromQueue = submittingQueued;
    if (closing) return;
    if (decision) {
      decision(text);
      return;
    }
    if (!fromQueue && (busy || starting || startupFailed || !text.trim())) return;
    if (running && !canRunDuringTurn(text)) {
      if (shouldQueueDuringTurn(text)) {
        enqueue(text);
        return;
      }
      add("Error", "A response is running. Press Esc to stop it.");
      return;
    }
    if (
      pendingStartupConnection &&
      !runtime.session &&
      !/^\/(?:model|new|clear|quit)(?:\s|$)/.test(text)
    ) {
      const pending = pendingStartupConnection;
      void connect(pending.route, pending.sessionId).then(() => {
        if (!closing && runtime.session) editor.onSubmit?.(text);
      });
      return;
    }
    const draft = fromQueue ? undefined : editor.getText();
    if (!/^\s*\//.test(text) && runtime.session) {
      if (checkingAuth) return;
      const provider = runtime.selection()?.provider ?? route.provider;
      checkingAuth = true;
      let source: CredentialSource = {
        kind: "unknown",
        label: "Provider-managed credentials",
      };
      try {
        source = await runtime.credentialSource(provider);
      } catch (error) {
        if (!closing) add("Error", error instanceof Error ? error.message : String(error));
      } finally {
        checkingAuth = false;
      }
      if (closing) return;
      if (source.kind === "none") {
        if (!fromQueue && editor.getText() === draft) {
          editor.addToHistory(text);
          editor.setText("");
          blockedPrompt = text;
        } else if (!fromQueue) blockedPrompt = undefined;
        add("Error", `Not logged in to ${provider}. Run /login ${provider}.`);
        update();
        return;
      }
      announceCredentialSource(provider, source);
      blockedPrompt = undefined;
    }
    if (!fromQueue) {
      editor.addToHistory(text);
      if (editor.getText() === draft) editor.setText("");
    }
    add("You", text);
    if (text === "/clear") {
      transcript.clear();
      if (thinking?.running) transcript.addChild(thinking);
      scroll.scrollToEnd();
      tui.resetTextSelection();
      update();
      return;
    }
    if (text === "/quit") {
      void stop();
      return;
    }
    if (text === "/bug") {
      void (async () => {
        const url = await reportBug(runtime, options, text.slice(4).trim());
        add("Bug Report", `Opened GitHub issue: ${url}`);
      })();
      return;
    }
    if (text === "/share") {
      void (async () => {
        const { generateShareLink } = await import("./session-share.ts");
        const url = await generateShareLink(runtime, options);
        add("Share", `Session share link: ${url}`);
      })();
      return;
    }
    if (text === "/changelog") {
      showChangelog(tui, showPanel, dismissPanel);
      return;
    }
    if (text === "/settings") {
      const { SettingsSelectorComponent } = await import("./settings-selector.ts");
      const settings = new SettingsSelectorComponent(tui);
      settings.onCancel = dismissPanel;
      showPanel(settings);
      return;
    }
    if (text === "/model") {
      void pickModel();
      return;
    }
    if (text === "/new") {
      if (route.model) void connect({ provider: route.provider, model: route.model });
      else void pickModel();
      return;
    }
    const authCommand = /^\/(login|logout)(?:\s+(.*))?$/.exec(text);
    if (authCommand) {
      const action = authCommand[1] as "login" | "logout";
      const argument = authCommand[2]?.trim();
      if (argument && /\s/.test(argument)) {
        add("Error", `Usage: /${action} [provider]`);
        return;
      }
      const provider = argument ? normalizeProvider(argument) : undefined;
      if (provider !== undefined) {
        const available = runtime.authProviders();
        if (!available.some((item) => item.value === provider)) {
          add(
            "Error",
            `Unknown provider: ${provider}. Choose from: ${available.map((item) => item.value).join(", ")}.`,
          );
          return;
        }
      }
      if (action === "login") void signIn(provider);
      else void signOut(provider);
      return;
    }
    if (!runtime.session) {
      add("Error", "No model selected. Run /model.");
      return;
    }
    const renameCommand = /^\/rename(?:\s+([\s\S]*))?$/.exec(text);
    if (renameCommand) {
      const id = runtime.session.id;
      void runBusy(async () => {
        const title = renameCommand[1]?.trim() || (await ask("New session title (Esc to cancel)"));
        if (title !== null) add("Renamed", await runtime.renameSession(id, title));
      });
      return;
    }
    if (text === "/fork") {
      const points = runtime.forkPoints().reverse();
      if (!points.length) {
        add("Error", "No completed turns to fork from.");
        return;
      }
      select(points, "Fork at turn", (boundary) => {
        void runBusy(async () => {
          const childId = await runtime.forkSession(Number(boundary));
          await connect(route as Route, childId);
          add("Forked", childId);
        });
      });
      return;
    }
    const sessionAction = /^\/(archive|restore|pin|unpin)$/.exec(text)?.[1] as
      | "archive"
      | "restore"
      | "pin"
      | "unpin"
      | undefined;
    if (sessionAction) {
      const title = {
        archive: "Archive conversation",
        restore: "Restore conversation",
        pin: "Pin conversation",
        unpin: "Unpin conversation",
      }[sessionAction];
      const picker: SearchPicker = select([], title, (id) => {
        void runBusy(async () => {
          await runtime.manageSession(id, sessionAction);
          if (sessionAction === "archive" && runtime.session?.id === id)
            await connect(route as Route);
          const label = {
            archive: "Archived",
            restore: "Restored",
            pin: "Pinned",
            unpin: "Unpinned",
          }[sessionAction];
          add(label, records.find((record) => record.id === id)?.title ?? id);
        });
      });
      picker.setLoading();
      let records: Awaited<ReturnType<Runtime["sessions"]>> = [];
      void runtime
        .sessions()
        .then((next) => {
          records = next.filter((record) =>
            sessionAction === "restore"
              ? record.archived
              : !record.archived &&
                (sessionAction === "pin"
                  ? !record.pinned
                  : sessionAction === "unpin"
                    ? record.pinned
                    : true),
          );
          if (!selecting)
            picker.setItems(
              records.map((record) => ({
                value: record.id,
                label: record.title,
                description: [record.id === runtime.session?.id ? "Current" : "", record.directory]
                  .filter(Boolean)
                  .join(" · "),
              })),
            );
          tui.requestRender();
        })
        .catch((error) => {
          if (!selecting) dismissPanel();
          add("Error", error instanceof Error ? error.message : String(error));
        });
      return;
    }
    const jobCommand = /^\/(ps|stop)(?:\s+(\S+))?$/.exec(text);
    if (jobCommand) {
      const stopping = jobCommand[1] === "stop";
      const perform = async (id: string) => {
        const result = await runtime.job(id, stopping);
        if (stopping) add("Job", `${id} · ${result}`);
        else {
          transcript.addChild(new Text(safeText(result), 2, 1));
          tui.requestRender();
        }
      };
      const handleError = (error: unknown) =>
        add("Error", error instanceof Error ? error.message : String(error));
      if (jobCommand[2]) void perform(jobCommand[2]).catch(handleError);
      else {
        const picker: SearchPicker = select([], stopping ? "Stop job" : "Background jobs", (id) => {
          void perform(id).catch(handleError);
        });
        picker.setLoading();
        void runtime
          .jobs()
          .then((jobs) => {
            if (!selecting)
              picker.setItems(
                jobs
                  .filter(
                    (job) => !stopping || job.status === "running" || job.status === "stopping",
                  )
                  .map((job) => ({
                    value: job.id,
                    label: job.label,
                    description: `${job.status} · ${job.id}${job.progress ? " · " + job.progress : ""}`,
                  })),
              );
            tui.requestRender();
          })
          .catch((error) => {
            dismissPanel();
            handleError(error);
          });
      }
      return;
    }
    const choiceCommand = /^\/(resume|cd|permission)(?:\s+(.*))?$/.exec(text);
    if (choiceCommand) {
      const name = choiceCommand[1];
      const argument = choiceCommand[2]?.trim();
      const kind = name === "resume" ? "sessions" : name === "cd" ? "directories" : "permissions";
      const apply = async (value: string) => {
        if (name === "resume") {
          if (!route.model) throw new Error("Select a model first with /model.");
          const directory = await chooseResumeDirectory(value);
          if (directory === null) return;
          await connect(
            { provider: route.provider, model: route.model },
            value,
            false,
            false,
            directory,
          );
        } else if (name === "cd") {
          options.cwd = await runtime.cd(value);
          setAutocomplete();
          add("Directory", options.cwd);
        } else {
          await runtime.choices(kind, value);
          add("Permission", value);
        }
      };
      void runBusy(async () => {
        if (argument) await apply(argument);
        else if (name === "resume") {
          const selector = new SessionSelector({
            currentSessionId: runtime.session?.id,
            currentDirectory: options.cwd,
            onSelect: (id) => {
              dismissPanel();
              void runBusy(() => apply(id));
            },
            onCancel: () => dismissPanel(),
            requestRender: () => tui.requestRender(),
          });
          showPanel(selector as unknown as Component);
          selector.setLoading();
          void runtime
            .sessions()
            .then((records) => {
              selector.setSessions(toSessionRecords(records, options.cwd));
              tui.requestRender();
            })
            .catch((error) => {
              selector.setStatus(
                {
                  type: "error",
                  message: error instanceof Error ? error.message : String(error),
                },
                4000,
              );
            });
        } else {
          const picker: SearchPicker = select(
            [],
            name === "cd" ? "Directories" : "Permissions",
            (value) => {
              void runBusy(() => apply(value));
            },
            undefined,
            name !== "permission",
          );
          picker.setLoading();
          try {
            const choices = await runtime.choices(kind);
            if (!selecting) picker.setItems(choices.options, choices.current);
          } catch (error) {
            dismissPanel();
            throw error;
          }
        }
      });
      return;
    }
    if (runtime.authFailed && text.startsWith("/") && text !== "/status") {
      add("Error", "Login failed. Run /login.");
      return;
    }
    if (text === "/session") {
      add("Session", runtime.session?.id ?? "No active session.");
      return;
    }
    if (text === "/effort") {
      const picker: SearchPicker = select(
        [],
        "Reasoning effort",
        (value) => {
          editor.onSubmit?.(`/effort ${value}`);
        },
        undefined,
        false,
      );
      picker.setLoading();
      busy = true;
      update();
      void runtime
        .efforts()
        .then((info) => {
          if (!selecting) return;
          picker.setItems(
            [
              {
                value: "default",
                label: "Default",
                description: info.defaultEffort
                  ? `Provider default (${info.defaultEffort})`
                  : "Use provider defaults",
              },
              ...info.options.map((option) => ({
                value: option.id,
                label: option.name,
                description: option.description,
              })),
            ],
            info.current,
          );
        })
        .catch((error) => {
          if (!selecting) dismissPanel();
          add("Error", error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          busy = false;
          update();
        });
      return;
    }
    if (text === "/status") {
      busy = true;
      update();
      let panel: StatusPanel | undefined;
      const showSnapshot = (next: SessionStats) => {
        if (closing) return;
        stats = next;
        if (panel) panel.updateStats(next);
        else {
          panel = new StatusPanel(next);
          transcript.addChild(panel);
        }
        tui.requestRender();
      };
      void runtime
        .stats(!running, showSnapshot)
        .then(showSnapshot)
        .catch((error) => {
          if (panel) transcript.removeChild(panel);
          stats = undefined;
          add("Error", error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          busy = false;
          update();
        });
      return;
    }
    if (/^\/file(?:\s|$)/.test(text)) {
      const path = text.slice(5).trim();
      if (!path) {
        add("File", "Usage: /file <path> · /file clear");
        return;
      }
      if (path === "clear") {
        pendingFiles = [];
        add("File", "Attachments cleared.");
        return;
      }
      void runBusy(async () => {
        pendingFiles.push(await runtime.attach(path));
        add("Attached", path);
      }, "Error");
      return;
    }
    if (text === "/dsh") {
      add("dsh", "Usage: /dsh <command> [arguments]");
      return;
    }
    if (text.startsWith("/dsh ")) text = "/" + text.slice(5).trimStart().replace(/^\//, "");
    const ownsTurn = !running;
    if (ownsTurn) {
      running = true;
      statusContainer.show("working", { message: "Working" });
      programStatus.working();
    } else busy = true;
    update();
    void (async () => {
      let lastAssistant: string | undefined;
      let liveAnswer: StreamingMarkdown | undefined;
      const usage = new Map<string, { input: number; output: number }>();
      try {
        const result = await runtime.run(
          text,
          (notification) => {
            if (
              ownsTurn &&
              notification.method === "lazydsh.thinking" &&
              notification.params.sessionId === runtime.session?.id
            ) {
              const frame = notification.params;
              if (frame.type === "start" && !thinking) {
                thinking = new ThinkingView(tui);
                transcript.addChild(thinking);
              }
              if (frame.type === "usage" && thinking) {
                const tokens = frame.usage;
                usage.set(frame.attemptId, {
                  input:
                    tokens.inputTokens +
                    (tokens.cacheReadTokens ?? 0) +
                    (tokens.cacheWriteTokens ?? 0),
                  output: tokens.outputTokens,
                });
                const totals = [...usage.values()].reduce(
                  (sum, item) => ({
                    input: sum.input + item.input,
                    output: sum.output + item.output,
                  }),
                  { input: 0, output: 0 },
                );
                thinking.setTokens(totals.input, totals.output);
              }
              tui.requestRender();
              return;
            }
            if (
              notification.method === "assistant.delta" &&
              notification.params.sessionId === runtime.session?.id
            ) {
              if (!liveAnswer || !transcript.children.includes(liveAnswer)) {
                liveAnswer = new StreamingMarkdown(markdownTheme);
                transcript.addChild(liveAnswer);
              }
              liveAnswer.append(notification.params.index, notification.params.text);
              tui.requestRender();
              return;
            }
            if (
              "sessionId" in notification.params &&
              notification.params.sessionId === runtime.session?.id &&
              notification.method === "session.event"
            ) {
              const event = notification.params.event;
              if (event.type === "assistant/attempt" && liveAnswer) {
                transcript.removeChild(liveAnswer);
                liveAnswer = undefined;
              }
            }
            const output = eventText(notification);
            if (!output) return;
            if (output.kind !== "assistant") {
              const row = toolLog.record(output);
              if (row) transcript.addChild(row);
              tui.requestRender();
              return;
            }
            if (!output.text) return;
            lastAssistant = output.text;
            if (
              liveAnswer &&
              "sessionId" in notification.params &&
              notification.params.sessionId === runtime.session?.id
            ) {
              liveAnswer.setFinal(output.text);
              if (!transcript.children.includes(liveAnswer)) transcript.addChild(liveAnswer);
              liveAnswer = undefined;
              tui.requestRender();
            } else add("assistant", output.text);
          },
          pendingFiles,
        );
        if (result.finishReason === "completed") {
          pendingFiles = [];
          if (/^\/effort\s+\S/.test(text.trim())) await persistSelection();
        }
        if (result.finalResponse && result.finalResponse !== lastAssistant)
          add(result.finishReason === "error" ? "Error" : "dsh", result.finalResponse);
        else if (result.finishReason === "error") add("Error", "dsh reported an error.");
      } catch (error) {
        if (!closing) add("Error", error instanceof Error ? error.message : String(error));
      } finally {
        if (ownsTurn) {
          if (thinking) {
            thinking.finish();
            transcript.removeChild(thinking);
            transcript.addChild(thinking);
          }
          thinking = undefined;
          running = false;
          statusContainer.show("idle", { message: "Ready" });
          programStatus.done();
        } else busy = false;
        tui.requestRender();
        if (ownsTurn && !closing) drainQueue();
        if (!closing) await refreshStats();
      }
    })();
  };

  const keybindings = getKeybindings();

  /** Ctrl+G: hand the draft to $EDITOR and read it back. */
  async function openExternalEditor() {
    const command = editorCommand();
    if (command === undefined) {
      add("Error", "No editor configured. Set $EDITOR or $VISUAL.");
      return;
    }
    const draft = editor.getText();
    tui.stop({ preserveScreen: true });
    try {
      const result = await editInExternalEditor({ content: draft, command });
      if (result.status === "complete") {
        editor.setText(result.content ?? "");
        add("Editor", "Saved from " + command + ".");
      } else {
        add("Editor", result.message ?? "Editor cancelled.");
      }
    } finally {
      tui.start();
      tui.setFocus(editor);
      update();
    }
  }

  /** Ctrl+X: copy the last assistant message, or the whole transcript. */
  async function copyLastMessage() {
    const rows = transcript.children;
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index];
      if (row === undefined) continue;
      const text = renderToText(row);
      if (text !== undefined && text.trim() !== "") {
        if (await copyToClipboard(text)) add("Copied", "Last message copied to clipboard.");
        else add("Error", "No clipboard mechanism available.");
        return;
      }
    }
    add("Error", "Nothing to copy yet.");
  }

  function renderToText(component: Component): string | undefined {
    const rendered = component.render(80);
    if (rendered.length === 0) return undefined;
    // Strip ANSI so the clipboard receives plain text.
    return (
      rendered
        // eslint-disable-next-line no-control-regex
        .map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""))
        .join("\n")
        .trim()
    );
  }

  /** Ctrl+T: cycle the model's reasoning effort. */
  async function cycleThinking() {
    if (!runtime.session) {
      add("Error", "No model selected. Run /model.");
      return;
    }
    let order: string[] = [];
    let current = "";
    try {
      const info = await runtime.efforts();
      order = ["default", ...info.options.map((option) => option.id)];
      current = info.current;
    } catch (error) {
      add("Error", error instanceof Error ? error.message : String(error));
      return;
    }
    if (order.length === 0) {
      add("Thinking", "This model has no reasoning effort levels.");
      return;
    }
    const index = order.indexOf(current);
    const next = order[(index + 1) % order.length] ?? "default";
    try {
      await runtime.run("/effort " + next, undefined, [], { commands: false });
      add(
        "Thinking",
        next === "default" ? "Reasoning effort: provider default" : "Reasoning effort: " + next,
      );
      await refreshStats();
    } catch (error) {
      add("Error", error instanceof Error ? error.message : String(error));
    }
  }

  tui.addInputListener((data) => {
    const kb = keybindings;
    if (kb.matches(data, "app.clear")) {
      if (running || busy) {
        const queued = queue.length;
        stopping = true;
        statusContainer.show("retry", { message: "Stopping" });
        programStatus.working("Stopping");
        update();
        void runtime
          .cancel()
          .then(() => {
            if (queued === 0) add("Interrupted");
          })
          .catch((error) => add("Error", error instanceof Error ? error.message : String(error)))
          .finally(() => {
            stopping = false;
            statusContainer.show(running ? "working" : "idle", {
              message: running ? "Working" : "Ready",
            });
            programStatus.idle();
            drainQueue();
            update();
          });
      } else if (editor.getText().length > 0 || pendingFiles.length > 0) {
        editor.setText("");
        pendingFiles = [];
        update();
      } else {
        void stop();
      }
      return { consume: true };
    }
    if (kb.matches(data, "app.interrupt") && !selecting) {
      if (decision) decision(null);
      else if (busy || running) {
        const queued = queue.length;
        stopping = true;
        statusContainer.show("retry", { message: "Stopping" });
        programStatus.working("Stopping");
        update();
        void runtime
          .cancel()
          .then(() => {
            // A queued prompt starts as soon as the turn stops, so a notice
            // saying the turn was cancelled would only be noise there.
            if (queued === 0) add("Interrupted");
          })
          .catch((error) => add("Error", error instanceof Error ? error.message : String(error)))
          .finally(() => {
            stopping = false;
            statusContainer.show(running ? "working" : "idle", {
              message: running ? "Working" : "Ready",
            });
            programStatus.idle();
            drainQueue();
            update();
          });
      }
      return { consume: true };
    }
    if (kb.matches(data, "app.editor.external")) {
      void openExternalEditor();
      return { consume: true };
    }
    if (kb.matches(data, "app.message.copy")) {
      void copyLastMessage();
      return { consume: true };
    }
    if (kb.matches(data, "app.thinking.toggle")) {
      void cycleThinking();
      return { consume: true };
    }
    return undefined;
  });
  const signalHandler = () => {
    void stop();
  };
  options.signal?.addEventListener("abort", signalHandler, { once: true });
  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);
  let restoreConsole: (() => void) | undefined;
  try {
    // DSH provider plugins write diagnostics with console.warn/error. The TUI
    // owns the terminal, so capture those lines in a log instead of letting
    // them corrupt the chat area.
    restoreConsole = captureConsole(
      dshCachePath({ dshHome: options.dshHome }, "lazydsh", "tui.log"),
    );
    tui.start();
    update();
    if (hooks.afterFirstPaint) {
      // Paint the startup screen before optional plugins are imported, then
      // keep submit disabled until their tools are registered.
      starting = true;
      update();
      tui.renderNow();
      try {
        await hooks.afterFirstPaint();
      } catch (error) {
        startupFailed = true;
        add("Error", error instanceof Error ? error.message : String(error));
      } finally {
        starting = false;
        update();
      }
    }
    if (!startupFailed) {
      if (route.model)
        await connect({ provider: route.provider, model: route.model }, resume, false, true);
      else {
        const { providers } = await import("./catalog.ts");
        if (providers.includes(route.provider)) await pickProviderModel(route.provider, resume);
        else await pickModel();
      }
    }
    await done;
  } finally {
    options.signal?.removeEventListener("abort", signalHandler);
    process.off("SIGINT", signalHandler);
    process.off("SIGTERM", signalHandler);
    decision?.(null);
    thinking?.finish();
    tui.stop({ preserveScreen: true });
    try {
      await runtime.close();
    } finally {
      restoreConsole?.();
    }
    if (continuationId) console.log(continuationCommand(continuationId, initial.resumeArgs));
  }
}
