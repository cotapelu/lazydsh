/**
 * Tool Execution Component
 *
 * Rich tool execution card with live streaming args/results, custom renderers,
 * expandable output, images, duration display. Ported from pi-coding-agent's
 * ToolExecutionComponent.
 */

import {
  Box,
  Container,
  getCapabilities,
  Image,
  MouseRegion,
  Spacer,
  Text,
  type TuiMouseEvent,
} from "@earendil-works/pi-tui";
import { theme } from "./theme/theme.ts";
import { keyHint, keyText } from "./keybinding-hints.ts";

const FALLBACK_PREVIEW_LINES = 10;

export interface ToolDefinition {
  renderCall?: (args: any, theme: any, context: RenderContext) => any;
  renderResult?: (
    result: any,
    options: { expanded: boolean; isPartial: boolean },
    theme: any,
    context: RenderContext,
  ) => any;
  renderShell?: "default" | "self";
}

export interface RenderContext {
  args: Record<string, unknown>;
  toolCallId: string;
  invalidate: () => void;
  lastComponent: any;
  state: Record<string, unknown>;
  cwd: string;
  executionStarted: boolean;
  argsComplete: boolean;
  isPartial: boolean;
  expanded: boolean;
  showImages: boolean;
  isError: boolean;
  durationMs: number | undefined;
  outputPad: number;
  keyText: typeof keyText;
  keyHint: typeof keyHint;
}

export interface ToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  details?: any;
  isError: boolean;
  durationMs?: number;
}

export interface ToolExecutionOptions {
  showImages?: boolean;
  imageWidthCells?: number;
  outputPad?: number;
}

/**
 * Tool Execution Component
 */
export class ToolExecutionComponent extends Container {
  private contentBox: Box;
  private contentText: Text;
  private contentTextRegion: MouseRegion;
  private selfRenderContainer: Container;
  private selfRenderHeight = 0;
  private callRendererComponent: any;
  private resultRendererComponent: any;
  private rendererState: Record<string, unknown> = {};
  private imageComponents: any[] = [];
  private imageSources: Array<{ data: string; mimeType: string; widthCells: number }> = [];
  private imageSpacers: Spacer[] = [];

  public toolName: string;
  public toolCallId: string;
  public args: Record<string, unknown>;
  public expanded = false;
  public showImages: boolean;
  public imageWidthCells: number;
  public outputPad: number;
  public isPartial = true;
  public toolDefinition: ToolDefinition | undefined;
  private ui: any;
  private cwd: string;
  public executionStarted = false;
  public argsComplete = false;
  private argsPending = false;
  public result: ToolResult | undefined;
  public hideComponent = false;

  constructor(
    toolName: string,
    toolCallId: string,
    args: Record<string, unknown>,
    options: ToolExecutionOptions = {},
    toolDefinition: ToolDefinition | undefined,
    ui: any,
    cwd: string,
  ) {
    super();
    this.toolName = toolName;
    this.toolCallId = toolCallId;
    this.args = args;
    this.toolDefinition = toolDefinition;
    this.showImages = options.showImages ?? true;
    this.imageWidthCells = options.imageWidthCells ?? 60;
    this.outputPad = options.outputPad ?? 1;
    this.ui = ui;
    this.cwd = cwd;

    this.addChild(new Spacer(1));

    // Always create all shell variants. contentBox is used for default renderer-based composition.
    // selfRenderContainer is used when the tool renders its own framing.
    // contentText is reserved for generic fallback rendering when no tool definition exists.
    this.contentBox = new Box(1, 1, (text) => theme.bg("toolPendingBg", text));
    this.contentText = new Text("", 1, 1, (text) => theme.bg("toolPendingBg", text));
    this.contentTextRegion = this.createResultRegion(this.contentText);
    this.selfRenderContainer = new Container();

    if (this.hasRendererDefinition()) {
      this.addChild(this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox);
    } else {
      this.addChild(this.contentTextRegion);
    }
    this.updateDisplay();
  }

  getCallRenderer() {
    return this.toolDefinition?.renderCall;
  }

  getResultRenderer() {
    return this.toolDefinition?.renderResult;
  }

  hasRendererDefinition(): boolean {
    return this.toolDefinition !== undefined;
  }

  getRenderShell(): "default" | "self" {
    return this.toolDefinition?.renderShell ?? "default";
  }

  getRenderContext(lastComponent: any): RenderContext {
    return {
      args: this.args,
      toolCallId: this.toolCallId,
      invalidate: () => {
        this.invalidate();
        this.ui.requestRender();
      },
      lastComponent,
      state: this.rendererState,
      cwd: this.cwd,
      executionStarted: this.executionStarted,
      argsComplete: this.argsComplete,
      isPartial: this.isPartial,
      expanded: this.expanded,
      showImages: this.showImages,
      isError: this.result?.isError ?? false,
      durationMs: this.isPartial ? undefined : this.result?.durationMs,
      outputPad: this.outputPad,
      keyText,
      keyHint,
    };
  }

  createCallFallback(): Text {
    return new Text(this.formatToolCallWithArgs(this.toolName, this.args, this.expanded), 0, 0);
  }

  createResultFallback(): Text | undefined {
    const output = this.getTextOutput();
    if (!output) {
      return undefined;
    }
    const lines = output.split("\n");
    const displayLines = this.expanded ? lines : lines.slice(0, FALLBACK_PREVIEW_LINES);
    const remaining = lines.length - displayLines.length;
    let text = displayLines.map((line) => theme.fg("toolOutput", line)).join("\n");
    if (remaining > 0) {
      text += `${theme.fg("muted", `\n... (${remaining} more lines, `)}${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
    }
    return new Text(text, 0, 0);
  }

  createResultRegion(component: any): MouseRegion {
    return new MouseRegion(component, (event) => {
      if (!this.result || event.type !== "click" || event.button !== "left") return undefined;
      this.setExpanded(!this.expanded);
      return { handled: true };
    });
  }

  /**
   * Show new partial arguments. Applied at the next render, so a call streaming many argument deltas between two
   * frames runs its renderer once per frame, not once per delta.
   */
  updateArgs(args: Record<string, unknown>): void {
    this.args = args;
    this.argsPending = true;
    this.ui.requestRender();
  }

  markExecutionStarted(): void {
    this.executionStarted = true;
    this.updateDisplay();
    this.ui.requestRender();
  }

  setArgsComplete(): void {
    this.argsComplete = true;
    this.updateDisplay();
    this.ui.requestRender();
  }

  updateResult(result: ToolResult, isPartial = false): void {
    this.result = result;
    this.isPartial = isPartial;
    this.updateDisplay();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.updateDisplay();
  }

  setOutputPad(outputPad: number): void {
    this.outputPad = outputPad;
    this.updateDisplay();
  }

  setShowImages(show: boolean): void {
    this.showImages = show;
    this.updateDisplay();
  }

  setImageWidthCells(width: number): void {
    this.imageWidthCells = Math.max(1, Math.floor(width));
    this.updateDisplay();
  }

  invalidate(): void {
    super.invalidate();
    this.updateDisplay();
  }

  render(width: number): string[] {
    if (this.argsPending) this.updateDisplay();
    if (this.hideComponent) {
      return [];
    }
    if (this.hasRendererDefinition() && this.getRenderShell() === "self") {
      const contentLines = this.selfRenderContainer.render(width);
      this.selfRenderHeight = contentLines.length;
      if (contentLines.length === 0 && this.imageComponents.length === 0) {
        return [];
      }
      const lines: string[] = [];
      if (contentLines.length > 0) {
        lines.push("");
        lines.push(...contentLines);
      }
      for (let i = 0; i < this.imageComponents.length; i++) {
        const spacer = this.imageSpacers[i];
        if (spacer) {
          lines.push(...spacer.render(width));
        }
        const imageComponent = this.imageComponents[i];
        if (imageComponent) {
          lines.push(...imageComponent.render(width));
        }
      }
      return lines;
    }
    return super.render(width);
  }

  handleMouse(event: TuiMouseEvent): any {
    if (!this.hasRendererDefinition() || this.getRenderShell() !== "self")
      return super.handleMouse(event);
    if (event.y <= 0 || event.y > this.selfRenderHeight) return undefined;
    return this.selfRenderContainer.handleMouse({
      ...event,
      y: event.y - 1,
      height: this.selfRenderHeight,
    });
  }

  private formatToolCallWithArgs(
    name: string,
    args: Record<string, unknown>,
    expanded: boolean,
  ): string {
    const argsStr = JSON.stringify(args, null, 2);
    if (expanded) {
      return `${name} ${argsStr}`;
    }
    // Single line preview
    const firstLine = argsStr.split("\n")[0];
    return `${name} ${firstLine}...`;
  }

  private getTextOutput(): string | undefined {
    if (!this.result) return undefined;
    const textBlocks = this.result.content.filter((c) => c.type === "text");
    if (textBlocks.length === 0) return undefined;
    return textBlocks.map((b) => b.text).join("\n");
  }

  private updateDisplay(): void {
    this.argsPending = false;
    const bgFn = this.isPartial
      ? (text: string) => theme.bg("toolPendingBg", text)
      : this.result?.isError
        ? (text: string) => theme.bg("toolErrorBg", text)
        : (text: string) => theme.bg("toolSuccessBg", text);

    this.hideComponent = false;

    if (this.hasRendererDefinition()) {
      const renderContainer =
        this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox;
      if (renderContainer instanceof Box) {
        renderContainer.setBgFn(bgFn);
        renderContainer.setPaddingX(this.outputPad);
      }
      renderContainer.clear();

      const callRenderer = this.getCallRenderer();
      if (!callRenderer) {
        renderContainer.addChild(this.createResultRegion(this.createCallFallback()));
      } else {
        try {
          const component = callRenderer(
            this.args,
            theme,
            this.getRenderContext(this.callRendererComponent),
          );
          this.callRendererComponent = component;
          renderContainer.addChild(this.createResultRegion(component));
        } catch {
          this.callRendererComponent = undefined;
          renderContainer.addChild(this.createResultRegion(this.createCallFallback()));
        }
      }

      if (this.result) {
        const resultRenderer = this.getResultRenderer();
        if (!resultRenderer) {
          const component = this.createResultFallback();
          if (component) {
            renderContainer.addChild(this.createResultRegion(component));
          }
        } else {
          try {
            const component = resultRenderer(
              { content: this.result.content, details: this.result.details },
              { expanded: this.expanded, isPartial: this.isPartial },
              theme,
              this.getRenderContext(this.resultRendererComponent),
            );
            this.resultRendererComponent = component;
            renderContainer.addChild(this.createResultRegion(component));
          } catch {
            this.resultRendererComponent = undefined;
            const component = this.createResultFallback();
            if (component) {
              renderContainer.addChild(this.createResultRegion(component));
            }
          }
        }
      }
    } else {
      this.contentText.setCustomBgFn(bgFn);
      this.contentText.setPaddingX(this.outputPad);
      this.contentText.setText(
        this.formatToolCallWithArgs(this.toolName, this.args, this.expanded),
      );
    }

    // Handle images in result
    const previousImages = this.imageComponents;
    const previousSources = this.imageSources;
    for (const img of this.imageComponents) {
      this.removeChild(img);
    }
    this.imageComponents = [];
    this.imageSources = [];
    for (const spacer of this.imageSpacers) {
      this.removeChild(spacer);
    }
    this.imageSpacers = [];

    if (this.result) {
      const imageBlocks = this.result.content.filter((c) => c.type === "image");
      const caps = getCapabilities();
      for (const img of imageBlocks) {
        if (caps.images && this.showImages && img.data && img.mimeType) {
          const spacer = new Spacer(1);
          this.addChild(spacer);
          this.imageSpacers.push(spacer);
          const source = {
            data: img.data,
            mimeType: img.mimeType,
            widthCells: this.imageWidthCells,
          };
          const index = this.imageComponents.length;
          const previous = previousSources[index];
          const imageComponent =
            previous?.data === source.data &&
            previous.mimeType === source.mimeType &&
            previous.widthCells === source.widthCells
              ? previousImages[index]
              : new Image(
                  source.data,
                  source.mimeType,
                  { fallbackColor: (str: string) => theme.fg("muted", str) },
                  { maxWidthCells: source.widthCells },
                );
          this.addChild(imageComponent);
          this.imageComponents.push(imageComponent);
          this.imageSources.push(source);
        }
      }
    }
  }
}
