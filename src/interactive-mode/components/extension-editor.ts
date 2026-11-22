/**
 * Extension Editor Component
 *
 * Multi-line editor component for extensions. Enter submits (Shift+Enter for
 * newlines, like the main editor); Ctrl+G opens `$EDITOR`.
 * Ported from pi-coding-agent's `extension-editor.js`.
 */

import { Container, Editor, getKeybindings, Spacer, Text } from "@earendil-works/pi-tui";
import { editInExternalEditor } from "../external-editor.ts";
import { narrowedUi } from "../tui-renderer.ts";
import { getEditorTheme, theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";
import { keyHint } from "../keybinding-hints.ts";

export interface ExtensionEditorOptions {
  description?: string;
  [key: string]: unknown;
}

/**
 * Component that renders an extension multi-line editor.
 */
export class ExtensionEditorComponent extends Container {
  private editor: Editor;
  private onSubmitCallback: (text: string) => void;
  private onCancelCallback: () => void;
  private tui: { stop: () => void; start: () => void; requestRender: (force?: boolean) => void };
  private keybindings: { matches: (data: string, key: string) => boolean };
  private externalEditorCommand: string;
  /** Shows external editor failures; renders nothing while empty. */
  private externalEditorStatus = new Text("", 1, 0);
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.editor.focused = value;
  }

  constructor(
    tui: { stop: () => void; start: () => void; requestRender: (force?: boolean) => void },
    keybindings: { matches: (data: string, key: string) => boolean },
    title: string,
    prefill: string,
    onSubmit: (text: string) => void,
    onCancel: () => void,
    options?: ExtensionEditorOptions,
    externalEditorCommand?: string,
  ) {
    super();
    this.tui = tui;
    this.keybindings = keybindings;
    this.externalEditorCommand =
      externalEditorCommand ||
      process.env.VISUAL ||
      process.env.EDITOR ||
      (process.platform === "win32" ? "notepad" : "nano");
    this.onSubmitCallback = onSubmit;
    this.onCancelCallback = onCancel;
    const { description, ...editorOptions } = options ?? {};

    // Add top border
    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    // Add title and optional description
    this.addChild(new Text(theme.fg("accent", title), 1, 0));
    if (description) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(theme.fg("text", description), 1, 0));
    }
    this.addChild(new Spacer(1));
    // Create editor
    this.editor = new Editor(narrowedUi(tui), getEditorTheme(), editorOptions);
    if (prefill) {
      this.editor.setText(prefill);
    }
    // Wire up Enter to submit (Shift+Enter for newlines, like the main editor)
    this.editor.onSubmit = (text) => {
      this.onSubmitCallback(text);
    };
    this.addChild(this.editor);
    this.addChild(this.externalEditorStatus);
    this.addChild(new Spacer(1));
    // Add hint
    const hint =
      keyHint("tui.select.confirm", "submit") +
      "  " +
      keyHint("tui.input.newLine", "newline") +
      "  " +
      keyHint("tui.select.cancel", "cancel") +
      `  ${keyHint("app.editor.external", "external editor")}`;
    this.addChild(new Text(hint, 1, 0));
    this.addChild(new Spacer(1));
    // Add bottom border
    this.addChild(new DynamicBorder());
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    // Escape or Ctrl+C to cancel
    if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
      return;
    }
    // External editor (app keybinding)
    if (this.keybindings.matches(keyData, "app.editor.external")) {
      void this.handleOpenExternalEditor();
      return;
    }
    // Forward to editor
    this.editor.handleInput(keyData);
  }

  private async handleOpenExternalEditor(): Promise<void> {
    const content = this.editor.getText();
    this.tui.stop();
    try {
      const result = await editInExternalEditor({
        command: this.externalEditorCommand,
        content,
      });
      this.externalEditorStatus.setText(
        result.status === "failed" ? theme.fg("warning", result.message ?? "") : "",
      );
      if (result.status === "complete") {
        this.editor.setText(result.content ?? "");
      }
    } finally {
      this.tui.start();
      this.tui.requestRender(true);
    }
  }
}
