import { truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { activityLine } from "./presentation.ts";
import { safeText } from "./theme.ts";
import type { eventText } from "./runtime.ts";

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
  summary: string;
  constructor(summary: string) {
    this.summary = summary;
  }
  invalidate() {}
  render(width: number): string[] {
    return [truncateToWidth(`  ${activityLine(this.summary)}`, width)];
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
      entry.row.summary = `${output.kind === "error" ? "✗" : "✓"} ${entry.label}${suffix}`;
      this.entries.delete(key);
    }
    return created ? entry.row : undefined;
  }
}
