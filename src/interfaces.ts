/**
 * lazydsh CONTRACT — the types that cross the FE/BE boundary.
 *
 * The interactive-mode layer (TUI) and the runtime layer (DSH bridge) both
 * import from here, so neither imports the other for types. Logic lives in
 * `runtime/runtime.ts` (implementation) and `runtime-events.ts` (events);
 * this file is types only by design.
 */
import type { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import type {
  AskUserQuestionAnswer,
  AskUserQuestionRequest,
} from "@deepseek-ai/dsh-user-questions";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

export type { AutocompleteItem };

/** A provider/model pair identifying the active route. */
export type Route = { provider: string; model: string };

/** Answer shape of an ask_user_question round: answers or a cancellation. */
export type QuestionResult = AskUserQuestionAnswer | { cancelled: true };

/** Where the credential for a route currently comes from. */
export type CredentialSource = {
  kind: "environment" | "store" | "oauth" | "ambient" | "keyless" | "none" | "unknown";
  /** Human-readable description for notices. */
  label: string;
  /** Environment-variable name when `kind` is `environment`. */
  ref?: string;
};

/** Constructor options for the runtime wrapper. */
export type RuntimeOptions = {
  cwd?: string;
  dshHome?: string;
  reasoningEffort?: ReasoningEffortId;
  signal?: AbortSignal;
};

/** An approval request the UI must settle before a tool runs. */
export type ApprovalRequest = {
  toolName: string;
  reason?: string;
  displayReason?: { en: string; [locale: string]: string };
  callId?: string;
  signal?: AbortSignal;
};

/** UI hooks the runtime calls when it needs a human. */
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
  onUserQuestion?: (
    request: AskUserQuestionRequest,
    context: { signal: AbortSignal },
  ) => Promise<QuestionResult>;
};

/** Terminal outcome of one run. */
export type RunResult = {
  sessionId: string;
  finalResponse: string;
  finishReason: "completed" | "error" | "aborted";
  events: SessionEvent[];
};

/** The narrow TUI surface lazydsh's components and loaders actually consume. */
export interface TuiHost {
  requestRender(force?: boolean): void;
}

/** One row in the model catalog the interactive selector consumes. */
export interface CatalogModel {
  provider: string;
  id: string;
  name: string;
  [key: string]: unknown;
}

/**
 * The model-catalog surface the interactive selector was ported against.
 * `refresh` and `getError` are optional: a static catalog needs neither.
 *
 * The optional hooks are declared `this: void` — they never read instance
 * state — so callers may reference them unbound (e.g. to test presence).
 */
export interface ModelRuntime {
  getAvailableSnapshot(): CatalogModel[];
  getModel(provider: string, id: string): CatalogModel | undefined;
  getError?(this: void): string | undefined;
  refresh?(this: void, options: { signal: AbortSignal }): Promise<unknown>;
}

/** Opaque id type used by the session layer. */
export type SessionIdLike = string;
