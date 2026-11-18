/**
 * Login Dialog Component
 *
 * Consolidates the three DSH authentication prompt shapes into one component:
 * a masked secret input (API key), a select list (login method), and an OAuth
 * notice (URL + device code) with a spinner while the flow runs.
 *
 * Ported from pi-coding-agent's LoginDialogComponent.
 */

import { Container, Input, Loader, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.js";
import { accent, dim, safeText } from "../theme/theme.ts";
import { keyHint, keyText } from "../keybinding-hints.js";
import { AuthUrlComponent } from "./auth-url.js";

export type LoginPromptKind = "secret" | "select" | "notice";

export interface LoginPrompt {
  kind: LoginPromptKind;
  message: string;
  /** For `select`: the choices the provider flow offers. */
  options?: { id: string; label: string; description?: string }[];
  /** For `notice`: the URL to open and the device code to show. */
  url?: string;
  code?: string;
}

/** One prompt, one promise: settle it or cancel it. */
export class LoginDialog extends Container {
  readonly capturesViewportInput = true;

  private readonly prompt: LoginPrompt;
  private readonly tui: { requestRender: () => void };
  private settle: ((value: string | null) => void) | undefined;
  private loader: Loader | undefined;
  private input: Input | undefined;
  private authUrl: AuthUrlComponent | undefined;
  private optionIndex = 0;
  private disposed = false;

  constructor(prompt: LoginPrompt, tui: { requestRender: () => void }) {
    super();
    this.prompt = prompt;
    this.tui = tui;
    this.rebuild();
  }

  /** Wait for the user's answer. Resolves `null` when cancelled. */
  whenDone(): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this.settle = resolve;
    });
  }

  /** Cancel an outstanding prompt, e.g. when the flow aborts. */
  cancel(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loader?.stop();
    this.settle?.(null);
  }

  private done(value: string | null): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loader?.stop();
    this.settle?.(value);
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.bold(safeText(this.prompt.message)), 1, 0));
    this.addChild(new Spacer(1));

    switch (this.prompt.kind) {
      case "notice":
        this.renderNotice();
        break;
      case "select":
        this.renderSelect();
        break;
      default:
        this.renderSecret();
        break;
    }

    this.addChild(new Spacer(1));
    this.addChild(this.hintLine());
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
  }

  private renderNotice(): void {
    const url = this.prompt.url;
    const code = this.prompt.code;
    if (url !== undefined) {
      this.authUrl = new AuthUrlComponent(this.tui, url);
      this.addChild(this.authUrl);
      this.addChild(new Text(dim("Opening your browser…"), 1, 0));
    }
    if (code !== undefined) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(`${dim("Device code:")} ${theme.bold(safeText(code))}`, 1, 0));
      this.addChild(new Spacer(1));
      // Device code action hint
      const hint = new Text(
        dim(`${keyHint("tui.select.confirm", "open browser and copy code")}`),
        1,
        0,
      );
      this.addChild(hint);
      this.tui.requestRender();
      // Handle Enter key for device code action
      const originalHandleInput = this.handleInput.bind(this);
      this.handleInput = (data: string) => {
        if (data === "enter") {
          void this.activateDeviceCode();
          return;
        }
        originalHandleInput(data);
      };
    }
    this.addChild(new Spacer(1));
    this.loader = new Loader(
      this.tui as never,
      (spinner) => theme.fg("accent", spinner),
      (text) => theme.fg("muted", text),
      "Waiting for authorization…",
    );
    this.addChild(this.loader);
  }

  private async activateDeviceCode(): Promise<void> {
    if (!this.authUrl) return;
    void this.authUrl.copy();
    const { openAuthUrl } = await import("../open-url.ts");
    try {
      const target = this.prompt.url;
      if (target && /^https?:\/\//.test(target)) void openAuthUrl(target);
    } catch {
      // Launcher failures must not interrupt login.
    }
  }

  private renderSelect(): void {
    const options = this.prompt.options ?? [];
    if (options.length === 0) {
      this.addChild(new Text(theme.fg("muted", "  No options available"), 1, 0));
      return;
    }
    options.forEach((option, index) => {
      const selected = index === this.optionIndex;
      const cursor = selected ? theme.fg("accent", "› ") : "  ";
      const label = selected ? theme.fg("accent", option.label) : option.label;
      const description =
        option.description !== undefined && option.description.trim() !== ""
          ? ` ${theme.fg("muted", `· ${option.description}`)}`
          : "";
      this.addChild(new Text(`${cursor}${label}${description}`, 1, 0));
    });
  }

  private renderSecret(): void {
    this.input = new Input({
      prompt: accent("┃ "),
      placeholder: "Paste your key…",
      placeholderStyle: dim,
    });
    this.addChild(this.input);
  }

  private hintLine(): Component {
    switch (this.prompt.kind) {
      case "secret":
        return new Text(
          dim(
            `${keyHint("tui.select.confirm", "submit")} · ${keyHint("tui.select.cancel", "cancel")}`,
          ),
          0,
          0,
        );
      case "select":
        return new Text(
          dim(
            `${keyHint("tui.select.down", "move")} · ${keyHint("tui.select.confirm", "select")} · ${keyHint("tui.select.cancel", "cancel")}`,
          ),
          0,
          0,
        );
      case "notice":
        return new Text(
          dim(
            `${keyHint("tui.select.confirm", "open browser and copy code")} · ${keyHint("tui.select.cancel", "cancel")}`,
          ),
          0,
          0,
        );
      default:
        return new Text(dim(`${keyHint("tui.select.cancel", "cancel")}`), 0, 0);
    }
  }

  get focused(): boolean {
    return (this.input?.focused ?? false) || this.authUrl !== undefined || true;
  }

  set focused(value: boolean) {
    if (this.input !== undefined) this.input.focused = value;
  }

  handleInput(data: string): void {
    if (this.prompt.kind === "notice") {
      // The OAuth notice is cancelled with Escape, Enter activates device code
      if (data === "escape") {
        this.done(null);
      }
      return;
    }
    if (this.prompt.kind === "select") {
      const options = this.prompt.options ?? [];
      if (data === "up" || data === "down") {
        const delta = data === "up" ? -1 : 1;
        this.optionIndex = Math.max(0, Math.min(options.length - 1, this.optionIndex + delta));
        this.rebuild();
        this.tui.requestRender();
        return;
      }
      if (data === "enter") {
        const option = options[this.optionIndex];
        this.done(option?.id ?? null);
        return;
      }
      if (/^[1-9]$/.test(data)) {
        const option = options[Number(data) - 1];
        if (option !== undefined) this.done(option.id);
        return;
      }
      if (data === "escape") {
        this.done(null);
        return;
      }
      return;
    }
    if (this.input === undefined) return;
    if (data === "enter") {
      const value = this.input.getValue().trim();
      this.done(value === "" ? null : value);
      return;
    }
    if (data === "escape") {
      this.done(null);
      return;
    }
    this.input.handleInput(data);
    this.tui.requestRender();
  }
}
