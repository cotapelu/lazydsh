/**
 * Consolidated Type Definitions
 *
 * Central location for shared type definitions used across the codebase.
 */

import type { ToolResult } from "@deepseek-ai/dsh-tools";
import type { SessionEvent } from "@deepseek-ai/dsh-session";

/** Where the credential for a route currently comes from. */
export type CredentialSource = {
  kind: "environment" | "store" | "oauth" | "ambient" | "keyless" | "none" | "unknown";
  label: string;
  ref?: string;
};

export type Route = { provider: string; model: string };
export type QuestionResult = { answers: any[] } | { cancelled: true };
export type ApprovalRequest = {
  toolName: string;
  reason?: string;
  displayReason?: { en: string; [locale: string]: string };
  callId?: string;
  signal?: AbortSignal;
};

export type Callbacks = {
  resume?: string;
  onAuth?: (
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<unknown>;
  onApproval?: (
    params: ApprovalRequest,
  ) => Promise<{ outcome: "allowed-once" | "rejected" | "cancelled" }>;
  onUserQuestion?: (request: any, context: { signal: AbortSignal }) => Promise<QuestionResult>;
};

export type RunResult = {
  sessionId: string;
  finalResponse: string;
  finishReason: "completed" | "error" | "aborted";
  events: SessionEvent[];
};

export type RuntimeEvent =
  | { method: "session.event"; params: { sessionId: string; event: SessionEvent } }
  | {
      method: "assistant.delta";
      params: { sessionId: string; attemptId: string; text: string; index: number };
    }
  | {
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
      params: { toolCallId: string; result: ToolResult; isError: boolean; durationMs?: number };
    };

/** The slice of a DSH tool definition this component consumes. */
export type ToolPresenterDefinition = {
  presentCall?: (args: unknown) => unknown;
  presentResult?: (args: unknown, result: ToolResult) => unknown;
};

export interface ToolExecutionOptions {
  showImages?: boolean;
  imageWidthCells?: number;
  outputPad?: number;
}

export interface ResolvedImage {
  data: string;
  mediaType: string;
}

export type ImageResolver = (block: any) => Promise<ResolvedImage> | ResolvedImage | undefined;

export type RuntimeOptions = {
  cwd?: string;
  dshHome?: string;
  reasoningEffort?: string;
  signal?: AbortSignal;
};

export interface SessionInfo {
  id: string;
  title: string;
  directory: string;
  archived: boolean;
  pinned: boolean;
}
