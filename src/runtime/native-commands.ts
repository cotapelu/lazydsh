import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-commands";
import type {} from "@deepseek-ai/dsh-working-directory";
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import { CommandDefinitionId } from "@deepseek-ai/dsh-commands/brand";
import {
  flushLiveSessionLog,
  readSessionLogText,
  sessionLogExportDeps,
  streamSessionLogZip,
} from "@deepseek-ai/dsh-session-log-export";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";

export function registerCommands(ctx: Context) {
  ctx.effect(
    () =>
      ctx.commands.register({
        definitionId: CommandDefinitionId("@deepseek-ai/dsh-session-log-export"),
        name: "export",
        description: "Export this session, descendants and attachments as ZIP",
        input: { hint: "[destination.zip]" },
        handler: async ({ agent, rawInput, signal }) => {
          const id = agent.session.id;
          const directory = { cwd: await ctx.workingDirectory.ensure(agent) };
          const path = resolve(directory.cwd, rawInput.trim() || `${id}.zip`);
          const deps = sessionLogExportDeps(ctx);
          if (!deps.sessionQuery || !deps.sessionPersistence || !deps.attachments)
            throw new Error("Session export services unavailable");
          await flushLiveSessionLog(deps, id, signal);
          const content = await readSessionLogText(deps.sessionPersistence, id, signal);
          if (content === undefined) throw new Error("Session log not found");
          const file = await open(path, "wx", 0o600);
          try {
            await pipeline(
              streamSessionLogZip(
                {
                  ...deps,
                  sessionQuery: deps.sessionQuery,
                  sessionPersistence: deps.sessionPersistence,
                  attachments: deps.attachments,
                },
                content,
                id,
                true,
                6,
                signal,
              ),
              file.createWriteStream(),
              { signal },
            );
          } finally {
            await file.close();
          }
          return { kind: "success", text: `Exported ${path}` };
        },
      }),
    "lazydsh: export",
  );

  ctx.effect(
    () =>
      ctx.commands.register({
        name: "effort",
        description: "Set reasoning effort for the current model",
        input: { hint: "[level | default]" },
        handler: async ({ agent, rawInput, signal }) => {
          const current = agent.model.current();
          if (!current) throw new Error("No model selected");
          const info = await ctx.llm.resolveModelInfo(current.provider, current.model, signal);
          const level = rawInput.trim();
          if (!level || level === "undefined")
            return {
              kind: "success",
              text: `Effort: ${current.reasoningEffort ?? "default"} · available: default${info.reasoning?.efforts.map((item) => `, ${item.id}`).join("") ?? ""}`,
            };
          const efforts = info.reasoning?.efforts ?? [];
          if (level !== "default" && !efforts.some((item) => item.id === level))
            throw new Error(`Unsupported effort: ${level}`);
          const selection = {
            provider: current.provider,
            model: current.model,
            ...(level === "default" ? {} : { reasoningEffort: ReasoningEffortId(level) }),
          };
          await ctx.llm.resolveCallConfig(selection, signal);
          agent.model.select(selection);
          return { kind: "success", text: `Effort set to ${level}` };
        },
      }),
    "lazydsh: effort",
  );
}
