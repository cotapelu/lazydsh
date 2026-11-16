/**
 * Tool Execution Component
 *
 * One DSH tool call rendered as an expandable card: the pending state comes
 * from the tool's `presentCall` view, the completed state from `presentResult`,
 * and both are mapped to pi-tui components by `tool-presentation.ts`.
 *
 * Layout follows pi-coding-agent's ToolExecutionComponent: a `Box` shell for
 * definition-backed cards, a plain text card as fallback, images appended
 * below, and a background color per state (pending / success / error).
 */

import { Box, Container, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import type { ToolResult } from "@deepseek-ai/dsh-tools";
import { bg, theme } from "./theme.js";
import { keyHint } from "./keybinding-hints.ts";
import {
  clickable,
  genericCallFallback,
  renderImage,
  presentCall,
  presentResult,
  resolveImages,
  textCard,
  type ImageResolver,
  type ResolvedImage,
} from "./tool-presentation.ts";

export interface ToolExecutionOptions {
  showImages?: boolean;
  imageWidthCells?: number;
  outputPad?: number;
}

/** The slice of a DSH tool definition this component consumes. */
export type ToolPresenterDefinition = {
  presentCall?: (args: unknown) => unknown;
  presentResult?: (args: unknown, result: ToolResult) => unknown;
};

/**
 * One tool call card. `updateResult` settles the card; `setExpanded` is driven
 * by a click on the card body.
 */
export class ToolExecutionComponent extends Container {
  private readonly toolName: string;
  private readonly toolCallId: string;
  private readonly definition: ToolPresenterDefinition | undefined;
  private readonly ui: { requestRender: () => void };
  private readonly cwd: string;
  private readonly showImages: boolean;
  private readonly imageWidthCells: number;

  private args: unknown;
  private result: ToolResult | undefined;
  private isPartial = true;
  private expanded = false;
  private outputPad: number;

  private contentBox: Box;
  private fallbackText: Text;
  private imageComponents: Component[] = [];
  private resolvedImages: ResolvedImage[] = [];

  constructor(
    toolName: string,
    toolCallId: string,
    args: unknown,
    definition: ToolPresenterDefinition | undefined,
    ui: { requestRender: () => void },
    cwd: string,
    options: ToolExecutionOptions = {},
  ) {
    super();
    this.toolName = toolName;
    this.toolCallId = toolCallId;
    this.args = args;
    this.definition = definition;
    this.ui = ui;
    this.cwd = cwd;
    this.showImages = options.showImages ?? true;
    this.imageWidthCells = options.imageWidthCells ?? 60;
    this.outputPad = options.outputPad ?? 1;

    this.addChild(new Spacer(1));
    this.contentBox = new Box(1, 1, (text: string) => bg.toolPendingBg(text));
    this.fallbackText = new Text("", 1, 1, (text: string) => bg.toolPendingBg(text));
    if (this.hasPresenter()) this.addChild(this.contentBox);
    else this.addChild(this.fallbackText);
    this.updateDisplay();
  }

  private hasPresenter(): boolean {
    return this.definition !== undefined;
  }

  getCallId(): string {
    return this.toolCallId;
  }

  /** Replace the pending arguments (a streaming call re-renders them). */
  updateArgs(args: unknown): void {
    this.args = args;
    this.updateDisplay();
    this.ui.requestRender();
  }

  /** Settle the card with the tool's durable result projection. */
  updateResult(result: ToolResult, images: ResolvedImage[] = []): void {
    this.result = result;
    this.isPartial = false;
    this.resolvedImages = images;
    this.updateDisplay();
    this.ui.requestRender();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.updateDisplay();
    this.ui.requestRender();
  }

  setOutputPad(outputPad: number): void {
    this.outputPad = outputPad;
    this.updateDisplay();
  }

  invalidate(): void {
    super.invalidate();
    this.updateDisplay();
  }

  private stateBg(): (text: string) => string {
    return this.isPartial
      ? bg.toolPendingBg
      : this.result?.isError
        ? bg.toolErrorBg
        : bg.toolSuccessBg;
  }

  private renderOptions() {
    return {
      expanded: this.expanded,
      showImages: this.showImages,
      imageWidthCells: this.imageWidthCells,
    };
  }

  private updateDisplay(): void {
    const bgFn = this.stateBg();
    const toggle = () => this.setExpanded(!this.expanded);

    if (this.hasPresenter()) {
      this.contentBox.setBgFn(bgFn);
      this.contentBox.setPaddingX(this.outputPad);
      this.contentBox.clear();

      const call = presentCall(this.definition as never, this.args, this.cwd);
      this.contentBox.addChild(
        clickable(call ?? genericCallFallback(this.toolName, this.args, this.expanded), toggle),
      );

      if (this.result !== undefined) {
        const { body } = presentResult(
          this.definition as never,
          this.args,
          this.result,
          this.cwd,
          this.renderOptions(),
        );
        this.contentBox.addChild(clickable(body ?? this.expandHint(), toggle));
      }
    } else {
      this.fallbackText.setCustomBgFn(bgFn);
      this.fallbackText.setPaddingX(this.outputPad);
      this.fallbackText.setText(this.formatFallback());
    }

    this.renderImages();
  }

  private expandHint(): Component {
    return new Text(
      theme.fg(
        "muted",
        `(${keyHint("app.tools.expand", this.expanded ? "to collapse" : "to expand")})`,
      ),
      0,
      0,
    );
  }

  private renderImages(): void {
    for (const image of this.imageComponents) this.removeChild(image);
    this.imageComponents = [];
    for (const image of this.resolvedImages) {
      const component = renderImage(image, this.imageWidthCells);
      this.addChild(new Spacer(1));
      this.addChild(component);
      this.imageComponents.push(component);
    }
  }

  private formatFallback(): string {
    let text = theme.fg("toolTitle", theme.bold(this.toolName));
    const call = presentCall(this.definition as never, this.args, this.cwd);
    if (call !== undefined) return text;
    text += "\n" + textOf(this.result?.content ?? []);
    return text;
  }
}

function textOf(content: ToolResult["content"]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export { resolveImages, type ImageResolver, type ResolvedImage };
export { textCard };
