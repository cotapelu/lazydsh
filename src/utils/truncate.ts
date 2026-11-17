/**
 * Truncation utilities for bash output.
 * Ported from pi-coding-agent's tools/truncate.js
 */

export const DEFAULT_MAX_LINES = 10_000;
export const DEFAULT_MAX_BYTES = 1_000_000;

/**
 * Truncate the tail of a string to fit within line and byte limits.
 * Returns the truncated content and whether truncation occurred.
 */
export function truncateTail(
  text: string,
  options: { maxLines: number; maxBytes: number },
): { content: string; truncated: boolean } {
  const lines = text.split("\n");
  if (lines.length <= options.maxLines) {
    // Check byte limit
    const bytes = Buffer.byteLength(text, "utf-8");
    if (bytes <= options.maxBytes) {
      return { content: text, truncated: false };
    }
  }

  // Truncate by lines first
  let truncatedLines = lines.slice(-options.maxLines);
  let content = truncatedLines.join("\n");

  // Then truncate by bytes if needed
  const contentBytes = Buffer.byteLength(content, "utf-8");
  if (contentBytes > options.maxBytes) {
    // Find the cutoff point
    const encoder = new TextEncoder();
    const encoded = encoder.encode(content);
    const truncated = encoded.subarray(0, options.maxBytes);
    // Decode back, handling incomplete UTF-8 sequences
    content = new TextDecoder("utf-8", { fatal: false }).decode(truncated);
  }

  return { content, truncated: true };
}
