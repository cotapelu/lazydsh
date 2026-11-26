import { extractAnsiCode } from "@earendil-works/pi-tui/dist/utils.js";
import { stripVTControlCharacters } from "node:util";
import { accent, dim, fg, gray, safeText, formatNotification, success, error } from "./theme.ts";
import { formatStats, type SessionStats } from "../utils/stats.ts";
import {
  Editor,
  Input,
  Text,
  Container,
  truncateToWidth,
  visibleWidth,
  type Component,
} from "@earendil-works/pi-tui";

export function activityLine(summary: string) {
  const icon = summary.slice(0, 1);
  const rest = summary.slice(1);
  const color = icon === "✓" ? success : icon === "✗" ? error : icon === "·" ? accent : accent;
  return color(icon) + dim(rest);
}

// Official deepseek.com SVG silhouette sampled into 2×4 Braille cells (52×44 pixels).
const whale = [
  "    ⣀⣤⣤⣤⣤⣤⣴⣶⣿⠃   ⣸⣧⣀    ⢀⣀",
  " ⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄  ⢸⣿⣿⣷⣴⣶⣶⣿⡏",
  "⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄ ⠙⢿⣿⣿⣿⡿⠋",
  "⣼⣿⠉⠉⠉⠙⠛⠿⣿⣿⣿⣿⣿⡿⠛⢿⣿⣷⣦⣿⣿⡏",
  "⣿⣿⡀     ⠈⠻⣿⣿⣿⣯⣷ ⠙⣿⣿⣿⣿⠃",
  "⠸⣿⣧       ⠈⢻⣿⣿⣿⣷⣶⣿⣿⣿⠏",
  " ⠻⣿⣷⡀   ⢀⣀  ⠙⣿⣿⣿⣿⣿⣿⠋",
  "  ⠙⢿⣿⣶⣄⣀⣈⣿⣷⣦⣀⠈⠻⣿⣿⣿⣧⣄⡀",
  "    ⠙⠻⢿⣿⣿⣿⣿⣿⣿⣿⠷⠊⠉⠛⠛⠋⠁",
  "        ⠈⠉⠉⠉⠁",
];

export class StartupBanner implements Component {
  invalidate() {}
  render(width: number): string[] {
    const toolDescription = "A lazier terminal UI for DeepSeek Harness.";

    if (width < Math.max(64, visibleWidth(toolDescription) + 30))
      return new Text(
        `\n${whale.map((line) => accent(line)).join("\n")}\n\nlazydsh · ${dim(toolDescription)} `,
        0,
        0,
      ).render(width);
    return [
      "",
      ...whale.map((line, index) => {
        const label = index === 2 ? "lazydsh" : index === 3 ? dim(toolDescription) : "";
        return `  ${accent(line.padEnd(28))}${label}`;
      }),
      "",
    ];
  }
}

export class StatusPanel extends Text {
  constructor(stats: SessionStats) {
    super("", 2, 1);
    this.updateStats(stats);
  }
  updateStats(stats: SessionStats) {
    const content = safeText(formatStats(stats))
      .split("\n")
      .map((line: string) =>
        line
          .replace(/^([^:]+: +)/, gray)
          .replace(/\([^)]*\)/g, gray)
          .replace(/░+/g, (cells: string) => fg.borderMuted("█".repeat(cells.length)))
          .replace(/·+/g, gray),
      )
      .join("\n");
    this.setText(content);
  }
}

export class Transcript extends Container {
  override render(width: number): string[] {
    const lines = renderStack(this.children, width);
    const blank = (line: string) => !stripVTControlCharacters(line).trim();
    while (lines.length && blank(lines.at(-1)!)) lines.pop();
    return lines.length ? [...lines, ""] : [];
  }
}

function renderStack(children: readonly Component[], width: number): string[] {
  const lines: string[] = [];
  const blank = (line: string) => !stripVTControlCharacters(line).trim();
  for (const child of children) {
    const next = child.render(width);
    if (!next.length) continue;

    // Drop only this child's leading blank rows when the previous child already
    // ended with one. Never mutate `next`: cached components reuse that array.
    let start = 0;
    if (lines.length && blank(lines.at(-1)!)) {
      while (start < next.length && blank(next[start])) start++;
    }
    for (let index = start; index < next.length; index++) lines.push(next[index]);
  }
  return lines;
}

// Pending prompts wait below the transcript until the running turn finishes.
export class QueueView extends Container {
  override render(width: number): string[] {
    const lines = renderStack(this.children, width);
    const blank = (line: string) => !stripVTControlCharacters(line).trim();
    while (lines.length && blank(lines[0])) lines.shift();
    while (lines.length && blank(lines.at(-1)!)) lines.pop();
    return lines.length ? [...lines, ""] : [];
  }
}

export class Notification extends Text {
  constructor(label: string, text: unknown = "") {
    super(formatNotification(label, safeText(text)), 2, 1);
  }
}

function highlightReferences(text: string) {
  const parts: string[] = [];
  let start = 0;
  for (let index = text.indexOf("\x1b"); index >= 0; index = text.indexOf("\x1b", index + 1)) {
    const sequence = extractAnsiCode(text, index);
    if (!sequence) continue;
    parts.push(text.slice(start, index), sequence.code);
    start = index + sequence.length;
    index = start - 1;
  }
  parts.push(text.slice(start));
  const plain = parts.filter((_, index) => index % 2 === 0).join("");
  const ranges = [
    ...plain.matchAll(
      /(?<!\S)(?:@"[^"\n]*(?:"|$)|@[^\s"]+|"(?:\/|\.\.?\/)[^"\n]*"|'(?:\/|\.\.?\/)[^'\n]*'|(?:file:\/\/|\/|\.\.?\/|[A-Za-z]:[\\/])[^\s]+|\[paste #\d+(?: (?:\+\d+ lines|\d+ chars))?\])/g,
    ),
  ];
  if (!ranges.length) return text;
  let offset = 0;
  return parts
    .map((part, index) => {
      if (index % 2) return part;
      const start = offset;
      offset += part.length;
      let result = "";
      let cursor = 0;
      for (const match of ranges) {
        const from = Math.max(0, match.index - start);
        const to = Math.min(part.length, match.index + match[0].length - start);
        if (from >= to) continue;
        result += part.slice(cursor, from) + accent(part.slice(from, to));
        cursor = to;
      }
      return result + part.slice(cursor);
    })
    .join("");
}

export class SentMessage implements Component {
  private readonly content: Text;
  private readonly command: boolean;
  private readonly queued: boolean;
  private cachedWidth = -1;
  private cachedLines?: string[];
  constructor(text: string, options: { queued?: boolean } = {}) {
    this.command = /^\/\S/.test(text.trimStart());
    this.queued = options.queued === true;
    const value = safeText(text);
    this.content = new Text(
      this.queued ? gray(value) : this.command ? accent(value) : highlightReferences(value),
      0,
      0,
    );
  }
  invalidate() {
    this.content.invalidate();
    this.cachedWidth = -1;
    this.cachedLines = undefined;
  }
  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    const rail = this.queued ? gray : accent;
    const prefix = this.command
      ? width >= 3
        ? "  "
        : ""
      : width >= 4
        ? `  ${rail("┃")} `
        : width >= 2
          ? rail("┃")
          : "";
    const lines = [
      "",
      ...this.content
        .render(Math.max(1, width - visibleWidth(prefix)))
        .map((line) => truncateToWidth(prefix + line, width)),
      "",
    ];
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }
}

export class QueuedMessage extends SentMessage {
  constructor(text: string) {
    super(text, { queued: true });
  }
}

// Mark only the Editor's own borders; input and autocomplete rows keep their original rendering.
export const editorBorder = (line: string) => `\0border:${line}`;

export class PromptEditor extends Editor {
  override render(width: number): string[] {
    // pi Editor needs room for a wide glyph plus its cursor; keep drafts intact on tiny resizes.
    if (width < 8) return ["…"];
    const prefix = `  ${accent("┃")} `;
    const lines: string[] = [];
    let content = false;
    for (const line of super.render(Math.max(1, width - visibleWidth(prefix)))) {
      if (line.startsWith("\0border:")) content = !content;
      else lines.push(prefix + (content ? highlightReferences(line) : line));
    }
    return lines;
  }
}

export class SecretInput extends Input {
  override render(width: number): string[] {
    const masked = new Input({ prompt: accent("┃ ") });
    masked.setValue("•".repeat(this.getValue().length));
    masked.focused = this.focused;
    return masked.render(width);
  }
}
