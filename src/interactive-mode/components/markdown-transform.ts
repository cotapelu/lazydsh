/**
 * Markdown Transformer
 *
 * Applies extension Markdown transformers.
 * `isStreaming` is read per transform, so a reused component sees a stream end.
 * Ported from pi-coding-agent's markdown-transform.js.
 */

/** Type for Markdown transformers from extensions. */
export type MarkdownTransformers = Array<
  (markdown: string, context: MarkdownTransformContext) => string | void
>;

/** Context passed to Markdown transformers. */
export interface MarkdownTransformContext {
  messageType: "assistant" | "assistant-thinking" | "user" | "skill" | "summary" | "custom";
  isStreaming: boolean;
  availableWidth: number;
  messageId: string | undefined;
  timestamp: number | undefined;
}

/** Applies extension Markdown transformers. */
export function createMarkdownTransform(
  messageType: MarkdownTransformContext["messageType"],
  isStreaming: () => boolean,
  transformers: MarkdownTransformers,
  messageId: string | undefined,
  timestamp: number | undefined,
) {
  return (markdown: string, availableWidth: number): string =>
    applyMarkdownTransformers(
      markdown,
      {
        messageType,
        isStreaming: isStreaming(),
        availableWidth,
        messageId,
        timestamp,
      },
      transformers,
    );
}

function applyMarkdownTransformers(
  markdown: string,
  context: MarkdownTransformContext,
  transformers: MarkdownTransformers,
): string {
  let transformedMarkdown = markdown;
  for (const transformer of transformers) {
    try {
      const transformed = transformer(transformedMarkdown, context);
      if (typeof transformed === "string") {
        transformedMarkdown = transformed;
      }
    } catch {
      // Keep the current Markdown and continue with the next transformer.
    }
  }
  return transformedMarkdown;
}
