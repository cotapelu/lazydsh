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
import type { SessionStats } from "./utils/stats.ts";

export type { SessionStats };

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

/**
 * What the UI decided for one approval request.
 *
 * `allowed-always` is lazydsh's own extension: DSH's approval seam has no
 * persistent grant (see `ApprovalOutcome` in `@deepseek-ai/dsh-user-approval`),
 * so the runtime remembers the tool name for the session and answers every
 * later request with `allowed-once`.
 */
export type ApprovalOutcome = "allowed-once" | "allowed-always" | "rejected" | "cancelled";

/** UI hooks the runtime calls when it needs a human. */
export type Callbacks = {
  resume?: string;
  onAuth?: (
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<unknown>;
  onApproval?: (params: ApprovalRequest) => Promise<{ outcome: ApprovalOutcome }>;
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

/** Options for `run()`. */
export type RunOptions = {
  /** Whether to treat input as a slash command. */
  commands?: boolean;
  /** Whether to auto-authenticate on 401. */
  authenticate?: boolean;
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

/** Current model selection with optional effort. */
export interface SelectionInfo extends Route {
  effort?: string;
}

/** Available reasoning efforts for the current model. */
export interface EffortsInfo {
  current: string;
  defaultEffort?: string;
  options: readonly string[];
}

/** One saved session shown in the session picker. */
export interface SessionSummary {
  id: string;
  title: string;
  directory?: string;
  archived: boolean;
  pinned: boolean;
  modified: number;
  messageCount: number;
}

/** A fork point (completed turn) for session forking. */
export interface ForkPoint {
  value: string;
  label: string;
  description: string;
}

/** Background job summary. */
export interface JobInfo {
  id: string;
  label: string;
  status: string;
  owner: string;
  progress?: string;
}

/** Job output for detail view. */
export interface JobOutput {
  text: string;
  lossy?: boolean;
  chunks?: readonly unknown[];
}

/** Auth provider entry for login selector. */
export interface AuthProvider {
  value: string;
  label: string;
  description: string;
}

/** Authorization flow detail. */
export interface AuthorizationFlow {
  key: string;
  label: string;
  methods: readonly { id: string; label: string }[];
}

/** Generic choice set for pickers (sessions, directories, mode, permissions). */
export interface ChoiceSet {
  current?: string;
  options: { value: string; label: string; description?: string }[];
}

/** Model connection test result. */
export type ModelConnectionTestResult = { ok: true } | { ok: false; error: string };

/** Tool definition shape (minimal). */
export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}
