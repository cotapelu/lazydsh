/**
 * Bordered Loader
 *
 * A loader with a border, used for loading states.
 * Ported from pi-coding-agent's bordered-loader.js.
 */

import { Container, Loader, Spacer, type TUI } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";

export interface BorderedLoaderOptions {
  message?: string;
  colorFn?: (text: string) => string;
  /** Host that repaints while the loader animates. */
  tui: TUI;
}

export class BorderedLoader extends Container {
  private loader: Loader;

  constructor(options: BorderedLoaderOptions) {
    super();
    const message = options.message ?? "Loading...";
    const colorFn = options.colorFn ?? ((text: string) => theme.fg("accent", text));

    this.addChild(new DynamicBorder(colorFn));
    this.addChild(new Spacer(1));

    this.loader = new Loader(
      options.tui,
      colorFn,
      (text: string) => theme.fg("muted", text),
      message,
    );
    this.addChild(this.loader);

    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder(colorFn));
  }

  setMessage(message: string): void {
    this.loader.setMessage(message);
  }

  stop(): void {
    this.loader.stop();
  }

  invalidate(): void {
    this.loader.invalidate();
  }
}
