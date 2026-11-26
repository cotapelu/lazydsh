/**
 * Assistant Message Component
 *
 * Renders a completed assistant message: markdown text, thinking blocks that
 * toggle on click, and the stop reason (length / aborted / error). Ported from
 * pi-coding-agent's AssistantMessageComponent.
 *
 * The message rides in a `Box` so padding and the card background are applied
 * once around the whole message instead of being repeated by every markdown
 * run inside it.
 */

import {
  Box,
  Container,
  Markdown,
  MouseRegion,
  type Component,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme, dim } from "../theme/theme.ts";
import { createMarkdownTransform, type MarkdownTransformers } from "./markdown-transform.ts";
import { createIncrementalHighlightCode } from "../stream-highlight.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/** Horizontal inset of the card, so a message reads as a block, not a wall of text. */
const MESSAGE_PADDING_X = 2;
/** `Box` adds this many rows above and below the content. */
const MESSAGE_PADDING_Y = 1;

interface MessageContent {
  type: "text" | "thinking" | "toolCall";
  text?: string;
  thinking?: string;
}

interface AssistantMessage {
  content: MessageContent[];
  stopReason?: "length" | "aborted" | "error";
  errorMessage?: string;
  messageId?: string;
  timestamp?: number;
}

/** One markdown slot per content run, so a streaming update reuses instances. */
interface MarkdownSlot {
  kind: "text" | "thinking";
  markdown: Markdown;
}

/**
 * A reasoning region.
 *
 * The reasoning is the model's inner monologue, not the answer, so it is
 * recessed: a label naming the run, faint italic text, and a colour a shade
 * below the answer's. It deliberately has no background of its own — `Box`
 * only pads to the width it is given, so a nested zone inside the message card
 * would either wrap short of the card or overflow it, and neither reads as a
 * clean region. The card background is the only plane.
 */
class ThinkingBoundary extends Container {
  constructor(children: readonly Component[]) {
    super();
    for (const child of children) this.addChild(child);
  }
}

export class AssistantMessageComponent extends Box {
  private contentContainer: Container;
  private hideThinkingBlock: boolean;
  private markdownTheme: ReturnType<typeof getMarkdownTheme>;
  private hiddenThinkingLabel: string;
  private outputPad: number;
  private lastMessage: AssistantMessage | undefined;
  private hasToolCalls = false;
  private isStreaming = false;
  private markdownTransformers: MarkdownTransformers;
  private messageId: string | undefined;
  private timestamp: number | undefined;
  private thinkingVisibilityOverrides = new Map<number, boolean>();
  private markdownSlots: MarkdownSlot[] = [];
  /** One incremental highlighter per message so streaming code blocks don't re-tokenize from scratch. */
  private readonly incrementalHighlightCode = createIncrementalHighlightCode();

  constructor(
    message: AssistantMessage | undefined,
    hideThinkingBlock = false,
    markdownTheme = getMarkdownTheme(),
    hiddenThinkingLabel = "✻ Thought",
    outputPad = 1,
    markdownTransformers: MarkdownTransformers = [],
    messageId?: string,
    timestamp?: number,
  ) {
    super(MESSAGE_PADDING_X, MESSAGE_PADDING_Y, (t) => theme.bg("assistantMessageBg", t));
    this.hideThinkingBlock = hideThinkingBlock;
    this.markdownTheme = markdownTheme;
    this.hiddenThinkingLabel = hiddenThinkingLabel;
    this.outputPad = outputPad;
    this.markdownTransformers = markdownTransformers;
    this.messageId = messageId;
    this.timestamp = timestamp;
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);
    if (message !== undefined) this.updateContent(message);
  }

  invalidate(): void {
    super.invalidate();
    if (this.lastMessage !== undefined) this.updateContent(this.lastMessage);
  }

  setHideThinkingBlock(hide: boolean): void {
    this.hideThinkingBlock = hide;
    this.thinkingVisibilityOverrides.clear();
    if (this.lastMessage !== undefined) this.updateContent(this.lastMessage);
  }

  setHiddenThinkingLabel(label: string): void {
    this.hiddenThinkingLabel = label;
    if (this.lastMessage !== undefined) this.updateContent(this.lastMessage);
  }

  setOutputPad(padding: number): void {
    this.outputPad = padding;
    this.markdownSlots = [];
    if (this.lastMessage !== undefined) this.updateContent(this.lastMessage);
  }

  /** Theme variant whose `highlightCode` reuses the incremental highlighter, so streaming code blocks only re-tokenize their unstable tail. */
  private markdownThemeWithIncrementalHighlight(): ReturnType<typeof getMarkdownTheme> & {
    highlightCode?: (code: string, lang?: string) => string[];
  } {
    return {
      ...this.markdownTheme,
      highlightCode: (code: string, language?: string) =>
        this.incrementalHighlightCode.highlight(code, language),
    };
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (this.hasToolCalls || lines.length === 0) return lines;
    // The Box pads above and below the content: mark the first and last content
    // row so a shell's semantic-zone parsing is not broken by an empty pad row.
    const first = Math.min(MESSAGE_PADDING_Y, lines.length - 1);
    const last = Math.max(lines.length - 1 - MESSAGE_PADDING_Y, first);
    lines[first] = OSC133_ZONE_START + lines[first];
    lines[last] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[last];
    return lines;
  }

  updateContent(message: AssistantMessage, isStreaming = this.isStreaming): void {
    this.lastMessage = message;
    this.isStreaming = isStreaming;
    this.contentContainer.clear();
    const previousSlots = this.markdownSlots;
    this.markdownSlots = [];

    const markdownBlock = (
      kind: MarkdownSlot["kind"],
      text: string,
      create: () => Markdown,
    ): Markdown => {
      const slot = previousSlots[this.markdownSlots.length];
      const markdown = slot?.kind === kind ? slot.markdown : create();
      markdown.setText(text);
      this.markdownSlots.push({ kind, markdown });
      return markdown;
    };

    // Spacers are added lazily, right before the next visible content block.
    let needsSpacer = true;
    const addVisibleChild = (child: Component): void => {
      if (needsSpacer) {
        this.contentContainer.addChild(new Spacer(1));
        needsSpacer = false;
      }
      this.contentContainer.addChild(child);
    };

    let thinkingRunIndex = 0;
    for (let index = 0; index < message.content.length; index++) {
      const content = message.content[index];
      if (content.type === "text" && content.text?.trim()) {
        const text = content.text.trim();
        addVisibleChild(
          markdownBlock(
            "text",
            text,
            () =>
              new Markdown(
                text,
                this.outputPad,
                0,
                this.markdownThemeWithIncrementalHighlight(),
                undefined,
                {
                  transform: createMarkdownTransform(
                    "assistant",
                    () => this.isStreaming,
                    this.markdownTransformers,
                    this.messageId,
                    this.timestamp,
                  ),
                },
              ),
          ),
        );
      } else if (content.type === "thinking") {
        const thinkingBlocks: string[] = [];
        for (; index < message.content.length; index++) {
          const next = message.content[index];
          if (next.type !== "thinking") break;
          const thinking = next.thinking?.trim();
          if (thinking !== undefined && thinking !== "") thinkingBlocks.push(thinking);
        }
        index--;
        if (thinkingBlocks.length === 0) continue;

        const runIndex = thinkingRunIndex++;
        const hidden = this.thinkingVisibilityOverrides.get(runIndex) ?? this.hideThinkingBlock;
        // A hidden run with an empty label renders nothing at all.
        if (hidden && this.hiddenThinkingLabel.trim() === "") continue;

        const thinking = thinkingBlocks.join("\n\n");
        // The label names the run, and changes with the stream so the user can
        // tell "working through it" from "here is what it worked out". The
        // marker leads the row so the region has a fixed left edge even
        // without a background of its own.
        // When collapsed, show a single recessed label so the user can still
        // click to expand; when expanded the reasoning itself is the indicator.
        const label = hidden
          ? new Text(theme.italic(dim(this.hiddenThinkingLabel)), this.outputPad, 0)
          : null;
        const body = hidden
          ? []
          : [
              markdownBlock(
                "thinking",
                thinking,
                () =>
                  new Markdown(
                    thinking,
                    this.outputPad,
                    0,
                    this.markdownThemeWithIncrementalHighlight(),
                    {
                      color: (text: string) => theme.italic(dim(text)),
                      italic: true,
                    },
                    {
                      transform: createMarkdownTransform(
                        "assistant-thinking",
                        () => this.isStreaming,
                        this.markdownTransformers,
                        this.messageId,
                        this.timestamp,
                      ),
                    },
                  ),
              ),
            ];
        const zone = new ThinkingBoundary([...(label ? [label] : []), ...body]);
        addVisibleChild(
          new MouseRegion(zone, (event) => {
            if (event.type !== "click" || event.button !== "left") return undefined;
            this.thinkingVisibilityOverrides.set(runIndex, !hidden);
            if (this.lastMessage !== undefined) this.updateContent(this.lastMessage);
            return { handled: true };
          }),
        );
        needsSpacer = true;
      }
    }

    this.hasToolCalls = message.content.some((content) => content.type === "toolCall");

    if (message.stopReason === "length") {
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(
        new Text(theme.fg("error", "Response was truncated before completion."), this.outputPad, 0),
      );
    } else if (!this.hasToolCalls) {
      if (message.stopReason === "aborted") {
        const abortMessage =
          message.errorMessage !== undefined && message.errorMessage !== "Request was aborted"
            ? message.errorMessage
            : "Operation aborted";
        this.contentContainer.addChild(new Spacer(1));
        this.contentContainer.addChild(
          new Text(theme.fg("error", abortMessage), this.outputPad, 0),
        );
      } else if (message.stopReason === "error") {
        this.contentContainer.addChild(new Spacer(1));
        this.contentContainer.addChild(
          new Text(
            theme.fg("error", `Error: ${message.errorMessage ?? "Unknown error"}`),
            this.outputPad,
            0,
          ),
        );
      }
    }
  }
}
