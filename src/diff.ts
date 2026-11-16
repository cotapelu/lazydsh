/**
 * Word-Level Diff Rendering
 *
 * Produces colored diff output with intra-line change highlighting.
 * Ported from pi-coding-agent's diff.js using the `diff` package.
 */
import * as Diff from "diff";
import { fg, inverse } from "./theme.ts";

/** Parse a diff line into prefix, line number, and content */
function parseDiffLine(line: string): { prefix: string; lineNum: string; content: string } | null {
  const match = line.match(/^([+-\s])(\s*\d*)\s(.*)$/);
  if (!match) return null;
  return { prefix: match[1], lineNum: match[2], content: match[3] };
}

/** Replace tabs with spaces for consistent rendering */
function replaceTabs(text: string): string {
  return text.replace(/\t/g, "   ");
}

/** Compute word-level diff and render with inverse on changed parts */
function renderIntraLineDiff(
  oldContent: string,
  newContent: string,
): { removedLine: string; addedLine: string } {
  // Find common leading whitespace
  let commonIndentLength = 0;
  while (
    commonIndentLength < oldContent.length &&
    commonIndentLength < newContent.length &&
    oldContent[commonIndentLength] === newContent[commonIndentLength] &&
    /\s/.test(oldContent[commonIndentLength])
  ) {
    commonIndentLength++;
  }
  const commonIndent = oldContent.slice(0, commonIndentLength);

  const wordDiff = Diff.diffWords(
    oldContent.slice(commonIndentLength),
    newContent.slice(commonIndentLength),
  );

  let removedLine = commonIndent;
  let addedLine = commonIndent;
  let isFirstRemoved = true;
  let isFirstAdded = true;

  for (const part of wordDiff) {
    if (part.removed) {
      let value = part.value;
      // Strip leading whitespace from first removed part
      if (isFirstRemoved) {
        const leadingWs = value.match(/^(\s*)/)?.[1] || "";
        value = value.slice(leadingWs.length);
        removedLine += leadingWs;
        isFirstRemoved = false;
      }
      if (value) {
        removedLine += inverse(value);
      }
    } else if (part.added) {
      let value = part.value;
      // Strip leading whitespace from first added part
      if (isFirstAdded) {
        const leadingWs = value.match(/^(\s*)/)?.[1] || "";
        value = value.slice(leadingWs.length);
        addedLine += leadingWs;
        isFirstAdded = false;
      }
      if (value) {
        addedLine += inverse(value);
      }
    } else {
      removedLine += part.value;
      addedLine += part.value;
    }
  }
  return { removedLine, addedLine };
}

/**
 * Render a unified diff string with colored lines and intra-line change highlighting.
 * - Context lines: dim
 * - Removed lines: red with inverse on changed words
 * - Added lines: green with inverse on changed words
 */
export function renderDiff(diffText: string, _options: {} = {}): string {
  const lines = diffText.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const parsed = parseDiffLine(line);
    if (!parsed) {
      result.push(fg.toolDiffContext(line));
      i++;
      continue;
    }

    if (parsed.prefix === "-") {
      // Collect consecutive removed lines
      const removedLines: { lineNum: string; content: string }[] = [];
      while (i < lines.length) {
        const p = parseDiffLine(lines[i]);
        if (!p || p.prefix !== "-") break;
        removedLines.push({ lineNum: p.lineNum, content: p.content });
        i++;
      }
      // Collect consecutive added lines
      const addedLines: { lineNum: string; content: string }[] = [];
      while (i < lines.length) {
        const p = parseDiffLine(lines[i]);
        if (!p || p.prefix !== "+") break;
        addedLines.push({ lineNum: p.lineNum, content: p.content });
        i++;
      }

      // Intra-line diff only for single-line changes (single removed + single added)
      if (removedLines.length === 1 && addedLines.length === 1) {
        const removed = removedLines[0];
        const added = addedLines[0];
        const { removedLine, addedLine } = renderIntraLineDiff(
          replaceTabs(removed.content),
          replaceTabs(added.content),
        );
        result.push(fg.toolDiffRemoved(`-${removed.lineNum} ${removedLine}`));
        result.push(fg.toolDiffAdded(`+${added.lineNum} ${addedLine}`));
      } else {
        // Show all removed then all added
        for (const removed of removedLines) {
          result.push(fg.toolDiffRemoved(`-${removed.lineNum} ${replaceTabs(removed.content)}`));
        }
        for (const added of addedLines) {
          result.push(fg.toolDiffAdded(`+${added.lineNum} ${replaceTabs(added.content)}`));
        }
      }
    } else if (parsed.prefix === "+") {
      // Standalone added line (no corresponding removed)
      result.push(fg.toolDiffAdded(`+${parsed.lineNum} ${replaceTabs(parsed.content)}`));
      i++;
    } else {
      // Context line
      result.push(fg.toolDiffContext(` ${parsed.lineNum} ${replaceTabs(parsed.content)}`));
      i++;
    }
  }
  return result.join("\n");
}

/** Color tokens for diff rendering (used by theme) */
export const diffColors = {
  toolDiffContext: "toolDiffContext",
  toolDiffRemoved: "toolDiffRemoved",
  toolDiffAdded: "toolDiffAdded",
};
