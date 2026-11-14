import { formatNotification, terminalColor } from "./theme.ts";
import type { Runtime } from "./runtime.ts";

export type CommandOptions = {
  command: "ask" | "login" | "logout";
  provider?: string;
  model?: string;
  prompt?: string;
  resume?: string;
  permission?: string;
};

export async function runCommand(runtime: Runtime, config: CommandOptions, signal: AbortSignal) {
  if (config.command === "login") {
    const { terminalAuth } = await import("./terminal-login.ts");
    const provider = await terminalAuth(runtime, "login", config.provider, signal);
    console.log(formatNotification("Logged in", provider, terminalColor(process.stdout)));
    return;
  }
  if (config.command === "logout") {
    let provider = config.provider;
    if (provider === undefined) {
      const { terminalAuth } = await import("./terminal-login.ts");
      provider = await terminalAuth(runtime, "logout", undefined, signal);
    }
    const remaining = await runtime.logout(provider);
    console.log(formatNotification("Logged out", provider, terminalColor(process.stdout)));
    if (remaining.length)
      console.error(
        `Credentials are still available from ${remaining.join(", ")}. Unset them to disconnect completely.`,
      );
    return;
  }
  if (!config.provider) throw new Error("Choose a provider with --provider before using ask.");
  if (!config.model) throw new Error("Choose a model with --model before using ask.");
  if (!config.prompt?.trim()) throw new Error("Provide a prompt as an argument or through stdin.");
  let interactionError: Error | undefined;
  const stopForInteraction = (message: string) => {
    interactionError = new Error(message);
    void runtime.cancel().catch(() => {});
  };
  try {
    await runtime.open(
      { provider: config.provider, model: config.model },
      {
        resume: config.resume,
        onAuth: async () => {
          throw new Error(
            `Authentication is required. Run lazydsh login ${config.provider} in a terminal first.`,
          );
        },
        onApproval: async () => {
          stopForInteraction(
            "Approval is required. Set an appropriate --permission preset before using ask.",
          );
          return { outcome: "rejected" };
        },
        onUserQuestion: async () => {
          stopForInteraction("Interactive questions are unavailable in ask mode.");
          return { cancelled: true };
        },
      },
    );
    if (config.permission) await runtime.choices("permissions", config.permission);
    const result = await runtime.run(config.prompt, undefined, [], {
      commands: false,
      authenticate: false,
    });
    if (interactionError) throw interactionError;
    if (result.finishReason !== "completed")
      throw new Error(result.finalResponse || `Request ${result.finishReason}.`);
    process.stdout.write(result.finalResponse + (result.finalResponse.endsWith("\n") ? "" : "\n"));
  } finally {
    await runtime.close();
  }
}
