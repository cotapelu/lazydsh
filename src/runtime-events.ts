import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { SessionEvent } from "@deepseek-ai/dsh-session";

export type RuntimeEvent =
  | { method: "session.event"; params: { sessionId: string; event: SessionEvent } }
  | {
      method: "assistant.delta";
      params: { sessionId: string; attemptId: string; text: string; index: number };
    }
  | {
      /** The model's reasoning delta, streamed alongside the answer text. */
      method: "assistant.reasoning";
      params: { sessionId: string; attemptId: string; text: string; index: number };
    }
  | {
      method: "tool_execution_start";
      params: { toolName: string; toolCallId: string; args: Record<string, unknown> };
    }
  | { method: "tool_execution_update"; params: { toolCallId: string; partialResult: any } }
  | {
      method: "tool_execution_end";
      params: { toolCallId: string; result: any; isError: boolean; durationMs?: number };
    };

/** Tool output shape returned by eventText for tool-related events. */
export type ToolOutput =
  | { kind: "tool"; sessionId: string | undefined; callId: string; name: string; text: string }
  | {
      kind: "result" | "error";
      sessionId: string | undefined;
      callId: string;
      text: string;
      reason?: string;
      meta?: unknown;
      durationMs?: number;
    };

export function isAuthFailure(failure: unknown) {
  if (typeof failure !== "object" || failure === null) return false;
  const { code, status, message } = failure as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };
  return (
    (typeof code === "string" &&
      ["AUTH", "MISSING_CREDENTIAL", "INVALID_API_KEY", "UNAUTHORIZED"].includes(
        code.toUpperCase(),
      )) ||
    status === 401 ||
    status === 403 ||
    (code === "PI_AI_ERROR" &&
      typeof message === "string" &&
      /not configured|not logged in|no api key|no credential|oauth/i.test(message))
  );
}

export function eventText(
  notification: RuntimeEvent,
): ToolOutput | { kind: "assistant"; text: string } | undefined {
  // Handle direct tool execution events from Runtime
  if (notification.method === "tool_execution_start") {
    const { toolName, toolCallId, args } = notification.params;
    return {
      kind: "tool",
      sessionId: undefined,
      callId: toolCallId,
      name: toolName,
      text: JSON.stringify(args),
    };
  }
  if (notification.method === "tool_execution_end") {
    const { toolCallId, result, isError } = notification.params;
    return {
      kind: isError ? "error" : "result",
      sessionId: undefined,
      callId: toolCallId,
      text: typeof result === "string" ? result : JSON.stringify(result),
      reason: isError ? (result?.error?.message ?? result?.message) : undefined,
      meta: result?.meta,
    };
  }
  // Handle session events (DSH native)
  if (notification.method !== "session.event") return;
  const { event, sessionId } = notification.params;
  if (event.type === "assistant/message") {
    return { kind: "assistant", text: contentText(event.data.message.content) } as const;
  }
  if (event.type === "tool/call")
    return {
      kind: "tool",
      sessionId,
      callId: event.data.callId,
      name: event.data.name,
      text: event.data.arguments,
    } as const;
  if (event.type === "tool/result") {
    return {
      kind: event.data.message.isError ? "error" : "result",
      sessionId,
      callId: event.data.message.toolCallId,
      text: contentText(event.data.message.content),
      reason: event.data.error?.reason,
      // Tool metadata carries contextual diffs the detail renderer can show.
      meta: event.data.meta,
    } as const;
  }
}

export function contentText(content: readonly ContentBlock[]) {
  return content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "image")
        return `[image ${block.attachment.width}x${block.attachment.height}, ${block.attachment.bytes} bytes]`;
      if (block.type === "file")
        return `[file ${block.attachment.name ?? block.attachment.attachmentId}]`;
      return "";
    })
    .filter((text) => text !== "")
    .join("\n");
}

/** The model's visible reasoning blocks, joined for a collapsed thinking row. */
export function reasoningText(content: readonly ContentBlock[]) {
  return content
    .filter((block) => block.type === "reasoning")
    .map((block) => block.text)
    .join("\n\n");
}
