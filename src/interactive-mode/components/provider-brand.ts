/**
 * Provider Brand Animations
 *
 * Animated brand styles for preferred partner providers in selectors.
 * Ported from pi-coding-agent's provider-brand.js.
 */

import { foregroundAnsi, mixColors, parseColor } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const RADIUS_PROVIDER_ID = "radius";

/** The animated style of a provider's name, or `undefined` when the provider has none. */
export function getProviderBrandStyle(
  providerId: string,
): ((text: string, elapsedMs: number) => string) | undefined {
  if (providerId === RADIUS_PROVIDER_ID) return radiusShimmer;
  if (providerId === "openrouter") return openRouterGlow;
  return undefined;
}

/** The four colors of the Radius logo, in the order they stream across the text. */
const RADIUS_COLORS = ["#4d9abf", "#83ccd2", "#f1be57", "#f09082"].map((hex) => parseColor(hex));

/** Width of each color band, in characters. */
const CHARS_PER_COLOR = 4;
const CHARS_PER_SECOND = 10;

/** Colors `text` with the Radius logo colors flowing left to right. */
export function radiusShimmer(text: string, elapsedMs: number): string {
  const mode = theme.mode;
  const cycle = RADIUS_COLORS.length * CHARS_PER_COLOR;
  const offset = (elapsedMs / 1000) * CHARS_PER_SECOND;
  let result = "";
  let index = 0;
  for (const char of text) {
    const position = (((index - offset) % cycle) + cycle) % cycle;
    const band = Math.floor(position / CHARS_PER_COLOR);
    const t = position / CHARS_PER_COLOR - band;
    const amount = t * t * (3 - 2 * t);
    const from = RADIUS_COLORS[band];
    const to = RADIUS_COLORS[(band + 1) % RADIUS_COLORS.length];
    result += foregroundAnsi(mixColors(from, to, amount, "srgb"), mode) + char;
    index++;
  }
  return `${result}\x1b[39m`;
}

/**
 * OpenRouter's brand colors per theme appearance: lime on dark backgrounds, violet on light ones.
 * The glow breathes between `base` and the brighter `peak`.
 */
const OPENROUTER_GLOW = {
  dark: { base: parseColor("#c6f243"), peak: parseColor("#efffb0") },
  light: { base: parseColor("#5d32e1"), peak: parseColor("#8f6bff") },
};

const GLOW_PERIOD_MS = 2400;

/** Colors `text` in OpenRouter's brand color, slowly brightening and dimming. */
export function openRouterGlow(text: string, elapsedMs: number): string {
  const { base, peak } = OPENROUTER_GLOW[theme.appearance];
  const amount = (1 - Math.cos((2 * Math.PI * elapsedMs) / GLOW_PERIOD_MS)) / 2;
  return `${foregroundAnsi(mixColors(base, peak, amount, "oklch"), theme.mode)}${text}\x1b[39m`;
}

const ANIMATION_FRAME_MS = 50;

/** Re-renders `tui` every animation frame while `isAnimating()` holds; returns the function that stops it. */
export function startBrandAnimation(
  tui: { requestRender: () => void },
  isAnimating: () => boolean,
): () => void {
  const timer = setInterval(() => {
    if (isAnimating()) tui.requestRender();
  }, ANIMATION_FRAME_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
