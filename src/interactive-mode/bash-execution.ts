/**
 * Component for displaying bash command execution with streaming output.
 * Ported from pi-coding-agent's BashExecutionComponent.
 */

import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateTail } from "../utils/truncate.ts";
import { stripAnsi } from "../utils/ansi.ts";
import { theme } from "./theme.ts";
import { keyHint } from "./keybinding-hints.ts";
import type { TuiHost } from "../interfaces.ts";
import { truncateToVisualLines } from "./components/visual-truncate.ts";

// Preview line limit when not expanded (matches tool execution behavior)
const PREVIEW_LINES = 20;

export class BashExecutionComponent extends Container {
  public command: string;
  public outputLines: string[] = [];
  public status: "running" | "complete" | "error" | "cancelled" = "running";
  public exitCode: number | undefined;
  public truncationResult: { truncated: boolean; path?: string } | undefined;
  public fullOutputPath: string | undefined;
  public expanded = false;
  public contentContainer: Container;
  /** `dim` marks `!!` commands, whose output is excluded from the model context. */
  public colorKey: string;
  public outputPad: number;

  constructor(command: string, ui: TuiHost, excludeFromContext = false, outputPad = 1) {
    super();
    this.command = command;
    this.colorKey = excludeFromContext ? "dim" : "bashMode";
    this.outputPad = outputPad;

    // Add spacer
    this.addChild(new Spacer(1));
    // Content container (holds dynamic content)
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);
    this.updateDisplay();
  }

  /**
   * Set whether the output is expanded (shows full output) or collapsed (preview only).
   */
  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.updateDisplay();
  }

  setOutputPad(outputPad: number): void {
    this.outputPad = outputPad;
    this.updateDisplay();
  }

  invalidate(): void {
    super.invalidate();
    this.updateDisplay();
  }

  appendOutput(chunk: string): void {
    // Strip ANSI codes and normalize line endings
    const clean = stripAnsi(chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // Append to output lines
    const newLines = clean.split("\n");
    if (this.outputLines.length > 0 && newLines.length > 0) {
      // Append first chunk to last line (incomplete line continuation)
      this.outputLines[this.outputLines.length - 1] += newLines[0];
      this.outputLines.push(...newLines.slice(1));
    } else {
      this.outputLines.push(...newLines);
    }
    this.updateDisplay();
  }

  setComplete(
    exitCode: number | undefined,
    cancelled: boolean,
    truncationResult: { truncated: boolean; path?: string } | undefined,
    fullOutputPath: string | undefined,
  ): void {
    this.exitCode = exitCode;
    this.status = cancelled
      ? "cancelled"
      : exitCode !== 0 && exitCode !== undefined && exitCode !== null
        ? "error"
        : "complete";
    this.truncationResult = truncationResult;
    this.fullOutputPath = fullOutputPath;
    this.updateDisplay();
  }

  updateDisplay(): void {
    // Apply truncation for LLM context limits (same limits as bash tool)
    const fullOutput = this.outputLines.join("\n");
    const contextTruncation = truncateTail(fullOutput, {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES,
    });
    // Get the lines to potentially display (after context truncation)
    const availableLines = contextTruncation.content ? contextTruncation.content.split("\n") : [];
    // Apply preview truncation based on expanded state
    const previewLogicalLines = availableLines.slice(-PREVIEW_LINES);
    const hiddenLineCount = availableLines.length - previewLogicalLines.length;
    // Rebuild content container
    this.contentContainer.clear();
    // Command header - color changes based on state
    const headerColor =
      this.status === "running"
        ? this.colorKey
        : this.status === "error"
          ? "error"
          : this.status === "cancelled"
            ? "warning"
            : "success";
    const header = new Text(
      theme.fg(headerColor, theme.bold(`$ ${this.command}`)),
      this.outputPad,
      0,
    );
    this.contentContainer.addChild(header);
    // Output
    if (availableLines.length > 0) {
      if (this.expanded) {
        // Show all lines
        const displayText = availableLines.map((line) => theme.fg("muted", line)).join("\n");
        this.contentContainer.addChild(new Text(`\n${displayText}`, this.outputPad, 0));
      } else {
        // Use shared visual truncation utility with width-aware caching
        const styledOutput = previewLogicalLines.map((line) => theme.fg("muted", line)).join("\n");
        const styledInput = `\n${styledOutput}`;
        let cachedWidth: number | undefined;
        let cachedLines: string[] | undefined;
        this.contentContainer.addChild({
          render: (width: number) => {
            if (cachedLines === undefined || cachedWidth !== width) {
              const result = truncateToVisualLines(
                styledInput,
                PREVIEW_LINES,
                width,
                this.outputPad,
              );
              cachedLines = result.visualLines;
              cachedWidth = width;
            }
            return cachedLines ?? [];
          },
          invalidate: () => {
            cachedWidth = undefined;
            cachedLines = undefined;
          },
        });
      }
    }
    // Status (only when not running)
    if (this.status !== "running") {
      const statusParts: string[] = [];
      // Show how many lines are hidden (collapsed preview)
      if (hiddenLineCount > 0) {
        if (this.expanded) {
          statusParts.push(
            `${theme.fg("muted", "(")}${keyHint("app.tools.expand", "to collapse")}${theme.fg("muted", ")")}`,
          );
        } else {
          statusParts.push(
            `${theme.fg("muted", `... ${hiddenLineCount} more lines (`)}${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`,
          );
        }
      }
      if (this.status === "cancelled") {
        statusParts.push(theme.fg("warning", "(cancelled)"));
      } else if (this.status === "error") {
        statusParts.push(theme.fg("error", `(exit ${this.exitCode})`));
      }
      // Add truncation warning (context truncation, not preview truncation)
      const wasTruncated = this.truncationResult?.truncated || contextTruncation.truncated;
      if (wasTruncated && this.fullOutputPath) {
        statusParts.push(
          theme.fg("warning", `Output truncated. Full output: ${this.fullOutputPath}`),
        );
      }
      if (statusParts.length > 0) {
        this.contentContainer.addChild(new Text(`\n${statusParts.join("\n")}`, this.outputPad, 0));
      }
    }
  }

  /**
   * Get the raw output for creating BashExecutionMessage.
   */
  getOutput(): string {
    return this.outputLines.join("\n");
  }

  /**
   * Get the command that was executed.
   */
  getCommand(): string {
    return this.command;
  }
}
