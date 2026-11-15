import { truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { activityLine } from "./presentation.ts";
import { safeText } from "./theme.ts";
import type { eventText } from "./runtime-events.ts";

type ToolOutput = Exclude<NonNullable<ReturnType<typeof eventText>>, { kind: "assistant" }>;
interface ToolEntry {
  row: ToolRow;
  label: string;
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

export class ToolRow implements Component {
  private value: string;
  private cachedWidth = -1;
  private cachedLines?: string[];
  constructor(summary: string) {
    this.value = summary;
  }
  get summary() {
    return this.value;
  }
  setSummary(summary: string) {
    if (summary === this.value) return;
    this.value = summary;
    this.invalidate();
  }
  invalidate() {
    this.cachedWidth = -1;
    this.cachedLines = undefined;
  }
  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    const lines = [truncateToWidth(`  ${activityLine(this.value)}`, width)];
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }
}

export class ToolLog {
  readonly entries = new Map<string, ToolEntry>();
  record(output: ToolOutput): ToolRow | undefined {
    const key = JSON.stringify([output.sessionId, output.callId]);
    let entry = this.entries.get(key);
    const created = !entry;
    if (!entry) {
      const preview = output.kind === "tool" ? target(output.text) : "";
      const label =
        output.kind === "tool" ? `${safeText(output.name)}${preview ? ` ${preview}` : ""}` : "tool";
      entry = { row: new ToolRow(`· ${label}`), label };
      this.entries.set(key, entry);
    }
    if (output.kind !== "tool") {
      const suffix =
        output.kind === "error"
          ? ` — ${safeText(output.reason || output.text || "Tool failed").split("\n")[0]}`
          : "";
      entry.row.setSummary(`${output.kind === "error" ? "✗" : "✓"} ${entry.label}${suffix}`);
      this.entries.delete(key);
    }
    return created ? entry.row : undefined;
  }
}
