import {
  truncateToWidth,
  type Component,
  type TuiMouseEvent,
  type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { safeText, dim, success, error, fg } from "./theme.ts";
import { toolDetails } from "./detail.ts";
import { keyHint } from "./keybinding-hints.ts";
import type { ToolOutput } from "../runtime-events.ts";
import { BashExecutionComponent } from "./bash-execution.ts";
import type { TuiHost } from "../interfaces.ts";

/** Tool lifecycle state */
type ToolState = "calling" | "running" | "success" | "error" | "truncated";

/** Union type for tool entry rows - either a generic ToolRow or a BashExecutionComponent for bash tools */
interface ToolEntry {
  row: ToolRow | BashExecutionComponent;
  label: string;
  callId: string;
  isBash: boolean;
  tui?: TuiHost;
}

function target(argumentsText: string): string {
  try {
    const args: unknown = JSON.parse(argumentsText);
    if (args && typeof args === "object") {
      for (const key of ["path", "file_path", "filePath", "command", "pattern", "query", "url"]) {
        const value: unknown = Reflect.get(args, key);
        if (typeof value === "string") return safeText(value).split("\n")[0].trim();
      }
    }
  } catch {
    /* Partial or non-JSON tool arguments have no target preview. */
  }
  return "";
}

function baseLabel(summary: string) {
  const match = /^([·✓✗⚠⟳])\s+([\s\S]*)$/.exec(summary);
  const body = match?.[2] ?? summary;
  const suffixAt = body.indexOf(" — ");
  return suffixAt >= 0 ? body.slice(0, suffixAt) : body;
}

interface ToolArgs {
  file_path?: string;
  filePath?: string;
  path?: string;
  offset?: number | string;
  limit?: number | string;
  command?: string;
  pattern?: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  sandbox_permissions?: string;
  justification?: string;
  [key: string]: unknown;
}

/** Safely extract string value from ToolArgs */
function getStringArg(args: ToolArgs | undefined, key: string): string {
  if (!args) return "";
  const val = args[key];
  return typeof val === "string" ? val : "";
}

interface ReadMeta {
  totalLines?: number;
  offset?: number;
  lines?: Array<{ number: number; text: string }>;
  truncated?: boolean;
}

interface WriteMeta {
  operation?: "create" | "update";
  path?: string;
  before?: string | null;
  after?: string;
}

interface EditMeta {
  diffs?: Array<{
    path?: string;
    oldText?: string | null;
    newText?: string;
  }>;
}

interface GrepMeta {
  items?: Array<{
    path: string;
    lineNumber: number;
    line: string;
    lines?: string;
  }>;
  truncated?: boolean;
}

interface GlobFindMeta {
  matches?: string[];
}

interface LsMeta {
  dirs?: string[];
  files?: string[];
}

interface BashMeta {
  exitCode?: number;
}

type ToolMeta =
  | ReadMeta
  | WriteMeta
  | EditMeta
  | GrepMeta
  | GlobFindMeta
  | LsMeta
  | BashMeta
  | Record<string, unknown>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export class ToolRow implements Component {
  private value: string;
  private label: string;
  private argumentsText?: string;
  private resultText?: string;
  private resultMeta?: unknown;
  private expanded = false;
  private revision = 0;
  private cachedWidth = -1;
  private cachedRevision = -1;
  private cachedLines?: string[];

  /** Tool lifecycle state */
  private state: ToolState = "calling";
  /** Start time for running duration */
  private startTime = Date.now();

  // Cache fields for performance
  private cachedToolName: string | undefined;
  private cachedTarget: string | undefined;
  private cachedArgsKey: string | undefined;
  private parsedArgsCache: Record<string, unknown> | undefined;
  private cachedSuffix: string | undefined;
  private cachedSuffixKey: string | undefined;
  private cachedColoredIcon: string | undefined;
  private cachedIconState: ToolState | undefined;

  constructor(summary: string) {
    this.value = summary;
    this.label = baseLabel(summary);
  }
  get summary() {
    return this.value;
  }
  get isExpanded() {
    return this.expanded;
  }
  /** Raw call JSON, so an approval prompt can show what is about to run. */
  get callArguments() {
    return this.argumentsText;
  }
  /** Current tool state */
  get toolState(): ToolState {
    return this.state;
  }
  /** Mark tool as running (for long-running tools) */
  markRunning(): void {
    if (this.state === "calling") {
      this.state = "running";
      this.touch();
    }
  }
  private get hasDetails() {
    return (
      this.argumentsText !== undefined ||
      this.resultText !== undefined ||
      this.resultMeta !== undefined
    );
  }

  private touch() {
    this.revision++;
    this.cachedLines = undefined;
    this.cachedRevision = -1;
    this.cachedWidth = -1;
    this.invalidateCache();
  }

  private invalidateCache(): void {
    this.cachedToolName = undefined;
    this.cachedTarget = undefined;
    this.cachedArgsKey = undefined;
    this.parsedArgsCache = undefined;
    this.cachedSuffix = undefined;
    this.cachedSuffixKey = undefined;
    this.cachedColoredIcon = undefined;
    this.cachedIconState = undefined;
  }

  setSummary(summary: string) {
    if (summary === this.value) return;
    this.value = summary;
    this.touch();
  }
  /** Keep the raw call so the collapsed row can expand without re-reading the log. */
  setCall(argumentsText: string) {
    this.argumentsText = argumentsText;
    this.touch();
  }
  /** Update streaming tool call arguments. */
  updateArgs(args: Record<string, unknown>) {
    this.argumentsText = JSON.stringify(args, null, 2);
    this.touch();
  }
  private durationMs?: number;
  finish(
    status: "ok" | "error",
    text: string,
    reason?: string,
    meta?: unknown,
    durationMs?: number,
  ) {
    this.resultText = text;
    this.resultMeta = meta;
    this.durationMs = durationMs;
    this.state = status === "error" ? "error" : "success";

    // Detect truncation for read/grep tools
    const metaObj = meta as Record<string, unknown> | undefined;
    const truncated =
      metaObj?.truncated === true ||
      (metaObj &&
        typeof metaObj.totalLines === "number" &&
        metaObj.lines &&
        Array.isArray(metaObj.lines) &&
        metaObj.lines.length < metaObj.totalLines);
    if (truncated && this.state !== "error") {
      this.state = "truncated";
    }

    this.setSummary(this.buildSummary(status, text, reason, meta));
    this.touch();
  }

  /** Build the summary line with rich suffix based on tool type and result */
  private buildSummary(
    status: "ok" | "error",
    text: string,
    reason?: string,
    meta?: unknown,
  ): string {
    const statusIcon = this.getStatusIcon();
    const toolName = this.getToolName();
    const target = this.getTarget();
    const suffix = this.buildSuffix(status, text, reason, meta);
    const timing =
      this.durationMs !== undefined ? ` · ${this.durationMs.toLocaleString("en-US")}ms` : "";

    return `${statusIcon} ${toolName} ${target}${suffix}${timing}`;
  }

  /** Get status icon with color */
  private getStatusIcon(): string {
    switch (this.state) {
      case "calling":
        return "⟳";
      case "running":
        return "⟳";
      case "success":
        return "✓";
      case "truncated":
        return "⚠";
      case "error":
        return "✗";
    }
  }

  /** Extract tool name from label (cached) */
  private getToolName(): string {
    if (this.cachedToolName) return this.cachedToolName;
    this.cachedToolName = this.label.split(" ")[0];
    return this.cachedToolName;
  }

  /** Extract target from label or arguments (cached) */
  private getTarget(): string {
    const argsKey = this.argumentsText || "";
    if (this.cachedArgsKey === argsKey && this.cachedTarget !== undefined) {
      return this.cachedTarget;
    }
    this.cachedArgsKey = argsKey;

    const args = this.getParsedArgs();
    if (!args) {
      this.cachedTarget = this.label;
      return this.cachedTarget;
    }

    const toolName = this.getToolName();
    let target = "";
    switch (toolName) {
      case "read": {
        const path =
          getStringArg(args, "file_path") ||
          getStringArg(args, "filePath") ||
          getStringArg(args, "path");
        const offset = getStringArg(args, "offset") ? Number(getStringArg(args, "offset")) : 1;
        const limit = getStringArg(args, "limit") ? Number(getStringArg(args, "limit")) : 0;
        if (path && limit > 0) target = `${path}:${offset}-${offset + limit - 1}`;
        else if (path) target = `${path}:${offset}-`;
        else target = path || "";
        break;
      }
      case "write":
        target =
          getStringArg(args, "file_path") ||
          getStringArg(args, "filePath") ||
          getStringArg(args, "path") ||
          "";
        break;
      case "edit":
        target =
          getStringArg(args, "file_path") ||
          getStringArg(args, "filePath") ||
          getStringArg(args, "path") ||
          "";
        break;
      case "grep":
        target = getStringArg(args, "path")
          ? `"${getStringArg(args, "pattern")}" ${getStringArg(args, "path")}`
          : `"${getStringArg(args, "pattern")}"`;
        break;
      case "glob":
        target = getStringArg(args, "pattern") || "";
        break;
      case "find":
        target = getStringArg(args, "path")
          ? `${getStringArg(args, "path")} ${getStringArg(args, "pattern")}`
          : getStringArg(args, "pattern") || "";
        break;
      case "ls":
        target = getStringArg(args, "path") || "";
        break;
      case "bash":
        target = getStringArg(args, "command") || "";
        break;
      default:
        target = this.label;
    }
    this.cachedTarget = target;
    return target;
  }

  /** Get parsed arguments (cached) */
  private getParsedArgs(): Record<string, unknown> | undefined {
    if (this.parsedArgsCache) return this.parsedArgsCache;
    if (!this.argumentsText) return undefined;
    try {
      this.parsedArgsCache = JSON.parse(this.argumentsText);
    } catch {
      this.parsedArgsCache = undefined;
    }
    return this.parsedArgsCache;
  }

  private buildSuffix(
    status: "ok" | "error",
    text: string,
    reason?: string,
    meta?: unknown,
  ): string {
    if (status === "error") {
      const detail = reason || text || "Tool failed";
      return ` [${this.getErrorCode(reason)}] "${safeText(detail).split("\n")[0]}"`;
    }

    const metaObj = meta as ToolMeta | undefined;
    const toolName = this.getToolName();
    let suffix = "";

    try {
      switch (toolName) {
        case "read": {
          const m = metaObj as ReadMeta | undefined;
          if (
            m &&
            typeof m.totalLines === "number" &&
            m.offset !== undefined &&
            m.lines &&
            Array.isArray(m.lines)
          ) {
            const end = m.offset + m.lines.length - 1;
            suffix += ` ${m.offset}-${end}/${m.totalLines}`;
          }
          const truncated =
            m?.truncated === true ||
            (m &&
              typeof m.totalLines === "number" &&
              m.lines &&
              Array.isArray(m.lines) &&
              m.lines.length < m.totalLines);
          if (truncated) {
            suffix += ` ${fg.warning("[trunc]")}`;
          }
          if (typeof text === "string" && text.length > 0) {
            suffix += ` ${formatBytes(text.length)}`;
          }
          break;
        }
        case "write": {
          const m = metaObj as WriteMeta | undefined;
          const op = m?.operation === "create" ? "CREATE" : "UPDATE";
          suffix += ` [${op}]`;
          if (typeof text === "string") {
            suffix += ` ${formatBytes(text.length)}`;
          }
          break;
        }
        case "edit": {
          const args = this.getParsedArgs();
          const m = metaObj as EditMeta | undefined;
          const count = m?.diffs && Array.isArray(m.diffs) ? m.diffs.length : 1;
          const mode = args?.replace_all === true ? "all" : `1/${count}`;
          const added =
            m?.diffs?.reduce(
              (sum: number, d: any) =>
                sum + (d.newText?.split("\n").length || 0) - (d.oldText?.split("\n").length || 0),
              0,
            ) || 0;
          const removed =
            m?.diffs?.reduce(
              (sum: number, d: any) =>
                sum + (d.oldText?.split("\n").length || 0) - (d.newText?.split("\n").length || 0),
              0,
            ) || 0;
          suffix += ` ${mode}`;
          if (added || removed) suffix += ` +${added}/-${removed}`;
          break;
        }
        case "grep": {
          const m = metaObj as GrepMeta | undefined;
          const matches = m?.items
            ? m.items.reduce(
                (sum: number, f: any) =>
                  sum + (typeof f.lines === "string" ? 1 : f.lines?.length || 0),
                0,
              )
            : 0;
          const files = m?.items?.length || 0;
          suffix += ` ${matches}/${files}`;
          // First match preview
          if (m?.items?.[0]) {
            const first = m.items[0];
            const lineText = typeof first.lines === "string" ? first.lines : first.lines?.[0];
            if (lineText) {
              suffix += ` L${first.lineNumber}:${lineText.slice(0, 40)}`;
            }
          }
          if (m?.truncated) suffix += ` ${fg.warning("[trunc]")}`;
          break;
        }
        case "glob":
        case "find": {
          const m = metaObj as GlobFindMeta | undefined;
          const count = m?.matches?.length || 0;
          suffix += ` ${count}`;
          break;
        }
        case "ls": {
          const m = metaObj as LsMeta | undefined;
          const dirs = m?.dirs?.length || 0;
          const files = m?.files?.length || 0;
          suffix += ` ${dirs}D/${files}F`;
          break;
        }
        case "bash": {
          const m = metaObj as BashMeta | undefined;
          const exitCode = m?.exitCode ?? 0;
          suffix += ` [${exitCode}]`;
          if (typeof text === "string" && text.length > 0) {
            const firstLine = text.trim().split("\n")[0].slice(0, 50);
            suffix += ` L1:"${firstLine}"`;
          }
          break;
        }
      }
    } catch {
      // Fallback: show first line of result
      if (text) {
        const firstLine = text.trim().split("\n")[0].slice(0, 50);
        suffix += ` "${firstLine}"`;
      }
    }

    return suffix;
  }

  private getErrorCode(reason?: string): string {
    if (!reason) return "ERROR";
    const r = reason.toLowerCase();
    if (r.includes("enoent") || r.includes("not found")) return "ENOENT";
    if (r.includes("permission")) return "EACCES";
    if (r.includes("stale") || r.includes("version")) return "STALE";
    if (r.includes("not_found") || r.includes("old_string")) return "NOT_FOUND";
    if (r.includes("timeout")) return "TIMEOUT";
    if (r.includes("permission") || r.includes("denied")) return "DENIED";
    return "ERROR";
  }

  /** Apply a partial/streaming result update without finalizing the row. */
  updateResult(text: string) {
    this.resultText = text;
    this.touch();
  }

  /** Mark tool as running (for long-running tools like bash) */
  setRunning(): void {
    if (this.state === "calling") {
      this.state = "running";
      this.touch();
    }
  }

  toggle() {
    if (!this.hasDetails) return false;
    this.expanded = !this.expanded;
    this.touch();
    return true;
  }

  /** Collapsed rows hint that details are one click away. */
  private hint() {
    return this.hasDetails ? ` ${keyHint("app.tools.expand", "details")}` : "";
  }

  handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
    if (event.button !== "left" || event.y !== 0 || !this.hasDetails) return undefined;
    if (event.type === "press") return { handled: true, capture: true };
    if (event.type === "click") {
      this.toggle();
      return { handled: true, render: true };
    }
    if (event.type === "release") return { handled: true };
    return undefined;
  }

  invalidate() {
    this.cachedLines = undefined;
    this.cachedRevision = -1;
    this.cachedWidth = -1;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width && this.cachedRevision === this.revision)
      return this.cachedLines;

    const toolName = this.getToolName();
    const target = this.getTarget();
    const suffix = this.buildCurrentSuffix();
    const elapsed =
      this.state === "running" ? ` · ${((Date.now() - this.startTime) / 1000).toFixed(1)}s` : "";

    const rest = ` ${toolName} ${target}`;
    const suffixPart = suffix ? ` ${suffix}` : "";
    const elapsedPart = elapsed ? ` ${elapsed}` : "";
    const line = `  ${this.getColoredIcon()}${dim(`${rest}${suffixPart}${elapsedPart}`)}`;

    const lines = [truncateToWidth(line, Math.max(1, width))];

    if (this.expanded && this.hasDetails) {
      lines.push(
        ...toolDetails(this.argumentsText, this.resultText, this.resultMeta, Math.max(1, width)),
      );
    }

    this.cachedWidth = width;
    this.cachedRevision = this.revision;
    this.cachedLines = lines;
    return lines;
  }

  private buildCurrentSuffix(): string {
    if (this.state === "calling") return "";
    if (this.state === "running") return "";
    if (!this.resultText && !this.resultMeta) return "";

    // Reuse the finish logic but without status icon
    const fakeStatus = this.state === "error" ? "error" : "ok";
    const suffixKey = `${this.state}:${this.resultText}:${JSON.stringify(this.resultMeta)}`;
    if (this.cachedSuffixKey === suffixKey && this.cachedSuffix !== undefined) {
      return this.cachedSuffix;
    }
    this.cachedSuffixKey = suffixKey;
    this.cachedSuffix = this.buildSuffix(
      fakeStatus,
      this.resultText || "",
      undefined,
      this.resultMeta,
    );
    return this.cachedSuffix;
  }

  private getColoredIcon(): string {
    if (this.cachedIconState === this.state && this.cachedColoredIcon !== undefined) {
      return this.cachedColoredIcon;
    }
    this.cachedIconState = this.state;
    switch (this.state) {
      case "success":
        this.cachedColoredIcon = success("✓");
        break;
      case "error":
        this.cachedColoredIcon = error("✗");
        break;
      case "truncated":
        this.cachedColoredIcon = fg.warning("⚠");
        break;
      case "running":
        this.cachedColoredIcon = fg.warning("⟳");
        break;
      case "calling":
        this.cachedColoredIcon = fg.warning("⟳");
        break;
    }
    return this.cachedColoredIcon;
  }
}

export class ToolLog {
  readonly entries = new Map<string, ToolEntry>();
  /**
   * The pending call behind an approval prompt. Approval requests carry only a
   * call ID, and call IDs are unique across the session and its children, so a
   * scan by ID finds the row even when the request comes from a child agent.
   */
  find(callId: string | undefined): ToolRow | undefined {
    if (!callId) return undefined;
    for (const entry of this.entries.values())
      if (entry.callId === callId && entry.row instanceof ToolRow) return entry.row;
    return undefined;
  }
  /** Like `find`, but also returns bash tool rows (BashExecutionComponent). */
  findAny(callId: string | undefined): ToolRow | BashExecutionComponent | undefined {
    if (!callId) return undefined;
    for (const entry of this.entries.values()) if (entry.callId === callId) return entry.row;
    return undefined;
  }
  update(callId: string, text: string): ToolRow | undefined {
    const row = this.find(callId);
    row?.updateResult(text);
    return row;
  }

  record(output: ToolOutput, tui?: TuiHost): ToolRow | BashExecutionComponent | undefined {
    const key = JSON.stringify([output.sessionId, output.callId]);
    let entry = this.entries.get(key);
    const created = !entry;
    const isBash = output.kind === "tool" && output.name === "bash";
    if (!entry) {
      const preview = output.kind === "tool" ? target(output.text) : "";
      const label =
        output.kind === "tool" ? `${safeText(output.name)}${preview ? ` ${preview}` : ""}` : "tool";
      if (isBash && tui) {
        // Create BashExecutionComponent for bash tool calls
        const excludeFromContext = false; // Could be detected from arguments if needed
        const command = target(output.text); // extract command from JSON args
        const bashComponent = new BashExecutionComponent(command, tui, excludeFromContext);
        entry = {
          row: bashComponent,
          callId: output.callId,
          label,
          isBash: true,
          tui,
        };
      } else {
        entry = {
          row: new ToolRow(`· ${label}`),
          callId: output.callId,
          label,
          isBash: false,
        };
      }
      this.entries.set(key, entry);
    }
    if (output.kind === "tool") {
      if (entry.row instanceof ToolRow) {
        entry.row.setCall(output.text);
      }
    } else {
      if (entry.row instanceof BashExecutionComponent) {
        const isError = output.kind === "error";
        entry.row.setComplete(isError ? 1 : 0, false, undefined, undefined);
        this.entries.delete(key);
      } else if (entry.row instanceof ToolRow) {
        entry.row.finish(
          output.kind === "error" ? "error" : "ok",
          output.text,
          output.reason,
          output.meta,
          output.durationMs,
        );
        this.entries.delete(key);
      }
    }
    return created ? entry.row : undefined;
  }

  /** Update a bash tool's streaming output */
  updateBashOutput(callId: string, chunk: string): void {
    for (const entry of this.entries.values()) {
      if (entry.callId === callId && entry.isBash) {
        (entry.row as BashExecutionComponent).appendOutput(chunk);
        break;
      }
    }
  }
}
