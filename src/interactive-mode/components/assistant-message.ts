/**
 * Assistant Message Component
 *
 * Renders a completed assistant message: markdown text, thinking blocks that
 * toggle on click, and the stop reason (length / aborted / error). Ported from
 * pi-coding-agent's AssistantMessageComponent.
 */

import { Container, Markdown, MouseRegion, Spacer, Text } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

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

export class AssistantMessageComponent extends Container {
  private contentContainer: Container;
  private hideThinkingBlock: boolean;
  private markdownTheme: ReturnType<typeof getMarkdownTheme>;
  private hiddenThinkingLabel: string;
  private outputPad: number;
  private lastMessage: AssistantMessage | undefined;
  private hasToolCalls = false;
  private isStreaming = false;
  private markdownTransformers: any[];
  private messageId: string | undefined;
  private timestamp: number | undefined;
  private thinkingVisibilityOverrides = new Map<number, boolean>();
  private markdownSlots: MarkdownSlot[] = [];

  constructor(
    message: AssistantMessage | undefined,
    hideThinkingBlock = false,
    markdownTheme = getMarkdownTheme(),
    hiddenThinkingLabel = "Thinking...",
    outputPad = 1,
    markdownTransformers: any[] = [],
    messageId?: string,
    timestamp?: number,
  ) {
    super();
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

  render(width: number): string[] {
    const lines = super.render(width);
    if (this.hasToolCalls || lines.length === 0) return lines;
    lines[0] = OSC133_ZONE_START + lines[0];
    lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
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
    const addVisibleChild = (child: Markdown | Text | MouseRegion): void => {
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
              new Markdown(text, this.outputPad, 0, this.markdownTheme, undefined, {
                transform: createMarkdownTransform(
                  "assistant",
                  () => this.isStreaming,
                  this.markdownTransformers,
                  this.messageId,
                  this.timestamp,
                ),
              }),
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
        const component = hidden
          ? new Text(
              theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)),
              this.outputPad,
              0,
            )
          : markdownBlock(
              "thinking",
              thinking,
              () =>
                new Markdown(
                  thinking,
                  this.outputPad,
                  0,
                  this.markdownTheme,
                  {
                    color: (text: string) => theme.fg("thinkingText", text),
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
            );
        addVisibleChild(
          new MouseRegion(component, (event) => {
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
