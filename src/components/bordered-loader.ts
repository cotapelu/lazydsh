/**
 * Bordered Loader
 *
 * A loader with a border, used for loading states.
 * Ported from pi-coding-agent's bordered-loader.js.
 */

import { Container, Loader, Spacer } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.js";

export interface BorderedLoaderOptions {
  message?: string;
  colorFn?: (text: string) => string;
}

export class BorderedLoader extends Container {
  private loader: Loader;

  constructor(message = "Loading...", options: BorderedLoaderOptions = {}) {
    super();
    const colorFn = options.colorFn ?? ((text: string) => theme.fg("accent", text));

    this.addChild(new DynamicBorder(colorFn));
    this.addChild(new Spacer(1));

    this.loader = new Loader(
      this as any,
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
