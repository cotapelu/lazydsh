/**
 * Built-in theme definitions.
 *
 * Converted from JSON to TypeScript so the compiler can type-check them and
 * the bundler can inline them (no runtime file reads / postbuild copy).
 */
export interface BuiltinThemeDoc {
  name?: string;
  colors: Record<string, string>;
  vars?: Record<string, string>;
  appearance?: "light" | "dark";
  /**
   * Tokens that render faint (`\x1b[2m`). A theme marks tokens that should
   * recede — reasoning belongs to the model, not the answer — rather than
   * only dimming them by colour, which still reads at full weight.
   */
  dim?: string[];
}

export const BUILTIN_THEMES: Record<string, BuiltinThemeDoc> = {
  dark: {
    dim: ["thinkingText"],
    name: "dark",
    appearance: "dark",
    colors: {
      accent: "#4d6bfe",
      success: "#50fa7b",
      error: "#ff5555",
      warning: "#ffb400",
      muted: "#8a8f96",
      dim: "#5f646a",
      syntaxKeyword: "#ff79c6",
      syntaxString: "#f1fa8c",
      syntaxComment: "#6272a4",
      syntaxFunction: "#50fa7b",
      syntaxNumber: "#bd93f9",
      syntaxType: "#8be9fd",
      toolDiffAdded: "#64ff64",
      toolDiffRemoved: "#ff6464",
      thinkingLow: "#50fa7b",
      thinkingMedium: "#f1fa8c",
      thinkingHigh: "#ffb86c",
      thinkingXhigh: "#ff79c6",
      bashMode: "#ffb86c",
    },
  },
  light: {
    dim: ["thinkingText"],
    name: "light",
    appearance: "light",
    colors: {
      accent: "#0047d9",
      success: "#28a745",
      error: "#dc3545",
      warning: "#e09000",
      muted: "#6a7282",
      dim: "#868e96",
      syntaxKeyword: "#c01b9e",
      syntaxString: "#862aa1",
      syntaxComment: "#6a7282",
      syntaxFunction: "#28a745",
      syntaxNumber: "#8442d6",
      syntaxType: "#1c75bc",
      toolDiffAdded: "#28a745",
      toolDiffRemoved: "#dc3545",
      thinkingLow: "#28a745",
      thinkingMedium: "#e09000",
      thinkingHigh: "#fd7e14",
      thinkingXhigh: "#c01b9e",
      bashMode: "#fd7e14",
    },
  },
  nature: {
    name: "nature",
    appearance: "dark",
    dim: ["thinkingText"],
    colors: {
      // Core - earth tones
      accent: "#8fa58f", // sage green
      border: "",
      borderAccent: "#a8c8a8", // light sage
      borderMuted: "#3d4a3d", // dark moss
      success: "#7fc97f", // soft leaf green
      error: "#d47a6a", // terracotta
      warning: "#e8b86d", // warm amber
      muted: "#8b958b", // stone gray-green
      dim: "#5d655d", // dark stone
      text: "",

      // Thinking - a recessed, quiet zone: darker than the card, barely tinted
      thinkingText: "#7d9a7d", // muted sage, read only as texture
      scrollbarTrack: "#2d382d", // dark forest floor
      scrollbarThumb: "#5d755d", // moss

      // Selection
      selectedBg: "#3d5a3d", // forest shadow

      // Messages - natural paper / earth cards
      userMessageBg: "#2c382c", // dark forest
      userMessageText: "#d4e8d4", // pale parchment
      assistantMessageBg: "#352f28", // warm earth card
      customMessageBg: "#352f28", // warm earth
      customMessageText: "#e8dcc8", // warm sand
      customMessageLabel: "#a8c8a8", // sage

      // Tools - natural states
      toolPendingBg: "#2d3528", // soil
      toolSuccessBg: "#1e351e", // deep forest
      toolErrorBg: "#3d2525", // clay
      toolTitle: "#a8c8a8", // sage
      toolOutput: "#d4d4c8", // parchment

      // Markdown - natural reading
      mdHeading: "#a8c8a8", // sage
      mdLink: "#8fa58f", // accent sage
      mdLinkUrl: "#8b958b", // muted stone
      mdCode: "#b8d8b8", // light mint
      mdCodeBlock: "#d4e4d4", // pale green paper
      mdCodeBlockBorder: "#3d4a3d", // moss border
      mdQuote: "#a8c8a8", // sage
      mdQuoteBorder: "#3d4a3d", // moss
      mdHr: "#3d4a3d", // moss line
      mdListBullet: "#8fa58f", // sage

      // Diffs - natural changes
      toolDiffAdded: "#7fc97f", // leaf green
      toolDiffRemoved: "#d47a6a", // terracotta
      toolDiffContext: "#7d8a7d", // stone

      // Syntax - earth palette
      syntaxComment: "#6d7d6d", // weathered stone
      syntaxKeyword: "#c8a888", // warm clay
      syntaxFunction: "#7fc97f", // leaf
      syntaxVariable: "#e8e0d0", // parchment
      syntaxString: "#a8d8a8", // mint
      syntaxNumber: "#d8b888", // sand
      syntaxType: "#98c8d8", // sky water
      syntaxOperator: "#c8a888", // clay
      syntaxPunctuation: "#c8c0b0", // stone dust

      // Thinking levels - forest depth
      thinkingOff: "#8fa58f", // sage
      thinkingMinimal: "#6d7d6d", // stone
      thinkingLow: "#7fc97f", // young leaf
      thinkingMedium: "#a8d8a8", // mint
      thinkingHigh: "#e8c888", // amber
      thinkingXhigh: "#c8a888", // clay

      // Bash mode
      bashMode: "#e8b86d", // amber
    },
  },
  natureLight: {
    name: "natureLight",
    appearance: "light",
    dim: ["thinkingText"],
    colors: {
      // Core - light earth tones
      accent: "#5a7d5a", // forest sage
      border: "",
      borderAccent: "#7a9a7a", // light sage
      borderMuted: "#c8d8c8", // pale moss
      success: "#4a9c4a", // leaf green
      error: "#c85a4a", // terracotta
      warning: "#c8984a", // warm amber
      muted: "#7a8a7a", // stone gray-green
      dim: "#9a9a8a", // light stone
      text: "",

      // Thinking - a quiet, recessed zone: just off the warm sand card
      thinkingText: "#6a8a6a", // muted forest, reads as texture
      scrollbarTrack: "#e8f0e8", // pale forest floor
      scrollbarThumb: "#b8d0b8", // light moss

      // Selection
      selectedBg: "#d0e8d0", // pale forest shadow

      // Messages
      userMessageBg: "#e8f4e8", // pale forest mist
      userMessageText: "#3a5a3a", // dark forest text
      assistantMessageBg: "#f5ebe0", // warm sand card
      customMessageBg: "#f5ebe0", // warm sand
      customMessageText: "#5a4a3a", // warm earth text
      customMessageLabel: "#5a7d5a", // sage

      // Tools
      toolPendingBg: "#f0f5e8", // pale soil
      toolSuccessBg: "#e8f4e8", // forest mist
      toolErrorBg: "#fce8e8", // pale clay
      toolTitle: "#5a7d5a", // sage
      toolOutput: "#4a5a4a", // forest text

      // Markdown
      mdHeading: "#5a7d5a", // sage
      mdLink: "#5a7d5a", // sage
      mdLinkUrl: "#7a8a7a", // stone
      mdCode: "#4a8a4a", // forest green
      mdCodeBlock: "#f0f8f0", // pale paper
      mdCodeBlockBorder: "#c8d8c8", // pale moss
      mdQuote: "#6a8a6a", // forest
      mdQuoteBorder: "#c8d8c8", // moss
      mdHr: "#c8d8c8", // moss line
      mdListBullet: "#5a7d5a", // sage

      // Diffs
      toolDiffAdded: "#4a9c4a", // leaf
      toolDiffRemoved: "#c85a4a", // terracotta
      toolDiffContext: "#8a9a8a", // stone

      // Syntax
      syntaxComment: "#8a9a8a", // weathered stone
      syntaxKeyword: "#a87a5a", // warm clay
      syntaxFunction: "#4a9c4a", // leaf
      syntaxVariable: "#4a5a4a", // forest
      syntaxString: "#5a9a5a", // mint
      syntaxNumber: "#b88a5a", // sand
      syntaxType: "#5a8ab8", // sky water
      syntaxOperator: "#a87a5a", // clay
      syntaxPunctuation: "#9a9a8a", // stone dust

      // Thinking levels
      thinkingOff: "#5a7d5a",
      thinkingMinimal: "#8a9a8a",
      thinkingLow: "#4a9c4a",
      thinkingMedium: "#6aac6a",
      thinkingHigh: "#c89a5a",
      thinkingXhigh: "#a87a5a",

      // Bash mode
      bashMode: "#c8984a",
    },
  },
  lazydsh: {
    name: "lazydsh",
    dim: ["thinkingText"],
    colors: {
      accent: "#4d6bfe",
      border: "",
      borderAccent: "#4d6bfe",
      borderMuted: "#3c3f44",
      success: "#50fa7b",
      error: "#ff5555",
      warning: "#ffb400",
      muted: "#a0a6ac",
      dim: "#6a6e73",
      text: "",
      thinkingText: "#6b8fa8",
      scrollbarTrack: "#3c3f44",
      scrollbarThumb: "#787878",
      selectedBg: "#4d6bfe",
      userMessageBg: "#2d3a4f",
      userMessageText: "#a8d0ff",
      assistantMessageBg: "",
      customMessageBg: "#2d2d3d",
      customMessageText: "#c0c0d0",
      customMessageLabel: "#4d6bfe",
      toolPendingBg: "#1e2332",
      toolSuccessBg: "#14321e",
      toolErrorBg: "#3c1414",
      toolTitle: "#4d6bfe",
      toolOutput: "#c8c8c8",
      mdHeading: "#4d6bfe",
      mdLink: "#4d6bfe",
      mdLinkUrl: "#a0a6ac",
      mdCode: "#9bcaff",
      mdCodeBlock: "#c8c8c8",
      mdCodeBlockBorder: "#3c3f44",
      mdQuote: "#a0a6ac",
      mdQuoteBorder: "#3c3f44",
      mdHr: "#3c3f44",
      mdListBullet: "#4d6bfe",
      toolDiffAdded: "#64ff64",
      toolDiffRemoved: "#ff6464",
      toolDiffContext: "#787878",
      syntaxComment: "#6272a4",
      syntaxKeyword: "#ff79c6",
      syntaxFunction: "#50fa7b",
      syntaxVariable: "#f8f8f2",
      syntaxString: "#f1fa8c",
      syntaxNumber: "#bd93f9",
      syntaxType: "#8be9fd",
      syntaxOperator: "#ff79c6",
      syntaxPunctuation: "#f8f8f2",
      thinkingOff: "#4d6bfe",
      thinkingMinimal: "#6272a4",
      thinkingLow: "#50fa7b",
      thinkingMedium: "#f1fa8c",
      thinkingHigh: "#ffb86c",
      thinkingXhigh: "#ff79c6",
      bashMode: "#ffb86c",
    },
  },
};
