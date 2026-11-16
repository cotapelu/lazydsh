import {
  SelectList,
  Text,
  matchesKey,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui";
import { selectionTheme } from "./picker.ts";
import { keyHint } from "./keybinding-hints.ts";
import { accent, dim, safeText } from "./theme.ts";

export type ApprovalChoice = "allowed-once" | "rejected";

export type ApprovalDetails = {
  toolName: string;
  reason?: string;
};

const options: { value: ApprovalChoice; label: string; description: string }[] = [
  {
    value: "allowed-once",
    label: "Allow once",
    description: "Run only this time",
  },
  { value: "rejected", label: "Reject", description: "Skip this tool call" },
];

export class ApprovalPanel implements Component {
  readonly capturesViewportInput = true;
  onSelect?: (choice: ApprovalChoice) => void;
  onCancel?: () => void;
  private readonly toolName: string;
  private readonly reason?: string;
  private index = 0;

  constructor(details: ApprovalDetails) {
    this.toolName = safeText(details.toolName).trim() || "unknown tool";
    const reason = details.reason === undefined ? "" : safeText(details.reason).trim();
    this.reason = reason || undefined;
  }

  invalidate() {}
  private choose(index = this.index) {
    const option = options[index];
    if (option) this.onSelect?.(option.value);
  }
  handleInput(data: string) {
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      this.index =
        (this.index + (matchesKey(data, "up") ? -1 : 1) + options.length) % options.length;
      return;
    }
    if (matchesKey(data, "enter")) {
      this.choose();
      return;
    }
    if (matchesKey(data, "escape")) {
      this.onCancel?.();
      return;
    }
    if (/^[1-9]$/.test(data)) {
      this.choose(Number(data) - 1);
      return;
    }
    if (/^y$/i.test(data) || /^a$/i.test(data)) this.choose(0);
    else if (/^n$/i.test(data) || /^r$/i.test(data)) this.choose(1);
  }
  render(width: number): string[] {
    const text = (value: string) => new Text(value, 2, 0).render(width);
    const list = new SelectList(
      options.map((option, index) => ({
        value: option.value,
        label: `${index + 1}) ${option.label}`,
        description: option.description,
      })),
      options.length,
      selectionTheme,
    );
    list.setSelectedIndex(this.index);
    const lines = [
      ...text(dim("Approval required")),
      "",
      ...text(`Allow ${accent(this.toolName)} to run?`),
    ];
    if (this.reason) lines.push(...text(dim(this.reason)));
    lines.push(
      "",
      ...list.render(Math.max(1, width - 4)).map((line) => truncateToWidth("  " + line, width)),
      "",
      ...text(
        dim(
          `${keyHint("tui.select.down", "move")} · 1–2 choose · ${keyHint("tui.select.confirm", "select")} · ${keyHint("tui.select.cancel", "cancel")}`,
        ),
      ),
    );
    return lines;
  }
}
