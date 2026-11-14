import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-cmdline";
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import { Runtime } from "./runtime.ts";
import { loadModel, preferencesPath } from "./preferences.ts";
import { resolve } from "node:path";

export const name = "lazydsh";
export const inject = [
  "agents",
  "workingDirectory",
  "commands",
  "attachments",
  "sessionProjections",
  "llm",
  "authorization",
  "credentials",
  "userQuestions",
  "sessionTitle",
  "workspaceRegistry",
  "jobs",
  "fileReferences",
  "skills",
  "appReady",
  "appExit",
];

export interface PluginOptions {
  cwd?: string;
  home?: string;
  provider?: string;
  model?: string;
  resume?: string;
  pickSession?: boolean;
  effort?: string;
  resumeArgs?: string[];
  command?: "ask" | "login" | "logout";
  prompt?: string;
  permission?: string;
}
declare module "@deepseek-ai/cordis" {
  interface Context {
    lazydshApp: { done: Promise<void> };
  }
}
export function apply(ctx: Context, config: PluginOptions = {}) {
  const lifetime = new AbortController();
  const completion = Promise.withResolvers<void>();
  ctx.provide("lazydshApp", { done: completion.promise });
  let task: Promise<void> | undefined;
  const start = async () => {
    const saved =
      config.command === "login" || config.command === "logout" || (config.provider && config.model)
        ? undefined
        : await loadModel(preferencesPath(config.home));
    const provider = config.provider ?? saved?.provider ?? "deepseek-official";
    const model =
      config.model ??
      (config.provider === undefined || config.provider === saved?.provider
        ? saved?.model
        : undefined) ??
      (provider === "deepseek-official" ? "deepseek-flash" : undefined);
    const options = {
      cwd: resolve(config.cwd ?? "."),
      dshHome: config.home,
      signal: lifetime.signal,
      reasoningEffort: config.effort === undefined ? undefined : ReasoningEffortId(config.effort),
    };
    const runtime = new Runtime(ctx, options);
    if (config.command) {
      const { runCommand } = await import("./command-runner.ts");
      await runCommand(
        runtime,
        {
          ...config,
          command: config.command,
          provider:
            config.command === "login" || config.command === "logout" ? config.provider : provider,
          model,
        },
        lifetime.signal,
      );
      return;
    }
    let resume = config.resume;
    if (config.pickSession) {
      const { selectSession } = await import("./session-select.ts");
      resume = (await selectSession(runtime, lifetime.signal)) ?? undefined;
      if (!resume) return;
    }
    const { runUI } = await import("./ui.ts");
    await runUI(
      options,
      {
        provider,
        model,
        resume,
        resumeArgs: config.resumeArgs ?? (config.home ? ["--home", resolve(config.home)] : []),
      },
      runtime,
    );
  };
  const removeReady = ctx.appReady!.onReady(() => {
    task = start();
    task.then(
      () => {
        completion.resolve();
        ctx.appExit!(0);
      },
      (error) => {
        completion.reject(error);
        ctx.appExit!(1);
      },
    );
  });
  ctx.effect(() => async () => {
    removeReady();
    lifetime.abort();
    await task?.catch(() => {});
    completion.resolve();
  });
}
