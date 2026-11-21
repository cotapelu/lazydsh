/**
 * Mermaid Markdown Transformer
 *
 * Replaces top-level Mermaid code blocks with Unicode terminal diagrams.
 * Ported from pi-coding-agent's `mermaid.js`, adapted for `lovely-mermaid`.
 */

import { Marked } from "@earendil-works/pi-tui";
import { render } from "lovely-mermaid";

const markdownParser = new Marked();

function isMermaid(token: any): boolean {
  return (
    token.type === "code" && token.lang?.trim().split(/\s+/, 1)[0]?.toLowerCase() === "mermaid"
  );
}

function codeSpan(line: string): string {
  const content = line || "\u00a0";
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(content.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(longestBacktickRun + 1);
  const padding = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${fence}${padding}${content}${padding}${fence}`;
}

function styleSpan(span: { text: string; role: string }, themeObj: any): string {
  switch (span.role) {
    case "border":
      return themeObj.fg("borderMuted", span.text);
    case "text":
      return themeObj.fg("text", span.text);
    case "edge":
      return themeObj.fg("accent", span.text);
    case "edgeLabel":
      return themeObj.fg("muted", span.text);
    case "title":
      return themeObj.fg("accent", themeObj.bold(span.text));
    case "none":
      return span.text;
    default:
      return span.text;
  }
}

function themedLines(art: { styled: { text: string; role: string }[][] }, themeObj: any): string[] {
  return art.styled.map((row) => row.map((span) => styleSpan(span, themeObj)).join(""));
}

export interface MermaidTransformerOptions {
  getMode: () => "off" | "final" | "streaming";
  theme?: any;
}

/** Create a transformer that replaces top-level Mermaid code blocks with Unicode terminal diagrams. */
export function createMermaidMarkdownTransformer(options: MermaidTransformerOptions) {
  return (
    markdown: string,
    context: { messageType?: string; isStreaming?: boolean; availableWidth: number },
  ) => {
    const mode = options.getMode();
    if (
      mode === "off" ||
      context.messageType === "assistant-thinking" ||
      (context.isStreaming && mode !== "streaming")
    ) {
      return markdown;
    }
    return markdownParser
      .lexer(markdown)
      .map((token: any) => {
        if (!isMermaid(token)) return token.raw;
        const art = render(token.text);
        if (!art || art.width > context.availableWidth) return token.raw;
        if (!context.isStreaming && art.warnings.length > 0) {
          const suffix = art.warnings.length > 1 ? ` (+${art.warnings.length - 1} more)` : "";
          const warning = `Mermaid diagram not rendered: ${art.warnings[0]}${suffix}`;
          const styledWarning = options.theme ? options.theme.fg("warning", warning) : warning;
          return `${token.raw}\n${codeSpan(styledWarning)}  \n`;
        }
        const lines = options.theme ? themedLines(art, options.theme) : art.plain;
        return `${lines.map(codeSpan).join("  \n")}\n`;
      })
      .join("");
  };
}
