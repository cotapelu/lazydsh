import { QuestionPanel } from "./question.ts";
import { historyRows, continuationCommand } from "./history.ts";
import { openAuthUrl } from "./terminal-login.ts";
import { homedir } from "node:os";
import { sep } from "node:path";
import { preferencesPath, saveModel } from "./preferences.ts";
import { SearchPicker, selectionTheme } from "./picker.ts";
import { highlightCode } from "./highlight.ts";
import type { SessionStats } from "./stats.ts";
import { Autocomplete } from "./autocomplete.ts";
import { commandMenu } from "./commands.ts";
import type { RuntimeOptions, QuestionResult } from "./runtime.ts";
import type { AdmittedPromptContentPart } from "@deepseek-ai/dsh-attachment";
import { ToolLog, ToolRow } from "./tools.ts";
import {
  TuiAltScreen,
  ScrollView,
  VStack,
  ProcessTerminal,
  Text,
  Markdown,
  Container,
  matchesKey,
  type Component,
} from "@earendil-works/pi-tui";
import { models, providers } from "./catalog.ts";
import { Runtime, eventText, isAuthFailure, type Route, type Callbacks } from "./runtime.ts";

import {
  StartupBanner,
  StatusPanel,
  PromptEditor,
  SentMessage,
  Notification,
  SecretInput,
  Transcript,
  ThinkingView,
  editorBorder,
} from "./presentation.ts";
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

export async function runUI(
  options: RuntimeOptions & { cwd: string },
  initial: { provider: string; model?: string; resume?: string; resumeArgs?: string[] },
  runtime: Runtime,
) {
  const tui = new TuiAltScreen(new ProcessTerminal(), false, undefined, {
    mouse: true,
    scrollToEndIndicator: () => dim("↓ latest"),
  });
  const header = new StartupBanner();
  const transcript = new Transcript();
  const composer = new Container();
  const status = new Text("", 2, 1);
  const editor = new PromptEditor(tui, {
    borderColor: editorBorder,
    selectList: { ...selectionTheme, noMatch: dim },
  });
  const toolLog = new ToolLog();
  let route = initial;
  let resume = initial.resume;
  let commands = commandMenu();
  let stats: SessionStats | undefined;
  let pendingFiles: AdmittedPromptContentPart[] = [];
  let thinking: ThinkingView | undefined;
  let busy = false;
  let running = false;
  let closing = false;
  let continuationId: string | undefined;
  let pendingStartupConnection: { route: Route; sessionId?: string } | undefined;
  let decision: ((value: string | null) => void) | undefined;
  let selecting = false;
  const { promise: done, resolve: finish } = Promise.withResolvers<void>();

  const history = new Container();
  history.addChild(header);
  history.addChild(transcript);
  const scroll = new ScrollView(history, { primary: true, follow: "end", scrollbar: "auto" });
  composer.addChild(editor);
  composer.addChild(status);
  tui.setLayoutRoot(
    new VStack([
      { component: scroll, basis: 0, grow: 1, minSize: 0 },
      { component: composer, shrink: 0 },
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
    status.setText(
      dim(
        `${safeText(route.provider)} · ${safeText(route.model ?? "choose model")} · ${safeText(displayDirectory)}`,
      ),
    );
    editor.disableSubmit = busy && !decision;
    tui.requestRender();
  }

  async function refreshStats() {
    const sessionId = runtime.session?.id;
    try {
      const next = await runtime.stats();
      if (runtime.session?.id === sessionId && !closing) {
        stats = next;
        update();
      }
    } catch {
      if (runtime.session?.id === sessionId && !closing) {
        stats = undefined;
        update();
      }
    }
  }

  function add(label: string, text: unknown, markdown = false) {
    if (label === "You") {
      transcript.addChild(new SentMessage(String(text)));
      tui.requestRender();
      return;
    }
    if (label === "assistant") {
      transcript.addChild(
        markdown
          ? new Markdown(safeText(text), 2, 1, markdownTheme)
          : new Text(safeText(text), 2, 1),
      );
    } else {
      transcript.addChild(new Notification(label, text));
    }
    tui.requestRender();
  }

  function ask(message: string, signal?: AbortSignal) {
    if (closing || signal?.aborted) return Promise.resolve(null);
    if (decision)
      return Promise.reject(new Error("Another question is already awaiting an answer."));
    add("Input required", message);
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
      if (method === "lazydsh/auth-notice") {
        add("Authentication", [params.message, params.url, params.code].filter(Boolean).join("\n"));
        void openAuthUrl(params.url);
        return null;
      }
      const message = typeof params.message === "string" ? params.message : "Authentication";
      if (params.kind === "secret") {
        add("Authentication", message);
        return new Promise<string | null>((resolve) => {
          const input = new SecretInput({ prompt: accent("┃ ") });
          let settled = false;
          const settle = (value: string | null) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener("abort", abort);
            input.setValue("");
            decision = undefined;
            dismissPanel();
            resolve(value);
          };
          const abort = () => settle(null);
          signal?.addEventListener("abort", abort, { once: true });
          input.onSubmit = settle;
          input.onEscape = () => settle(null);
          decision = settle;
          showPanel(input);
        });
      }
      if (params.kind === "select" && Array.isArray(params.options)) {
        if (decision) throw new Error("Another question is already awaiting an answer.");
        const items = params.options as { id: string; label: string; description?: string }[];
        if (!items.length) return null;
        return new Promise<string | null>((resolve) => {
          let settled = false;
          const settle = (value: string | null) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener("abort", abort);
            decision = undefined;
            dismissPanel();
            update();
            resolve(value);
          };
          const abort = () => settle(null);
          const picker = select(
            items.map((item) => ({
              value: item.id,
              label: item.label,
              description: item.description,
            })),
            message,
            settle,
            undefined,
            false,
          );
          picker.onCancel = abort;
          decision = abort;
          signal?.addEventListener("abort", abort, { once: true });
          update();
        });
      }
      return ask(message, signal);
    },
    onApproval: async (params) => {
      const answer = await ask(
        `Tool: ${typeof params.toolName === "string" ? params.toolName : "unknown"}\n${typeof params.reason === "string" ? params.reason : ""}\nAllow this operation once? Type yes to allow; anything else rejects.`,
      );
      return { outcome: answer?.trim().toLowerCase() === "yes" ? "allowed-once" : "rejected" };
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

  async function connect(
    nextRoute: Route,
    sessionId?: string,
    notifyModel = false,
    startup = false,
  ) {
    pendingStartupConnection = undefined;
    busy = true;
    update();
    try {
      const id = await runtime.open(nextRoute, { ...callbacks, resume: sessionId });
      if (closing) return;
      await saveModel(preferencesPath(options.dshHome), nextRoute);
      commands = commandMenu(await runtime.commands());
      options.cwd = await runtime.cd();
      setAutocomplete();
      continuationId = id;
      pendingFiles = [];
      toolLog.entries.clear();
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
              row.kind === "assistant",
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
    } catch (error) {
      decision?.(null);
      await runtime.close();
      if (startup && isAuthFailure(error))
        pendingStartupConnection = { route: nextRoute, sessionId };
      else if (!closing)
        add(
          "Connection error",
          `${error instanceof Error ? error.message : String(error)}\nUse /model to retry authentication.`,
        );
    } finally {
      busy = false;
      if (!closing) update();
    }
  }

  function dismissPanel() {
    selecting = false;
    composer.clear();
    composer.addChild(editor);
    composer.addChild(status);
    tui.setFocus(editor);
    tui.requestRender();
  }

  function showPanel(panel: Component) {
    selecting = true;
    composer.clear();
    composer.addChild(panel);
    composer.addChild(status);
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

  function pickModel(sessionId = runtime.session?.id ?? resume) {
    const picker = select(
      providers.map((id) => ({ value: id, label: id })),
      "Providers",
      (provider) => {
        pickProviderModel(provider, sessionId, picker);
      },
      undefined,
      true,
    );
  }

  function pickProviderModel(provider: string, sessionId?: string, parent?: SearchPicker) {
    const picker = select(
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
      else pickModel(sessionId);
    };
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
      add("Shutdown error", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    } finally {
      finish();
    }
  }

  editor.onSubmit = (text: string) => {
    if (closing) return;
    if (decision) {
      decision(text);
      return;
    }
    if (busy || !text.trim()) return;
    if (running && !canRunDuringTurn(text)) {
      add(
        "Error",
        "A response is running. Use Esc to stop it before sending another message or switching sessions.",
      );
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
    editor.addToHistory(text);
    editor.setText("");
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
    if (text === "/model") {
      pickModel();
      return;
    }
    if (text === "/new") {
      if (route.model) void connect({ provider: route.provider, model: route.model });
      else pickModel();
      return;
    }
    if (!runtime.session) {
      add("Error", "No model connected. Select a model with /model.");
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
        add("Error", "No completed turns to fork from");
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
      const picker = select([], title, (id) => {
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
          if (composer.children.includes(picker))
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
          if (composer.children.includes(picker)) dismissPanel();
          add("Error", error instanceof Error ? error.message : String(error));
        });
      return;
    }
    const jobCommand = /^\/(ps|stop)(?:\s+(\S+))?$/.exec(text);
    if (jobCommand) {
      const stopping = jobCommand[1] === "stop";
      const perform = async (id: string) => {
        const result = await runtime.job(id, stopping);
        if (stopping) add("Job", `${id}: ${result}`);
        else {
          transcript.addChild(new Text(safeText(result), 2, 1));
          tui.requestRender();
        }
      };
      const handleError = (error: unknown) =>
        add("Error", error instanceof Error ? error.message : String(error));
      if (jobCommand[2]) void perform(jobCommand[2]).catch(handleError);
      else {
        const picker = select([], stopping ? "Stop job" : "Background jobs", (id) => {
          void perform(id).catch(handleError);
        });
        picker.setLoading();
        void runtime
          .jobs()
          .then((jobs) => {
            if (composer.children.includes(picker))
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
          await connect({ provider: route.provider, model: route.model }, value);
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
        else {
          const picker = select(
            [],
            name === "resume" ? "Sessions" : name === "cd" ? "Directories" : "Permissions",
            (value) => {
              void runBusy(() => apply(value));
            },
            undefined,
            name !== "permission",
          );
          picker.setLoading();
          try {
            const choices = await runtime.choices(kind);
            if (composer.children.includes(picker))
              picker.setItems(choices.options, choices.current);
          } catch (error) {
            if (composer.children.includes(picker)) dismissPanel();
            throw error;
          }
        }
      });
      return;
    }
    if (runtime.authFailed && text.startsWith("/") && text !== "/status") {
      add("Error", "Model authentication failed. Check credentials and retry a message.");
      return;
    }
    if (text === "/session") {
      add("Session", runtime.session?.id ?? "No active session.");
      return;
    }
    if (text === "/effort") {
      const picker = select(
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
          if (!composer.children.includes(picker)) return;
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
          if (composer.children.includes(picker)) dismissPanel();
          add("Effort error", error instanceof Error ? error.message : String(error));
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
          add("Status error", error instanceof Error ? error.message : String(error));
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
        add("File", "Usage: /file <path> · /file clear to discard pending attachments");
        return;
      }
      if (path === "clear") {
        pendingFiles = [];
        add("File", "Pending attachments cleared.");
        return;
      }
      void runBusy(async () => {
        pendingFiles.push(await runtime.attach(path));
        add("Attached", `${path} · included with your next message`);
      }, "Attachment error");
      return;
    }
    if (text === "/dsh") {
      add("dsh", "Usage: /dsh <command> [arguments] · bypass TUI command names");
      return;
    }
    if (text.startsWith("/dsh ")) text = "/" + text.slice(5).trimStart().replace(/^\//, "");
    const ownsTurn = !running;
    if (ownsTurn) running = true;
    else busy = true;
    update();
    void (async () => {
      let lastAssistant: string | undefined;
      let liveAnswer: Markdown | undefined;
      const liveBlocks = new Map<number, string>();
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
                liveAnswer = new Markdown("", 2, 1, markdownTheme);
                liveBlocks.clear();
                transcript.addChild(liveAnswer);
              }
              const index = notification.params.index;
              liveBlocks.set(index, (liveBlocks.get(index) ?? "") + notification.params.text);
              liveAnswer.setText(
                safeText(
                  [...liveBlocks.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([, value]) => value)
                    .join("\n"),
                ),
              );
              tui.requestRender();
              return;
            }
            if (
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
            if (liveAnswer && notification.params.sessionId === runtime.session?.id) {
              liveAnswer.setText(safeText(output.text));
              if (!transcript.children.includes(liveAnswer)) transcript.addChild(liveAnswer);
              liveAnswer = undefined;
              liveBlocks.clear();
              tui.requestRender();
            } else add("assistant", output.text, true);
          },
          pendingFiles,
        );
        if (result.finishReason === "completed") pendingFiles = [];
        if (result.finalResponse && result.finalResponse !== lastAssistant)
          add(result.finishReason === "error" ? "Error" : "dsh", result.finalResponse, true);
        else if (result.finishReason === "error")
          add("Error", "dsh reported an error. Review the output above.");
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
        } else busy = false;
        tui.requestRender();
        if (!closing) await refreshStats();
      }
    })();
  };

  tui.addInputListener((data) => {
    if (matchesKey(data, "ctrl+c")) {
      if (editor.getText().length > 0 || pendingFiles.length > 0) {
        editor.setText("");
        pendingFiles = [];
        update();
      } else void stop();
      return { consume: true };
    }
    if (matchesKey(data, "escape") && !selecting) {
      if (decision) decision(null);
      else if (busy || running) {
        update();
        void runtime
          .cancel()
          .then(() => {
            add("Stopped", "Execution cancelled. You can continue this conversation.");
          })
          .catch((error) =>
            add("Stop error", error instanceof Error ? error.message : String(error)),
          );
      }
      return { consume: true };
    }
  });
  const signalHandler = () => {
    void stop();
  };
  options.signal?.addEventListener("abort", signalHandler, { once: true });
  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);
  try {
    tui.start();
    update();
    if (route.model)
      await connect({ provider: route.provider, model: route.model }, resume, false, true);
    else if (providers.includes(route.provider)) pickProviderModel(route.provider, resume);
    else pickModel();
    await done;
  } finally {
    options.signal?.removeEventListener("abort", signalHandler);
    process.off("SIGINT", signalHandler);
    process.off("SIGTERM", signalHandler);
    decision?.(null);
    thinking?.finish();
    tui.stop({ preserveScreen: true });
    await runtime.close();
    if (continuationId) console.log(continuationCommand(continuationId, initial.resumeArgs));
  }
}
