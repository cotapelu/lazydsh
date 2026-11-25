import {
  truncateToWidth,
  type Component,
  type TuiMouseEvent,
  type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { activityLine } from "./presentation.ts";
import { safeText } from "./theme.ts";
import { toolDetails } from "./detail.ts";
import { keyHint } from "./keybinding-hints.ts";
import type { ToolOutput } from "../runtime-events.ts";
import { BashExecutionComponent } from "./bash-execution.ts";
import type { TuiHost } from "../interfaces.ts";

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
  const match = /^([·✓✗])\s+([\s\S]*)$/.exec(summary);
  const body = match?.[2] ?? summary;
  const suffixAt = body.indexOf(" — ");
  return suffixAt >= 0 ? body.slice(0, suffixAt) : body;
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
  finish(status: "ok" | "error", text: string, reason?: string, meta?: unknown) {
    this.resultText = text;
    this.resultMeta = meta;
    const detail = reason || text || "Tool failed";
    const suffix = status === "error" ? ` — ${safeText(detail).split("\n")[0]}` : "";
    this.setSummary(`${status === "error" ? "✗" : "✓"} ${this.label}${suffix}`);
    this.touch();
  }
  /** Apply a partial/streaming result update without finalizing the row. */
  updateResult(text: string) {
    this.resultText = text;
    this.touch();
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
    const lines = [
      truncateToWidth(
        `  ${activityLine(this.value)}${this.expanded ? "" : this.hint()}`,
        Math.max(1, width),
      ),
    ];
    if (this.expanded && this.hasDetails)
      lines.push(
        ...toolDetails(this.argumentsText, this.resultText, this.resultMeta, Math.max(1, width)),
      );
    this.cachedWidth = width;
    this.cachedRevision = this.revision;
    this.cachedLines = lines;
    return lines;
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
        const bashComponent = new BashExecutionComponent(output.text, tui, excludeFromContext);
        entry = { row: bashComponent, callId: output.callId, label, isBash: true, tui };
      } else {
        entry = { row: new ToolRow(`· ${label}`), callId: output.callId, label, isBash: false };
      }
      this.entries.set(key, entry);
    }
    if (output.kind === "tool") {
      if (entry.isBash) {
        // For bash tools, the command is already set in constructor
      } else {
        entry.row.setCall(output.text);
      }
    } else {
      if (entry.isBash) {
        const isError = output.kind === "error";
        (entry.row as BashExecutionComponent).setComplete(
          isError ? 1 : 0,
          false,
          undefined,
          undefined,
        );
        this.entries.delete(key);
      } else {
        entry.row.finish(
          output.kind === "error" ? "error" : "ok",
          output.text,
          output.reason,
          output.meta,
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
