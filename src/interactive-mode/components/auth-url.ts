/**
 * Auth URL Component
 *
 * Displays an OAuth authorization URL with click/copy hints.
 * Ported from pi-coding-agent's AuthUrlComponent.
 */

import { Container, hyperlink, Text } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { keyHint } from "../keybinding-hints.ts";

/**
 * A sign-in URL with a click hint and a copy hint.
 * Hosts call `copy()` when `app.message.copy` is pressed.
 */
export class AuthUrlComponent extends Container {
  url: string;
  tui: { requestRender: () => void };
  hint: Text;

  constructor(tui: { requestRender: () => void }, url: string) {
    super();
    this.tui = tui;
    this.url = url;
    this.addChild(new Text(theme.fg("accent", hyperlink(url, url)), 1, 0));
    this.hint = new Text("", 1, 0);
    this.addChild(this.hint);
    this.setHint(keyHint("app.message.copy", "to copy"));
  }

  setHint(suffix: string): void {
    const clickHint = process.platform === "darwin" ? "Cmd+click to open" : "Ctrl+click to open";
    this.hint.setText(
      `${theme.fg("dim", hyperlink(clickHint, this.url))} ${theme.fg("dim", "•")} ${suffix}`,
    );
    this.tui.requestRender();
  }

  async copy(): Promise<void> {
    const { copyToClipboard } = await import("../clipboard.ts");
    try {
      await copyToClipboard(this.url);
      this.setHint(theme.fg("success", "Copied URL to clipboard"));
    } catch (error) {
      this.setHint(theme.fg("error", error instanceof Error ? error.message : String(error)));
    }
  }
}
