/**
 * User Message Component
 *
 * Renders one user message as markdown inside a `Box` card. The box owns the
 * horizontal inset and the card background, so the markdown inside keeps its
 * own text styling. Ported from pi-coding-agent's UserMessageComponent.
 */

import { Box, Container, Markdown } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform, type MarkdownTransformers } from "./markdown-transform.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/** Horizontal inset of the card, so a message reads as a block, not a wall of text. */
const MESSAGE_PADDING_X = 2;
/** `Box` adds this many rows above and below the content. */
const MESSAGE_PADDING_Y = 1;

export class UserMessageComponent extends Box {
  private text: string;
  private markdownTheme: ReturnType<typeof getMarkdownTheme>;
  private outputPad: number;
  private markdownTransformers: MarkdownTransformers;
  private messageId: string | undefined;
  private timestamp: number | undefined;
  private readonly content: Container;

  constructor(
    text: string,
    markdownTheme = getMarkdownTheme(),
    outputPad = 1,
    markdownTransformers: MarkdownTransformers = [],
    messageId?: string,
    timestamp?: number,
  ) {
    super(MESSAGE_PADDING_X, MESSAGE_PADDING_Y, (t) => theme.bg("userMessageBg", t));
    this.text = text;
    this.markdownTheme = markdownTheme;
    this.outputPad = outputPad;
    this.markdownTransformers = markdownTransformers;
    this.messageId = messageId;
    this.timestamp = timestamp;
    // The Box is the card; this container only holds the markdown run so
    // `setText`/`setOutputPad` never clear the box (and lose its padding).
    this.content = new Container();
    this.addChild(this.content);
    this.rebuild();
  }

  setOutputPad(padding: number): void {
    this.outputPad = padding;
    this.rebuild();
  }

  setText(text: string): void {
    this.text = text;
    this.rebuild();
  }

  private rebuild(): void {
    this.content.clear();
    this.content.addChild(
      new Markdown(
        this.text,
        this.outputPad,
        0,
        this.markdownTheme,
        {
          color: (content: string) => theme.fg("userMessageText", content),
          bgColor: (content: string) => theme.bg("userMessageBg", content),
        },
        {
          preserveOrderedListMarkers: true,
          preserveBackslashEscapes: true,
          transform: createMarkdownTransform(
            "user",
            () => false,
            this.markdownTransformers,
            this.messageId,
            this.timestamp,
          ),
        },
      ),
    );
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;
    // The Box pads above and below the content: mark the first and last content
    // row so a shell's semantic-zone parsing is not broken by an empty pad row.
    const first = Math.min(MESSAGE_PADDING_Y, lines.length - 1);
    const last = Math.max(lines.length - 1 - MESSAGE_PADDING_Y, first);
    lines[first] = OSC133_ZONE_START + lines[first];
    lines[last] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[last];
    return lines;
  }
}
