import type { Context } from "@deepseek-ai/cordis";
import { Runtime } from "../../src/runtime.ts";
export const name = "lazydsh-test";
export const inject = [
  "agents",
  "llm",
  "commands",
  "workingDirectory",
  "attachments",
  "sessionProjections",
  "authorization",
  "credentials",
  "userQuestions",
  "sessionTitle",
  "workspaceRegistry",
  "jobs",
  "fileReferences",
  "skills",
];
declare module "@deepseek-ai/cordis" {
  interface Context {
    lazydshTest: Runtime;
  }
}
export function apply(ctx: Context) {
  const runtime = new Runtime(ctx, { cwd: process.env.TEST_WORKSPACE ?? process.cwd() });
  ctx.provide("lazydshTest", runtime);
  ctx.effect(() => () => runtime.close());
}
