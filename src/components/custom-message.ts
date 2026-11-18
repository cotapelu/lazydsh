/**
 * Custom Message Component
 *
 * Renders a custom message entry from extensions. Uses distinct styling to
 * differentiate from user messages. Supports an optional custom renderer that
 * handles its own styling; falls back to the default labeled markdown box.
 * Ported from pi-coding-agent's `custom-message.js`.
 */

import { Box, Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";
import { keyHint, keyText } from "../keybinding-hints.js";
import { createMarkdownTransform } from "./markdown-transform.js";

export interface CustomMessage {
  customType: string;
  content: string | Array<{ type: string; text?: string }>;
}

type CustomRenderer = (
  message: CustomMessage,
  options: {
    expanded: boolean;
    outputPad: number;
    keyText: typeof keyText;
    keyHint: typeof keyHint;
  },
  theme: typeof import("../theme/theme.js").theme,
) => unknown;

/**
 * Component that renders a custom message entry from extensions.
 */
export class CustomMessageComponent extends Container {
  private message: CustomMessage;
  private customRenderer: CustomRenderer | undefined;
  private box: Box;
  private customComponent: unknown;
  private markdownTheme: ReturnType<typeof getMarkdownTheme>;
  private _expanded = false;
  private outputPad: number;
  private markdownTransformers: unknown[];
  private messageId: string | undefined;
  private timestamp: number | undefined;

  constructor(
    message: CustomMessage,
    customRenderer?: CustomRenderer,
    markdownTheme = getMarkdownTheme(),
    outputPad = 1,
    markdownTransformers: unknown[] = [],
    messageId?: string,
    timestamp?: number,
  ) {
    super();
    this.message = message;
    this.customRenderer = customRenderer;
    this.markdownTheme = markdownTheme;
    this.outputPad = outputPad;
    this.markdownTransformers = markdownTransformers;
    this.messageId = messageId;
    this.timestamp = timestamp;
    this.addChild(new Spacer(1));
    // Create box with purple background (used for default rendering)
    this.box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    if (this._expanded !== expanded) {
      this._expanded = expanded;
      this.rebuild();
    }
  }

  setOutputPad(outputPad: number): void {
    if (this.outputPad !== outputPad) {
      this.outputPad = outputPad;
      this.rebuild();
    }
  }

  invalidate(): void {
    super.invalidate();
    this.rebuild();
  }

  private rebuild(): void {
    // Remove previous content component
    if (this.customComponent) {
      this.removeChild(this.customComponent as never);
      this.customComponent = undefined;
    }
    this.removeChild(this.box);

    // Try custom renderer first - it handles its own styling
    if (this.customRenderer) {
      try {
        const component = this.customRenderer(
          this.message,
          { expanded: this._expanded, outputPad: this.outputPad, keyText, keyHint },
          theme,
        );
        if (component) {
          // Custom renderer provides its own styled component
          this.customComponent = component;
          this.addChild(component as never);
          return;
        }
      } catch {
        // Fall through to default rendering
      }
    }

    // Default rendering uses our box
    this.addChild(this.box);
    this.box.clear();
    this.box.setPaddingX(this.outputPad);
    // Default rendering: label + content
    const label = theme.fg("customMessageLabel", `\x1b[1m[${this.message.customType}]\x1b[22m`);
    this.box.addChild(new Text(label, 0, 0));
    this.box.addChild(new Spacer(1));
    // Extract text content
    let text: string;
    if (typeof this.message.content === "string") {
      text = this.message.content;
    } else {
      text = this.message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
    }
    this.box.addChild(
      new Markdown(
        text,
        0,
        0,
        this.markdownTheme,
        { color: (t) => theme.fg("customMessageText", t) },
        {
          transform: createMarkdownTransform(
            "custom",
            () => false,
            this.markdownTransformers as never,
            this.messageId,
            this.timestamp,
          ),
        },
      ),
    );
  }
}
