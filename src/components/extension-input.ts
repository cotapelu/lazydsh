/**
 * Extension Input Component
 *
 * Simple text input component for extensions. Supports a title, description,
 * initial value, and an optional countdown timer.
 * Ported from pi-coding-agent's `extension-input.js`.
 */

import { Container, getKeybindings, Input, Spacer, Text } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.js";
import { CountdownTimer } from "./countdown-timer.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint } from "../keybinding-hints.js";

export interface ExtensionInputOptions {
  tui?: { requestRender: () => void };
  description?: string;
  initialValue?: string;
  timeout?: number;
}

/**
 * Component that renders an extension text input.
 */
export class ExtensionInputComponent extends Container {
  private input: Input;
  private onSubmitCallback: (value: string) => void;
  private onCancelCallback: () => void;
  private titleText: Text;
  private baseTitle: string;
  private countdown: CountdownTimer | undefined;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  constructor(
    title: string,
    _placeholder: string,
    onSubmit: (value: string) => void,
    onCancel: () => void,
    opts?: ExtensionInputOptions,
  ) {
    super();
    this.onSubmitCallback = onSubmit;
    this.onCancelCallback = onCancel;
    this.baseTitle = title;

    this.addChild(new DynamicBorder());
    this.addChild(new Spacer(1));
    this.titleText = new Text(theme.fg("accent", title), 1, 0);
    this.addChild(this.titleText);
    if (opts?.description) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(theme.fg("text", opts.description), 1, 0));
    }
    this.addChild(new Spacer(1));
    if (opts?.timeout && opts.timeout > 0 && opts.tui) {
      this.countdown = new CountdownTimer(
        opts.timeout,
        opts.tui,
        (s) => this.titleText.setText(theme.fg("accent", `${this.baseTitle} (${s}s)`)),
        () => this.onCancelCallback(),
      );
    }
    this.input = new Input();
    if (opts?.initialValue) this.input.setValue(opts.initialValue);
    this.addChild(this.input);
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        `${keyHint("tui.select.confirm", "submit")}  ${keyHint("tui.select.cancel", "cancel")}`,
        1,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder());
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      this.onSubmitCallback(this.input.getValue());
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    } else {
      this.input.handleInput(keyData);
    }
  }

  dispose(): void {
    this.countdown?.dispose();
  }
}
