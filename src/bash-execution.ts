/**
 * BashExecutionComponent
 *
 * The terminal card for a shell command: the command as its header, the
 * captured output, and an exit-status pill. DSH's `bash` tool reports a
 * `TerminalCallView` while the call runs and a `TerminalResultView` with the
 * full output once it settles (the tool truncates its own output and records a
 * spill path), so this component renders states rather than streaming bytes.
 */

import { Box, Container, Text } from "@earendil-works/pi-tui";
import type { TerminalCallView, TerminalResultView } from "@deepseek-ai/dsh-tools";
import { theme } from "./theme/theme.js";
import { DynamicBorder } from "./components/dynamic-border.js";
import { keyHint } from "./keybinding-hints.ts";

const PREVIEW_LINES = 20;

export class BashExecutionComponent extends Box {
  private view: TerminalCallView;
  private result: TerminalResultView | undefined;
  private expanded = false;

  constructor(view: TerminalCallView) {
    super(1, 1, (text: string) => theme.fg("bashMode", text));
    this.view = view;
  }

  setResult(result: TerminalResultView): void {
    this.result = result;
    this.invalidate();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.invalidate();
  }

  invalidate(): void {
    this.setPaddingX(1);
    this.clear();
    this.addChild(new Text(theme.fg("bashMode", theme.bold(`$ ${this.view.title}`)), 0, 0));
    if (this.view.description !== undefined)
      this.addChild(new Text(theme.fg("muted", this.view.description), 0, 0));
    if (this.view.cwd !== undefined)
      this.addChild(new Text(theme.fg("muted", this.view.cwd), 0, 0));
    if (this.result === undefined) return;

    const output = (this.result.output ?? "").replace(/\n+$/, "");
    const lines = output.length > 0 ? output.split("\n") : [];
    const display = this.expanded ? lines : lines.slice(-PREVIEW_LINES);
    const hidden = lines.length - display.length;
    if (display.length > 0)
      this.addChild(
        new Text("\n" + display.map((line) => theme.fg("muted", line)).join("\n"), 0, 0),
      );
    if (hidden > 0)
      this.addChild(
        new Text(
          theme.fg(
            "muted",
            `... ${hidden} more lines (${keyHint("app.tools.expand", "to expand")})`,
          ),
          0,
          0,
        ),
      );
    if (this.result.title !== undefined)
      this.addChild(new Text(theme.fg("bashMode", theme.bold(this.result.title)), 0, 0));
    if (this.result.signal !== undefined)
      this.addChild(new Text(theme.fg("warning", `(killed by ${this.result.signal})`), 0, 0));
    else if (this.result.exitCode !== undefined)
      this.addChild(
        new Text(
          this.result.exitCode === 0
            ? theme.fg("success", `(exit ${this.result.exitCode})`)
            : theme.fg("error", `(exit ${this.result.exitCode})`),
          0,
          0,
        ),
      );
  }
}

/** A bordered variant for transcript rows that are not tool cards. */
export class BorderedBashExecution extends Container {
  constructor(component: BashExecutionComponent) {
    super();
    const border = (text: string) => theme.fg("bashMode", text);
    this.addChild(new DynamicBorder(border));
    this.addChild(component);
    this.addChild(new DynamicBorder(border));
  }
}
