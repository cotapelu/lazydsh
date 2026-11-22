import { QuestionPanel } from "./question.ts";
import { ApprovalPanel } from "./approval.ts";
import { historyRows, continuationCommand } from "./history.ts";
import { openAuthUrl } from "./open-url.ts";
import { homedir } from "node:os";
import { sep } from "node:path";
import { loadModel, preferencesPath, saveModel } from "../runtime/preferences.ts";
import { normalizeProvider } from "../runtime/provider.ts";
import { SearchPicker, selectionTheme } from "./picker.ts";
import { highlightCode } from "./highlight.ts";
import type { SessionStats } from "../utils/stats.ts";
import { Autocomplete } from "./autocomplete.ts";
import { commandMenu } from "./commands.ts";
import type { RuntimeOptions, QuestionResult } from "../interfaces.ts";
import type { AdmittedPromptContentPart } from "@deepseek-ai/dsh-attachment";
import { ToolLog, ToolRow } from "./tools.ts";
import { SessionSelector } from "./session-selector.ts";
import { LoginDialog } from "./components/login-dialog.ts";
import { AssistantMessageComponent } from "./components/assistant-message.ts";
import { createMermaidMarkdownTransformer } from "./components/mermaid.ts";
import { UserMessageComponent } from "./components/user-message.ts";
import { CompactionSummaryMessageComponent } from "./components/compaction-summary-message.ts";
import { OAuthSelectorComponent, type ProviderOption } from "./components/oauth-selector.ts";
import { editInExternalEditor, editorCommand } from "./external-editor.ts";
import { reportBug } from "./bug-report.ts";
import { showChangelog } from "./show-changelog.ts";
import { extensionWidgets, createExtensionWidgetContainer } from "./extensions.ts";
import { ProgramStatusReporter } from "./program-status.ts";
import { StatusIndicatorContainer } from "./components/status-container.ts";
import { FooterComponent } from "./footer.ts";
import { createFooterDataProvider } from "./footer-data-provider.ts";
import { getAppKeybindings } from "./keybindings.ts";
import type { SessionRecord } from "./components/session-selector-search.ts";
import {
  ScrollView,
  VStack,
  Text,
  Container,
  type Component,
  type OverlayHandle,
} from "@earendil-works/pi-tui";
import { createInteractiveTui } from "./tui-renderer.ts";
import type { TuiAltScreen } from "@earendil-works/pi-tui";
import { eventText, isAuthFailure } from "../runtime-events.ts";
import { AuthorizationDeclinedError } from "@deepseek-ai/dsh-authorization";
import type { Runtime } from "../runtime/runtime.ts";
import type { Route, Callbacks, CredentialSource } from "../interfaces.ts";
import {
  resumeDirectoryOptions,
  resumeDirectoryTarget,
  sameDirectory,
} from "./resume-directory.ts";
import { captureConsole } from "./tui-console.ts";
import { ctrlCAction } from "./interrupt.ts";
import { bashContextBlock, parseBashMode, type BashIntent } from "./bash-mode.ts";
import { dshCachePath } from "@deepseek-ai/dsh-home-paths";

import {
  StatusPanel,
  PromptEditor,
  QueuedMessage,
  QueueView,
  Notification,
  Transcript,
  editorBorder,
} from "./presentation.ts";
import { HeaderComponent } from "./components/header.ts";
import { ThemeController } from "./theme/theme-controller.ts";
import { readThemeSetting, writeThemeSetting } from "./theme/theme-settings.ts";
import { readUiSettings, writeUiSettings, type UiSettings } from "./settings-store.ts";
import { safeText, accent, dim } from "./theme.ts";
import { theme as themeProxy } from "./theme/theme.ts";
import { currentThemeName_ } from "./theme/theme.ts";

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

/** Mermaid diagram transformer for assistant/user messages. */
const mermaidTransformer = createMermaidMarkdownTransformer({
  getMode: () => "final",
  theme: themeProxy,
});

export function canRunDuringTurn(text: string) {
  return (
    /^\/plan(?:\s+off)?$/.test(text.trim()) ||
    /^\/(?:status|session|ps|stop|effort|permission|cd|file|quit)(?:\s|$)/.test(text.trim())
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
  // The launcher always runs fullscreen; the alt-screen surface (search,
  // selection, URL support) is what the cast below exposes.
  const tui = createInteractiveTui({ tuiMode: "fullscreen", mouse: true }) as TuiAltScreen;
  const header = new HeaderComponent();
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
  const footerDataProvider = createFooterDataProvider(options.cwd);
  footerDataProvider.onBranchChange(() => tui.requestRender());
  const footerContainer = new Container();

  /**
   * Build the footer on first use. Reading the runtime is only safe once the
   * deferred plugins have attached, so the component is created lazily and the
   * session adapter reads through safe accessors on every render.
   */
  let footer: FooterComponent | undefined;
  /**
   * The footer's usage counters are cumulative session totals, but this fork's
   * runtime exposes them through `stats()` rather than session entries, so the
   * footer sees one synthetic usage entry carrying the latest totals.
   */
  const footerUsageEntries = () => {
    const totals = stats?.totals;
    if (totals === undefined) return [];
    return [
      {
        type: "usage",
        usage: {
          input: totals.uncachedInputTokens,
          output: totals.outputTokens,
          cacheRead: totals.cacheReadTokens,
          cacheWrite: totals.cacheWriteTokens,
        },
      },
    ];
  };
  const footerSession = () => ({
    sessionManager: {
      getCwd: () => options.cwd,
      getSessionId: () => safeSessionId(runtime),
      getLeafId: () => safeLeafId(runtime),
      // One entry while totals exist: the footer re-derives its counters
      // whenever the snapshot changes instead of caching stale zeros.
      getEntryCount: () => (stats?.totals === undefined ? 0 : 1),
      getSessionName: () => undefined,
      getEntries: () => footerUsageEntries(),
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
    limits: stats?.limits,
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

  // Theme controller: applies theme, queries terminal colors (DA1), auto-syncs with terminal light/dark mode.
  // The persisted setting (name or "<light>/<dark>" pair) comes from
  // ~/.config/lazydsh/theme.json so a choice survives a restart.
  let themeSetting: string | undefined = readThemeSetting();
  // TUI-side preferences (~/.config/lazydsh/settings.json).
  let uiSettings: UiSettings = readUiSettings();
  const themeController = new ThemeController(tui, {
    getSettingsManager: () => ({ getThemeSetting: () => themeSetting }),
    showError: (msg) => add("Error", msg),
    onChanged: () => tui.requestRender(),
    initialThemeSetting: themeSetting,
  });

  const toolLog = new ToolLog();
  let route = initial;
  let resume = initial.resume;
  let resumeDirectory = initial.resumeDirectory;
  let commands = commandMenu();
  let stats: SessionStats | undefined;
  let pendingFiles: AdmittedPromptContentPart[] = [];
  /** The streaming answer of the active turn (folded with reasoning at the end). */
  let liveAssistant: AssistantMessageComponent | undefined;
  /** Pi's default: reasoning streams visibly; Ctrl+T collapses it to a label. */
  let hideThinkingBlock = false;
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

  /** Options for {@link connect} — keeps the signature to a single route argument. */
  interface ConnectOptions {
    /** Resume an existing session instead of starting a new one. */
    sessionId?: string;
    /** Announce the model in the transcript after connecting. */
    notifyModel?: boolean;
    /** Connecting during startup — an auth failure defers the retry. */
    startup?: boolean;
    /** Directory to switch to when resuming. */
    directory?: string;
    /** Keep the current transcript instead of clearing it. */
    keepTranscript?: boolean;
  }
  let decision: ((value: string | null) => void) | undefined;
  /** Questions waiting for the active prompt to settle (see `ask`/`drainAskQueue`). */
  const askQueue: {
    message: string;
    signal?: AbortSignal;
    resolve: (value: string | null) => void;
  }[] = [];
  let selecting = false;
  /** Stack of overlay handles for nested panels (e.g., provider -> model picker). */
  const overlayHandles: OverlayHandle[] = [];
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
    // Extension widgets may contribute a one-line footer status; a widget
    // without one (or one that stopped reporting) drops out of the row.
    for (const widget of extensionWidgets.getAll()) {
      let text: string | undefined;
      try {
        text = widget.status?.();
      } catch {
        text = undefined;
      }
      if (text === undefined || text.trim() === "")
        footerDataProvider.removeExtensionStatus(widget.id);
      else footerDataProvider.setExtensionStatus(widget.id, text);
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

  function add(
    label: string,
    text: unknown = "",
    stop?: "aborted" | "length" | "error",
    reasoning?: string,
  ) {
    if (label === "You") {
      transcript.addChild(
        new UserMessageComponent(String(text), markdownTheme, 1, [mermaidTransformer]),
      );
      tui.requestRender();
      return;
    }
    if (label === "assistant") {
      // Final answers render as one assistant message: markdown text, OSC133
      // zone markers, the model's reasoning folded in above (hidden by
      // default, expanded with Ctrl+T), and the stop reason.
      transcript.addChild(
        new AssistantMessageComponent(
          {
            content: [
              ...(reasoning?.trim() ? [{ type: "thinking" as const, thinking: reasoning }] : []),
              { type: "text" as const, text: safeText(text) },
            ],
            ...(stop === undefined ? {} : { stopReason: stop }),
          },
          hideThinkingBlock,
          markdownTheme,
          "Thinking…",
          1,
          [mermaidTransformer],
        ),
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

  /**
   * Bash mode: `!cmd` runs locally through DSH's shell (the profile's sandbox
   * policy applies) and its output joins the next prompt; `!!cmd` runs without
   * touching the conversation. The card streams nothing until completion —
   * the shell executor returns the captured result in one shot.
   */
  async function runBash(intent: BashIntent) {
    const { BashExecutionComponent } = await import("./bash-execution.ts");
    const card = new BashExecutionComponent(intent.command, tui, intent.excludeFromContext);
    transcript.addChild(card);
    scroll.scrollToEnd();
    busy = true;
    update();
    try {
      const result = await runtime.shell(intent.command, { signal: options.signal });
      const stdout = result.stdout?.text ?? "";
      const stderr = result.stderr?.text ?? "";
      const combined = [stdout, stderr].filter((part) => part !== "").join("\n");
      if (combined !== "") card.appendOutput(combined);
      const truncated = result.stdout?.truncated === true || result.stderr?.truncated === true;
      const spillPath = result.stdout?.spillPath ?? result.stderr?.spillPath;
      card.setComplete(
        result.exitCode ?? undefined,
        result.aborted,
        truncated
          ? { truncated: true, ...(spillPath === undefined ? {} : { path: spillPath }) }
          : undefined,
        spillPath,
      );
      const block = bashContextBlock(intent, {
        exitCode: result.exitCode,
        stdout,
        stderr,
      });
      if (block !== "") bashContext = bashContext === "" ? block : `${bashContext}\n\n${block}`;
    } catch (error) {
      card.setComplete(undefined, false, undefined, undefined);
      add("Bash", error instanceof Error ? error.message : String(error));
    } finally {
      busy = false;
      scroll.scrollToEnd();
      update();
    }
  }

  /** Bash output waiting to be prepended to the next prompt (`!!` runs are skipped). */
  let bashContext = "";

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

  /**
   * Prompt the user for one line of text. Prompts are serialized: a question
   * that arrives while another is open waits for it to settle instead of
   * failing, so racing commands cannot reject their callers.
   */
  function ask(message: string, signal?: AbortSignal): Promise<string | null> {
    if (closing || signal?.aborted) return Promise.resolve(null);
    return new Promise<string | null>((resolve) => {
      askQueue.push({ message, signal, resolve });
      drainAskQueue();
    });
  }

  /** Opens the next queued question once the active one has settled. */
  function drainAskQueue(): void {
    if (decision !== undefined || askQueue.length === 0) return;
    if (closing) {
      for (const pending of askQueue.splice(0)) pending.resolve(null);
      return;
    }
    const pending = askQueue.shift()!;
    if (pending.signal?.aborted) {
      pending.resolve(null);
      drainAskQueue();
      return;
    }
    add("Input", pending.message);
    editor.setText("");
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      pending.signal?.removeEventListener("abort", abort);
      decision = undefined;
      editor.setText("");
      update();
      pending.resolve(value);
      drainAskQueue();
    };
    const abort = () => settle(null);
    decision = settle;
    pending.signal?.addEventListener("abort", abort, { once: true });
    update();
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
        try {
          return await dialog.whenDone();
        } finally {
          // The dialog settles its promise but never unmounts itself; the
          // overlay must come down even when the flow was aborted.
          dismissPanel();
        }
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
        try {
          return await dialog.whenDone();
        } finally {
          dismissPanel();
        }
      }
      return ask(message, signal);
    },
    onApproval: async (params) => {
      if (closing || params.signal?.aborted) return { outcome: "cancelled" };
      if (decision) throw new Error("Another question is already awaiting an answer.");
      return new Promise<{ outcome: "allowed-once" | "rejected" | "cancelled" }>((resolve) => {
        // The pending tool-call row already holds the exact arguments; approval
        // requests only carry the call ID, so show them while deciding.
        const callArguments = toolLog.find(params.callId)?.callArguments;
        const panel = new ApprovalPanel(
          {
            toolName: params.toolName,
            reason: params.displayReason?.en ?? params.reason,
            ...(callArguments === undefined ? {} : { arguments: callArguments }),
          },
          panelHeight,
        );
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
        const panel = new QuestionPanel(request.questions, panelHeight);
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

  /**
   * Persist a reasoning level as the default for the active route (Ctrl+S in
   * the thinking picker). Requires a selection to attach it to; the level
   * still applies in-session even when nothing can be saved.
   */
  async function saveDefaultEffort(level: string) {
    const selection = runtime.selection();
    if (!selection) {
      add("Thinking", `${level} applies to this session; pick a model to save it as default.`);
      return;
    }
    try {
      await saveModel(preferencesPath(options.dshHome), { ...selection, effort: level });
      add("Thinking", `Default effort for ${selection.provider}/${selection.model}: ${level}`);
    } catch (error) {
      add("Error", error instanceof Error ? error.message : String(error));
    }
  }

  async function connect(nextRoute: Route, connection: ConnectOptions = {}) {
    const {
      sessionId,
      notifyModel = false,
      startup = false,
      directory,
      keepTranscript = false,
    } = connection;
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
      if (!keepTranscript) transcript.clear();
      if (sessionId) {
        for (const row of historyRows(await runtime.history(), id)) {
          if (row instanceof ToolRow) transcript.addChild(row);
          else if (row.kind === "metrics") transcript.addChild(new Text(dim(row.text), 2, 1));
          else if (row.kind === "assistant") add("assistant", row.text, undefined, row.reasoning);
          else add(row.kind === "user" ? "You" : (row.label ?? "dsh"), row.text);
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

  function dismissPanel(clearAll = false) {
    if (clearAll) {
      // Close all nested overlays (e.g., provider -> model picker)
      while (overlayHandles.length > 0) {
        const handle = overlayHandles.pop();
        handle?.hide();
      }
    } else if (overlayHandles.length > 0) {
      // Close only the topmost overlay
      const handle = overlayHandles.pop();
      handle?.hide();
    }
    selecting = overlayHandles.length > 0;
    if (!selecting) {
      tui.setFocus(editor);
    }
    tui.requestRender();
  }

  /** Show a panel (picker, dialog) as an overlay above the editor. */
  function showPanel(panel: Component) {
    selecting = true;
    programStatus.blocked("question", "Waiting for input");
    const handle = tui.showOverlay(panel, {
      anchor: "center",
      margin: 2,
      minWidth: 50,
      maxHeight: tui.terminal.rows - 8,
    });
    overlayHandles.push(handle);
    tui.setFocus(panel);
    tui.requestRender();
  }

  /**
   * Rows a question/approval panel may use above the always-visible status row.
   * A function (not a number) so a terminal resized while the panel is open
   * keeps the panel on screen.
   */
  function panelHeight() {
    return Math.max(
      1,
      tui.terminal.rows - statusContainer.render(Math.max(1, tui.terminal.columns)).length,
    );
  }

  /**
   * Theme picker: every built-in theme plus user themes, with live preview.
   * Selecting persists the choice through the controller (which owns the
   * settings document); cancelling restores the persisted theme.
   */
  /** Apply + persist the theme setting (name or "<light>/<dark>" pair). */
  function persistThemeSetting(setting: string) {
    themeSetting = setting;
    themeController.setThemeSetting(setting);
    writeThemeSetting(setting);
  }

  function openThemePicker() {
    void import("./components/theme-selector.ts").then(({ ThemeSelectorComponent }) => {
      const setting = themeController.getThemeSetting();
      // The setting is a "<light>/<dark>" pair exactly when auto-sync is on.
      const activePair =
        setting !== undefined && setting.indexOf("/") !== -1 ? setting.split("/") : undefined;
      const [light = "light", dark = "dark"] = activePair ?? [];
      const picker = new ThemeSelectorComponent(
        currentThemeName_(),
        (selection) => {
          dismissPanel();
          if (selection.includes("/")) {
            // Auto: persist the pair; the controller re-applies on every
            // terminal light/dark change from here on.
            persistThemeSetting(selection);
            add("Theme", `auto: ${selection.split("/").join(" / ")} (follows terminal)`);
            return;
          }
          const applied = themeController.setThemeName(selection);
          if (!applied.success) {
            add("Theme", `Cannot apply ${selection}: ${applied.error ?? "unknown error"}`);
            return;
          }
          persistThemeSetting(selection);
          add("Theme", selection);
        },
        () => {
          dismissPanel();
          // A preview must not outlive a cancelled pick.
          themeController.applyFromSettings();
        },
        (selection) => themeController.preview(selection),
        { light, dark, active: activePair !== undefined },
      );
      showPanel(picker);
    });
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
    const [{ ModelSelectorComponent }, { catalogModelRuntime, catalogModels }] = await Promise.all([
      import("./model-selector.ts"),
      import("./model-catalog-runtime.ts"),
    ]);
    const selection = runtime.selection();
    const current =
      selection === undefined
        ? undefined
        : { provider: selection.provider, id: selection.model, name: selection.model };
    // "scoped" keeps the providers the user can actually authenticate against.
    const authenticated = new Set(runtime.authProviders().map((provider) => provider.value));
    const scoped = catalogModels([...authenticated]);
    const saved = await loadModel(preferencesPath(options.dshHome));
    const defaultModel =
      saved === undefined
        ? undefined
        : { provider: saved.provider, id: saved.model, name: saved.model };
    const picker = new ModelSelectorComponent(
      tui,
      current,
      catalogModelRuntime(),
      scoped.map((model) => ({ model })),
      (model) => {
        dismissPanel();
        picker.dispose();
        void connect(
          { provider: model.provider, model: model.id },
          { sessionId, notifyModel: true },
        );
      },
      () => {
        dismissPanel();
        picker.dispose();
      },
      "",
      (model) => {
        dismissPanel();
        picker.dispose();
        void saveModelDefault(model);
      },
      defaultModel,
    );
    showPanel(picker);
  }

  /** Persist a provider/model pair as the startup default (Ctrl+S in the picker). */
  async function saveModelDefault(model: { provider: string; id: string }) {
    const selection = runtime.selection();
    const sameRoute =
      selection !== undefined &&
      selection.provider === model.provider &&
      selection.model === model.id;
    try {
      await saveModel(preferencesPath(options.dshHome), {
        provider: model.provider,
        model: model.id,
        ...(sameRoute && selection.effort !== undefined ? { effort: selection.effort } : {}),
      });
      add("Model", `Default: ${model.provider}/${model.id}`);
    } catch (error) {
      add("Error", error instanceof Error ? error.message : String(error));
    }
  }

  async function pickProviderModel(provider: string, sessionId?: string, _parent?: SearchPicker) {
    const { models } = await import("../runtime/catalog.ts");
    const picker: SearchPicker = select(
      models(provider).map((model) => ({
        value: model.id,
        label: model.id,
        description: model.name,
      })),
      "Models",
      (model) => {
        // Close all overlays (provider + model picker) before connecting
        dismissPanel(true);
        void connect({ provider, model }, { sessionId, notifyModel: true });
      },
      undefined,
      true,
    );
    picker.onCancel = () => {
      // Close model picker only, parent provider picker remains
      dismissPanel();
      if (!overlayHandles.length) {
        // No parent picker, go back to provider selection
        void pickModel(sessionId);
      }
    };
  }

  // Codex-compatible chat lifecycle: both commands start a new session, but
  // /new keeps the previous transcript visible while /clear wipes it first.
  async function startNewConversation(clearScreen: boolean) {
    bashContext = "";
    if (clearScreen) {
      transcript.clear();
      scroll.scrollToEnd();
      tui.resetTextSelection();
      update();
    }
    if (!route.model) {
      void pickModel();
      return;
    }
    await connect({ provider: route.provider, model: route.model }, { keepTranscript: true });
    if (closing || !runtime.session) return;
    add("New conversation", runtime.session.id);
    scroll.scrollToEnd();
    update();
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

  /** Show the OAuth selector for login, with auth type selection per provider. */
  async function signIn(provider?: string) {
    await runBusy(async () => {
      if (provider === undefined) {
        // Show OAuth selector with all providers and auth types
        const providerOptions = await buildLoginProviderOptions();
        const selector = new OAuthSelectorComponent(
          "login",
          providerOptions,
          async (providerId, authType) => {
            dismissPanel();
            await startProviderLogin(providerId, authType);
          },
          () => dismissPanel(),
          undefined,
          tui,
        );
        showPanel(selector);
        return;
      }
      // Direct provider specified
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
      announcedAuth.delete(provider);
      add("Logged in", provider);
      if (blockedPrompt !== undefined) {
        if (editor.getText().length === 0) editor.setText(blockedPrompt);
        blockedPrompt = undefined;
        update();
      }
    }, "Error");
  }

  async function buildLoginProviderOptions(): Promise<ProviderOption[]> {
    const options: ProviderOption[] = [];
    for (const provider of runtime.authProviders()) {
      const providerId = provider.value;
      const authStatus: CredentialSource = await runtime.credentialSource(providerId);
      const status =
        authStatus.kind !== "none"
          ? {
              type: (authStatus.kind === "keyless" ? "oauth" : "api_key") as "oauth" | "api_key",
              source: authStatus.label,
            }
          : undefined;

      options.push({
        id: providerId,
        name: provider.label,
        authType: "oauth",
        status,
        subscription: false,
      });
      options.push({
        id: providerId,
        name: provider.label,
        authType: "api_key",
        status,
        subscription: false,
      });
    }
    return options.sort((a: ProviderOption, b: ProviderOption) => a.name.localeCompare(b.name));
  }

  /** Start the provider login flow based on auth type. */
  async function startProviderLogin(providerId: string, authType: "oauth" | "api_key") {
    if (authType === "oauth") {
      // OAuth flow handled via callbacks.onAuth
      try {
        const notice = await runtime.authenticate(options.signal, {
          provider: providerId,
          onAuth: callbacks.onAuth,
        });
        if (notice !== undefined) add("Login", notice);
      } catch (error) {
        if (closing) return;
        if (error instanceof AuthorizationDeclinedError) {
          add("Login", "Cancelled.");
        } else {
          throw error;
        }
      }
      if (closing) return;
      announcedAuth.delete(providerId);
      add("Logged in", providerId);
    } else {
      // API key flow
      try {
        const notice = await runtime.authenticate(options.signal, {
          provider: providerId,
          onAuth: callbacks.onAuth,
        });
        if (notice !== undefined) add("Login", notice);
      } catch (error) {
        if (closing) return;
        if (error instanceof AuthorizationDeclinedError) {
          add("Login", "Cancelled.");
        } else {
          throw error;
        }
      }
      if (closing) return;
      announcedAuth.delete(providerId);
      add("Logged in", providerId);
    }
  }

  async function signOut(provider?: string) {
    await runBusy(async () => {
      if (provider === undefined) {
        // Show OAuth selector for logout
        const logoutOptions = await buildLogoutProviderOptions();
        if (logoutOptions.length === 0) {
          add(
            "Logout",
            "No stored credentials to remove. /logout only removes credentials saved by /login; environment variables and models.json config are unchanged.",
          );
          return;
        }
        const selector = new OAuthSelectorComponent(
          "logout",
          logoutOptions,
          async (providerId) => {
            dismissPanel();
            await performLogout(providerId);
          },
          () => dismissPanel(),
          undefined,
          tui,
        );
        showPanel(selector);
        return;
      }
      await performLogout(provider);
    }, "Error");
  }

  async function buildLogoutProviderOptions(): Promise<ProviderOption[]> {
    const providers = runtime.authProviders();
    const options: ProviderOption[] = [];
    for (const provider of providers) {
      const providerId = provider.value;
      const hasCreds = await runtime.hasCredentials(providerId);
      if (hasCreds) {
        // Determine auth type from the provider description
        const isOAuth = provider.description.includes("OAuth");
        options.push({
          id: providerId,
          name: providerId,
          authType: isOAuth ? "oauth" : "api_key",
          status: { type: isOAuth ? "oauth" : "api_key", source: "stored credential" },
          subscription: false,
        });
      }
    }
    return options.sort((a: ProviderOption, b: ProviderOption) => a.name.localeCompare(b.name));
  }

  async function performLogout(providerId: string) {
    try {
      await runtime.logout(providerId);
      await refreshStats();
      add("Logged out", providerId);
    } catch (error) {
      if (closing) return;
      add("Logout failed", error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * A key-driven exit (Ctrl+D, idle Ctrl+C). Honours the Confirm-on-exit
   * preference; explicit `/quit` and force-exits call `stop()` directly.
   */
  async function requestExit() {
    if (uiSettings.confirmExit) {
      const answer = await ask("Exit lazydsh? (y/n)");
      if (answer === null || !/^y/i.test(answer.trim())) {
        update();
        return;
      }
    }
    await stop();
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

  /** Stop the live turn but keep the chat open (Esc / Ctrl+C). */
  function cancelTurn() {
    if (stopping) return;
    const queued = queue.length;
    stopping = true;
    // The retry indicator renders its own countdown text, so "Stopping" needs
    // the working row; using retry here showed a bogus "Retrying (1/3)".
    statusContainer.show("working", { message: "Stopping" });
    programStatus.working("Stopping");
    update();
    void runtime
      .cancel()
      .then(() => {
        // A queued prompt starts as soon as the turn stops, so a notice saying
        // the turn was cancelled would only be noise there.
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

  editor.onSubmit = async (text: string) => {
    const fromQueue = submittingQueued;
    if (closing) return;
    if (decision) {
      decision(text);
      return;
    }
    if (!fromQueue && (busy || starting || startupFailed || !text.trim())) return;
    // Bash mode runs locally, so it works during a turn and never queues.
    const bashIntent = parseBashMode(text);
    if (bashIntent !== undefined) {
      editor.addToHistory(text);
      if (editor.getText() === text) editor.setText("");
      add("You", text);
      void runBash(bashIntent);
      return;
    }
    if (running && !canRunDuringTurn(text)) {
      if (shouldQueueDuringTurn(text)) {
        enqueue(text);
        return;
      }
      add("Error", "A response is running. Press Esc or Ctrl+C to stop it.");
      return;
    }
    if (
      pendingStartupConnection &&
      !runtime.session &&
      !/^\/(?:model|new|clear|quit)(?:\s|$)/.test(text)
    ) {
      const pending = pendingStartupConnection;
      void connect(pending.route, {
        sessionId: pending.sessionId,
        startup: true,
      }).then(() => {
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
      void startNewConversation(true);
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
    if (text === "/debug") {
      const width = tui.terminal.columns;
      const allLines = tui.render(width);
      const debugText = [
        `Debug output at ${new Date().toISOString()}`,
        `Terminal: ${width}x${tui.terminal.rows}`,
        `Total lines: ${allLines.length}`,
        "",
        ...allLines.map((line, idx) => `[${idx}] ${line}`),
      ].join("\n");
      add("Debug", `Debug log: ${allLines.length} lines rendered`);
      console.log(debugText);
      return;
    }
    if (text === "/copy") {
      void copyLastMessage();
      return;
    }
    if (text === "/name" || text.startsWith("/name ")) {
      const title = text.slice(6).trim() || (await ask("New session title (Esc to cancel)"));
      if (title !== null) {
        void runBusy(async () => {
          const id = runtime.session?.id;
          if (id) add("Renamed", await runtime.renameSession(id, title));
        });
      }
      return;
    }
    if (text === "/hotkeys") {
      const lines = [
        "Keyboard Shortcuts",
        "",
        "Navigation:",
        "  Up/Down/Left/Right  Move cursor",
        "  Ctrl+Left/Right  Move by word",
        "  Home/End  Start/end of line",
        "  PgUp/PgDn  Page up/down",
        "",
        "Editing:",
        "  Enter  Send message",
        "  Shift+Enter  New line",
        "  Ctrl+W  Delete word backward",
        "  Ctrl+Delete  Delete word forward",
        "  Ctrl+U  Delete to line start",
        "  Ctrl+K  Delete to line end",
        "  Ctrl+Y  Paste deleted text",
        "  Ctrl+_  Undo",
        "",
        "App:",
        "  Esc  Cancel/abort",
        "  Ctrl+C  Clear editor (first) / exit (second)",
        "  Ctrl+D  Exit (when empty)",
        "  Ctrl+Z  Suspend to background",
        "  Shift+Tab  Cycle thinking level",
        "  Ctrl+P / Shift+Ctrl+P  Cycle models",
        "  Ctrl+L  Open model selector",
        "  Ctrl+O  Toggle tool output",
        "  Ctrl+T  Toggle thinking blocks",
        "  Ctrl+G  External editor",
        "  Ctrl+X  Copy last message",
        "  Alt+Enter  Queue follow-up",
        "  Alt+Up  Restore queued messages",
        "  Ctrl+V  Paste from clipboard",
        "  /  Slash commands",
        "  !  Run bash command",
        "  !!  Run bash command (excluded from context)",
      ];
      add("Hotkeys", lines.join("\n"));
      return;
    }
    if (text === "/clone") {
      const leafId = runtime.session?.id;
      if (!leafId) {
        add("Error", "Nothing to clone yet.");
        return;
      }
      void runBusy(async () => {
        const childId = await runtime.forkSession(Number(runtime.forkPoints().at(-1)?.value ?? 0));
        await connect(route as Route, { sessionId: childId });
        add("Cloned", childId);
      });
      return;
    }
    if (text === "/settings") {
      const { SettingsSelectorComponent } = await import("./settings-selector.ts");
      const settings = new SettingsSelectorComponent(tui, {
        currentTheme: currentThemeName_(),
        confirmExit: uiSettings.confirmExit,
        onToggle: (key, value) => {
          if (key !== "confirmExit") return;
          uiSettings.confirmExit = value;
          writeUiSettings(uiSettings);
          add("Settings", `Confirm on exit: ${value ? "on" : "off"}`);
        },
      });
      settings.onCancel = dismissPanel;
      settings.onActivate = (key) => {
        // The theme row opens the real picker with live preview instead of
        // cycling the placeholder options compiled into the panel.
        if (key === "theme") {
          openThemePicker();
          return true;
        }
      };
      showPanel(settings);
      return;
    }
    if (text === "/model") {
      void pickModel();
      return;
    }
    if (text === "/new") {
      void startNewConversation(false);
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
          await connect(route as Route, { sessionId: childId });
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
      openSessionActionPicker(sessionAction);
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
            // Only fill a picker that is still on screen.
            if (!selecting) return;
            picker.setItems(
              jobs
                .filter((job) => !stopping || job.status === "running" || job.status === "stopping")
                .map((job) => ({
                  value: job.id,
                  label: job.label,
                  description: `${job.status} · ${job.id}${job.progress ? " · " + job.progress : ""}`,
                })),
            );
            tui.requestRender();
          })
          .catch((error) => {
            if (selecting) dismissPanel();
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
        if (name === "resume") return applyResume(value);
        if (name === "cd") {
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
        else if (name === "resume") openSessionPicker();
        else {
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
            if (selecting) picker.setItems(choices.options, choices.current);
          } catch (error) {
            if (selecting) dismissPanel();
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
      // The fuzzy thinking picker needs its level list before construction, so
      // the catalog is fetched first while the status row reports the work.
      busy = true;
      update();
      void runtime
        .efforts()
        .then(async (info) => {
          if (closing) return;
          const { ThinkingSelectorComponent } = await import("./components/thinking-selector.ts");
          const picker = new ThinkingSelectorComponent({
            currentLevel: info.current,
            availableLevels: info.options.map((option) => option.id),
            ...(info.defaultEffort === undefined
              ? {}
              : { defaultThinkingLevel: info.defaultEffort }),
            onSelect: (level) => {
              dismissPanel();
              editor.onSubmit?.(`/effort ${level}`);
            },
            onCancel: () => dismissPanel(),
            onSelectAsDefault: (level) => {
              dismissPanel();
              void saveDefaultEffort(level);
            },
          });
          showPanel(picker);
        })
        .catch((error) => {
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
      // The live answer is one assistant message: the model's reasoning and the
      // answer text stream into the same component (reasoning above the answer,
      // hidden until Ctrl+T), exactly like pi's transcript. The previous turn's
      // component is cleared in the finally block below.
      let liveText = "";
      let liveReasoning = "";
      // Lazily mount the answer block. The accumulated reasoning/text is built
      // by the caller before this runs, so the constructor must not reset it;
      // a retry (assistant/attempt) resets both instead.
      const ensureLiveAssistant = () => {
        if (liveAssistant === undefined || !transcript.children.includes(liveAssistant)) {
          liveAssistant = new AssistantMessageComponent(
            undefined,
            hideThinkingBlock,
            markdownTheme,
            "Thinking…",
            1,
            [mermaidTransformer],
          );
          transcript.addChild(liveAssistant);
        }
        return liveAssistant;
      };
      const renderLive = (streaming: boolean, stopReason?: "aborted" | "length" | "error") =>
        ensureLiveAssistant().updateContent(
          {
            content: [
              ...(liveReasoning.trim()
                ? [{ type: "thinking" as const, thinking: liveReasoning }]
                : []),
              ...(liveText.trim() ? [{ type: "text" as const, text: liveText }] : []),
            ],
            ...(stopReason === undefined ? {} : { stopReason }),
          },
          streaming,
        );
      try {
        // A `!cmd` run's output rides along with the next prompt; `!!cmd` runs
        // never get here (bashContextBlock drops them).
        const prompt = bashContext === "" ? text : `${bashContext}\n\n${text}`;
        // Consume the context here so a queued follow-up does not repeat it.
        bashContext = "";
        const result = await runtime.run(
          prompt,
          (notification) => {
            if (
              ownsTurn &&
              notification.method === "assistant.reasoning" &&
              notification.params.sessionId === runtime.session?.id
            ) {
              // The model is reasoning: the component shows its quiet label
              // (or the live reasoning text when thinking blocks are visible).
              liveReasoning += notification.params.text;
              renderLive(true);
              tui.requestRender();
              return;
            }
            if (
              notification.method === "assistant.delta" &&
              notification.params.sessionId === runtime.session?.id
            ) {
              liveText += notification.params.text;
              renderLive(true);
              tui.requestRender();
              return;
            }
            if (
              "sessionId" in notification.params &&
              notification.params.sessionId === runtime.session?.id &&
              notification.method === "session.event"
            ) {
              const event = notification.params.event;
              // A retry restarts the answer from scratch.
              if (event.type === "assistant/attempt" && liveAssistant) {
                transcript.removeChild(liveAssistant);
                liveAssistant = undefined;
                liveText = "";
              }
              // DSH surfaces backoff and compaction as session events; mirror
              // them in the status row instead of leaving a silent spinner. The
              // event union only names the base types, so compare as a string.
              const eventType: string = event.type;
              const data = (event as { data?: Record<string, unknown> }).data;
              if (eventType === "llm/retry") {
                statusContainer.show("retry", {
                  retryCount: typeof data?.retry === "number" ? data.retry : 1,
                  ...(typeof data?.maxRetries === "number" ? { maxAttempts: data.maxRetries } : {}),
                  ...(typeof data?.delayMs === "number" ? { delayMs: data.delayMs } : {}),
                });
              } else if (eventType === "llm/retry-started" || eventType === "step/start") {
                if (running) statusContainer.show("working", { message: "Working" });
              } else if (eventType === "compaction/start") {
                statusContainer.show("compaction", { reason: "overflow" });
              } else if (eventType === "compaction/end") {
                if (running) statusContainer.show("working", { message: "Working" });
              } else if (eventType === "compaction/summary") {
                const summaryBlocks =
                  (data?.summary as Array<{ type?: string; text?: string }>) ?? [];
                const summaryText = summaryBlocks
                  .filter((b) => b?.type === "text" && typeof b.text === "string")
                  .map((b) => b.text as string)
                  .join("\n");
                const tokensBefore =
                  typeof data?.shadowedTokenCount === "number" ? data.shadowedTokenCount : 0;
                if (summaryText.trim()) {
                  transcript.addChild(
                    new CompactionSummaryMessageComponent({ summary: summaryText, tokensBefore }),
                  );
                  tui.requestRender();
                }
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
              liveAssistant &&
              "sessionId" in notification.params &&
              notification.params.sessionId === runtime.session?.id
            ) {
              renderLive(false);
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
        // Settle the streaming block with everything the turn streamed. The
        // content comes from the deltas — a multi-step turn keeps the text it
        // produced before its tool calls — while only the stop reason comes
        // from the persisted record (DSH messages carry no stop reason).
        if (liveAssistant !== undefined) {
          const events = await runtime.history().catch(() => []);
          const final = events.findLast((item) => item.type === "assistant/message");
          const stop =
            final?.type === "assistant/message" && final.data.interrupted === true
              ? "aborted"
              : result.finishReason === "error"
                ? "error"
                : undefined;
          renderLive(false, stop);
          liveAssistant = undefined;
        }
      } catch (error) {
        if (!closing) add("Error", error instanceof Error ? error.message : String(error));
      } finally {
        if (ownsTurn) {
          liveAssistant = undefined;
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

  const keybindings = getAppKeybindings();
  // Config edits land without a restart (AGENTS.md: configurable + hot-reload).
  keybindings.startWatching();

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
      themeController.rebindTui(tui);
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
        const { copyToClipboard } = await import("./clipboard.ts");
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

  /** Ctrl+T: show or hide every reasoning block in the transcript (pi-style). */
  function toggleThinkingBlockVisibility() {
    hideThinkingBlock = !hideThinkingBlock;
    for (const child of transcript.children)
      if (child instanceof AssistantMessageComponent) child.setHideThinkingBlock(hideThinkingBlock);
    liveAssistant?.setHideThinkingBlock(hideThinkingBlock);
    add("Preferences", `Thinking blocks: ${hideThinkingBlock ? "hidden" : "visible"}`);
    update();
  }

  /** Open the DSH-native session picker (shared by /resume and its keybinding). */
  function openSessionPicker() {
    const selector = new SessionSelector({
      currentSessionId: runtime.session?.id,
      currentDirectory: options.cwd,
      onSelect: (id) => {
        dismissPanel();
        void runBusy(() => applyResume(id));
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
  }

  /** Resume the chosen session (kept beside the picker it belongs to). */
  async function applyResume(value: string) {
    if (!route.model) throw new Error("Select a model first with /model.");
    const directory = await chooseResumeDirectory(value);
    if (directory === null) return;
    await connect(
      { provider: route.provider, model: route.model },
      { sessionId: value, directory },
    );
  }

  /**
   * Suspend to the shell: leave the alt screen, hand the terminal back with
   * SIGTSTP, and take it again on SIGCONT. Mid-turn suspension would restart
   * the TUI under a live stream, so it waits for an idle editor.
   */
  function suspendToBackground() {
    if (busy || running) {
      add("Suspend", "Wait for the current turn to finish before suspending.");
      return;
    }
    const resumed = () => {
      process.off("SIGCONT", resumed);
      themeController.applyFromSettings();
      tui.start();
      update();
    };
    process.on("SIGCONT", resumed);
    tui.stop({ preserveScreen: false });
    process.kill(process.pid, "SIGTSTP");
  }

  /**
   * Cycle the route among providers the user can actually authenticate
   * against, preferring the saved model for the next provider when there is
   * one. Mid-turn switches would race the running request, so they are
   * refused with a notice.
   */
  async function cycleModel(direction: 1 | -1) {
    if (busy || running) {
      add("Model", "Wait for the current turn to finish before switching models.");
      return;
    }
    const [{ providers, models }, { nextProvider }] = await Promise.all([
      import("../runtime/catalog.ts"),
      import("./model-cycle.ts"),
    ]);
    const authenticated = runtime.authProviders().map((provider) => provider.value);
    const order = authenticated.filter((provider) => providers.includes(provider));
    const selection = runtime.selection();
    const current = selection?.provider ?? route.provider;
    const next = nextProvider(order, current, direction);
    if (next === undefined) {
      add("Model", "No logged-in providers to cycle. Run /login first.");
      return;
    }
    const saved = await loadModel(preferencesPath(options.dshHome));
    const model = saved?.provider === next ? saved.model : (models(next)[0]?.id ?? undefined);
    if (model === undefined) {
      add("Model", `${next} has no models in the catalog.`);
      return;
    }
    add("Model", `${current} → ${next}/${model}`);
    await connect({ provider: next, model });
  }

  /** Session management picker (archive/restore/pin/unpin), shared by the slash commands and Ctrl+Backspace. */
  function openSessionActionPicker(sessionAction: "archive" | "restore" | "pin" | "unpin"): void {
    const title = {
      archive: "Archive conversation",
      restore: "Restore conversation",
      pin: "Pin conversation",
      unpin: "Unpin conversation",
    }[sessionAction];
    let records: Awaited<ReturnType<Runtime["sessions"]>> = [];
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
        // `selecting` is true while a picker panel is open, so the items are
        // filled in only then; a dismissed picker is left untouched.
        if (!selecting) return;
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
        if (selecting) dismissPanel();
        add("Error", error instanceof Error ? error.message : String(error));
      });
  }

  /** Alt+Up: pull the oldest queued message back into the editor. */
  function dequeueToEditor() {
    if (!queue.length) {
      add("Queue", "No queued messages.");
      return;
    }
    const restored = queue.shift()!;
    queueView.removeChild(restored.view);
    const draft = editor.getText();
    editor.setText(draft ? `${draft}\n${restored.text}` : restored.text);
    update();
  }

  tui.addInputListener((data) => {
    const kb = keybindings;
    if (kb.matches(data, "app.model.select")) {
      void pickModel();
      return { consume: true };
    }
    if (kb.matches(data, "app.model.cycleForward")) {
      void cycleModel(1);
      return { consume: true };
    }
    if (kb.matches(data, "app.model.cycleBackward")) {
      void cycleModel(-1);
      return { consume: true };
    }
    if (kb.matches(data, "app.message.followUp")) {
      // Alt+Enter queues the current draft instead of sending it now.
      const text = editor.getText();
      if (text.trim()) enqueue(text);
      return { consume: true };
    }
    if (kb.matches(data, "app.message.dequeue")) {
      dequeueToEditor();
      return { consume: true };
    }
    // Unbound by default; users who map them get the same flows as the commands.
    if (kb.matches(data, "app.session.resume")) {
      openSessionPicker();
      return { consume: true };
    }
    if (kb.matches(data, "app.session.new")) {
      void startNewConversation(false);
      return { consume: true };
    }
    if (kb.matches(data, "app.suspend")) {
      suspendToBackground();
      return { consume: true };
    }
    // "Delete session when query is empty": the archive picker, straight in.
    if (kb.matches(data, "app.session.deleteNoninvasive") && editor.getText().length === 0) {
      openSessionActionPicker("archive");
      return { consume: true };
    }
    if (kb.matches(data, "app.exit") && editor.getText().length === 0) {
      void requestExit();
      return { consume: true };
    }
    if (kb.matches(data, "app.clear")) {
      // Ctrl+C follows the agent-CLI convention: a draft is discarded first, a
      // live turn is interrupted (never exits mid-answer), a second press while
      // cancelling forces the exit, and an idle press exits.
      const action = ctrlCAction({
        draft: editor.getText().length > 0 || pendingFiles.length > 0,
        active: running || busy,
        cancelling: stopping,
      });
      if (action === "clear") {
        editor.setText("");
        pendingFiles = [];
        update();
      } else if (action === "interrupt") cancelTurn();
      else if (action === "force-exit") void stop(); // second press: no confirmation
      else void requestExit(); // idle press
      return { consume: true };
    }
    if (kb.matches(data, "app.interrupt") && !selecting) {
      if (decision) decision(null);
      else if (busy || running) cancelTurn();
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
      toggleThinkingBlockVisibility();
      return { consume: true };
    }
    if (kb.matches(data, "app.thinking.cycle")) {
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
    // Initialize theme controller: applies theme, queries terminal colors (DA1)
    themeController.applyFromSettings();
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
    // Wait for terminal colors to be reported (DA1) before connecting
    await themeController.waitForTerminalColors();

    if (!startupFailed) {
      if (route.model)
        await connect(
          { provider: route.provider, model: route.model },
          { sessionId: resume, startup: true },
        );
      else {
        const { providers } = await import("../runtime/catalog.ts");
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
    themeController.disableAutoSync();
    tui.stop({ preserveScreen: true });
    try {
      await runtime.close();
    } finally {
      restoreConsole?.();
    }
    if (continuationId) console.log(continuationCommand(continuationId, initial.resumeArgs));
  }
}
