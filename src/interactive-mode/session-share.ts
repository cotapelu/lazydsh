import type { Runtime } from "../runtime/runtime.ts";
import type { RuntimeOptions } from "../interfaces.ts";
import { packageVersion } from "../utils/version.ts";

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
  const shareUrl = `https://share.lazydsh.dev/#${targetSessionId}?v=${packageVersion()}`;

  return shareUrl;
}
