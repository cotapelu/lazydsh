import type { Runtime } from "./runtime.ts";
import type { RuntimeOptions } from "./interfaces.ts";

/** Generate a shareable link for the current session. */
export async function generateShareLink(
  runtime: Runtime,
  options: RuntimeOptions & { cwd: string },
  sessionId?: string,
): Promise<string> {
  const targetSessionId = sessionId ?? runtime.session?.id;
  if (!targetSessionId) {
    throw new Error("No session to share. Run /resume or start a conversation first.");
  }

  // For now, return a placeholder share URL
  // In production, this would upload the session to a sharing service
  const pkg = await import("../package.json", { with: { type: "json" } }).then((m) => m.default);
  const shareUrl = `https://share.lazydsh.dev/#${targetSessionId}?v=${pkg.version}`;

  return shareUrl;
}
