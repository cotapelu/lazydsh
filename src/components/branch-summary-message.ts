/**
 * Branch Summary Message Component
 *
 * Renders a branch summary with a collapsed/expanded state. Uses the same
 * background color as custom messages for visual consistency.
 * Ported from pi-coding-agent's `branch-summary-message.js`.
 */

import { Box, Container, Markdown, MouseRegion, Spacer, Text } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";
import { keyText } from "../keybinding-hints.js";
import { createMarkdownTransform } from "./markdown-transform.js";

export interface BranchSummaryMessage {
  summary: string;
}

/**
 * Component that renders a branch summary message with collapsed/expanded state.
 */
export class BranchSummaryMessageComponent extends Box {
  private expanded = false;
  private message: BranchSummaryMessage;
  private markdownTheme: ReturnType<typeof getMarkdownTheme>;
  private markdownTransformers: unknown[];
  private messageId: string | undefined;
  private timestamp: number | undefined;

  constructor(
    message: BranchSummaryMessage,
    markdownTheme = getMarkdownTheme(),
    outputPad = 1,
    markdownTransformers: unknown[] = [],
    messageId?: string,
    timestamp?: number,
  ) {
    super(outputPad, 1, (t) => theme.bg("customMessageBg", t));
    this.message = message;
    this.markdownTheme = markdownTheme;
    this.markdownTransformers = markdownTransformers;
    this.messageId = messageId;
    this.timestamp = timestamp;
    this.updateDisplay();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.updateDisplay();
  }

  setOutputPad(outputPad: number): void {
    this.setPaddingX(outputPad);
  }

  invalidate(): void {
    super.invalidate();
    this.updateDisplay();
  }

  private updateDisplay(): void {
    this.clear();
    const content = new Container();
    const label = theme.fg("customMessageLabel", `\x1b[1m[branch]\x1b[22m`);
    content.addChild(new Text(label, 0, 0));
    content.addChild(new Spacer(1));
    if (this.expanded) {
      const header = "**Branch Summary**\n\n";
      const transform = createMarkdownTransform(
        "summary",
        () => false,
        this.markdownTransformers as never,
        this.messageId,
        this.timestamp,
      );
      content.addChild(
        new Markdown(
          this.message.summary,
          0,
          0,
          this.markdownTheme,
          { color: (text) => theme.fg("customMessageText", text) },
          // Transformers see only the summary content, not the header.
          { transform: (markdown, width) => header + transform(markdown, width) },
        ),
      );
    } else {
      content.addChild(
        new Text(
          theme.fg("customMessageText", "Branch summary (") +
            theme.fg("dim", keyText("app.tools.expand")) +
            theme.fg("customMessageText", " to expand)"),
          0,
          0,
        ),
      );
    }
    this.addChild(
      new MouseRegion(content, (event) => {
        if (event.type !== "click" || event.button !== "left") return undefined;
        this.setExpanded(!this.expanded);
        return { handled: true };
      }),
    );
  }
}
