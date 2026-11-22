/**
 * User Message Component
 *
 * Renders one user message as markdown on the user-message background.
 * Ported from pi-coding-agent's UserMessageComponent.
 */

import { Container, Markdown } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform, type MarkdownTransformers } from "./markdown-transform.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

export class UserMessageComponent extends Container {
  private text: string;
  private markdownTheme: ReturnType<typeof getMarkdownTheme>;
  private outputPad: number;
  private markdownTransformers: MarkdownTransformers;
  private messageId: string | undefined;
  private timestamp: number | undefined;

  constructor(
    text: string,
    markdownTheme = getMarkdownTheme(),
    outputPad = 1,
    markdownTransformers: MarkdownTransformers = [],
    messageId?: string,
    timestamp?: number,
  ) {
    super();
    this.text = text;
    this.markdownTheme = markdownTheme;
    this.outputPad = outputPad;
    this.markdownTransformers = markdownTransformers;
    this.messageId = messageId;
    this.timestamp = timestamp;
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
    this.clear();
    // The Markdown pads and colors its own background: a Box around it would
    // keep a second full-width copy of every line for identical output.
    this.addChild(
      new Markdown(
        this.text,
        this.outputPad,
        1,
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
    lines[0] = OSC133_ZONE_START + lines[0];
    lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
    return lines;
  }
}
