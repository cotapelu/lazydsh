/**
 * DSH Tool Presentation
 *
 * Maps the provider-neutral render intents declared by DSH tools
 * (`@deepseek-ai/dsh-tools`' `ToolCallView` / `ToolResultView`) onto pi-tui
 * components. This is lazydsh's equivalent of pi-coding-agent's
 * `core/tools/renderers`: the tools own the *intent*, this module owns the
 * pixels. No tool name is special-cased here.
 *
 * The tool definition is read from the DSH registry (`ctx.tools.get`), so the
 * live path and the session-log replay path produce identical cards.
 */

import { Container, Image, MouseRegion, Text, type Component } from "@earendil-works/pi-tui";
import type { ContentBlock, ImageBlock } from "@deepseek-ai/dsh-llm";
import type { ToolResult } from "@deepseek-ai/dsh-tools";

/** pi-tui's Container takes no constructor arguments. */
function stack(children: Component[]): Container {
  const container = new Container();
  for (const child of children) container.addChild(child);
  return container;
}

/** One image a card can show, already resolved from its durable reference. */
export interface ResolvedImage {
  data: string;
  mediaType: string;
}

/**
 * Read an image block's bytes. DSH image content blocks are durable references
 * into the attachment store, so the presenter asks the UI layer (which owns
 * `ctx.attachments`) for the bytes rather than reading them itself.
 */
export type ImageResolver = (
  block: ImageBlock,
) => Promise<ResolvedImage> | ResolvedImage | undefined;

function imageBlocks(content: readonly ContentBlock[]): ImageBlock[] {
  return content.filter((block): block is ImageBlock => block.type === "image");
}

export function renderImage(block: ResolvedImage, widthCells: number): Component {
  return new Image(
    block.data,
    block.mediaType,
    { fallbackColor: (text: string) => theme.fg("toolOutput", text) },
    { maxWidthCells: widthCells },
  );
}

import type {
  DiffCallView,
  DiffResultView,
  FileDiff,
  GenericCallView,
  GenericResultView,
  ReadResultView,
  SearchResultView,
  TerminalCallView,
  TerminalResultView,
  ToolCallKind,
  ToolCallView,
  ToolResultView,
  WebResultView,
} from "@deepseek-ai/dsh-tools";
import { theme } from "./theme/theme.ts";
import { renderDiff } from "./diff.ts";
import { highlightCode } from "./highlight.ts";

/** Lines shown when a text result is collapsed. */
const PREVIEW_LINES = 10;

const KIND_ICONS: Record<ToolCallKind, string> = {
  read: "◇",
  edit: "△",
  delete: "✕",
  move: "→",
  search: "⌕",
  execute: "❯",
  fetch: "↓",
  other: "•",
};

function iconFor(kind: ToolCallKind | undefined): string {
  return kind === undefined ? KIND_ICONS.other : (KIND_ICONS[kind] ?? KIND_ICONS.other);
}

function textOf(content: readonly ContentBlock[]): string {
  return content
    .filter((block): block is ContentBlock & { type: "text" } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function relPath(path: string, cwd: string): string {
  if (!path.startsWith("/")) return path;
  return path.startsWith(cwd + "/") ? path.slice(cwd.length + 1) : path;
}

/** Pending card: title, icon, salient input, and follow-along locations. */
function renderGenericCall(view: GenericCallView, cwd: string): Component {
  const rows: Component[] = [];
  rows.push(new Text(`${theme.fg("muted", iconFor(view.kind))} ${theme.bold(view.title)}`, 0, 0));
  if (view.content?.length) {
    const body = textOf(view.content);
    if (body.trim()) rows.push(new Text(theme.fg("toolOutput", body), 0, 0));
  }
  if (view.rawInput !== undefined) {
    const raw =
      typeof view.rawInput === "string" ? view.rawInput : JSON.stringify(view.rawInput, null, 2);
    if (raw.trim()) rows.push(new Text(theme.fg("toolOutput", raw), 0, 0));
  }
  if (view.locations?.length) {
    const files = view.locations
      .map((location) => relPath(location.path, cwd) + (location.line ? `:${location.line}` : ""))
      .join(", ");
    if (files) rows.push(new Text(theme.fg("muted", files), 0, 0));
  }
  return stack(rows);
}

/** One file diff, rendered as a unified diff with intra-line highlighting. */
function renderFileDiff(diff: FileDiff, _cwd: string): Component {
  const header = new Text(
    theme.bold(relPath(diff.path, "")) + theme.fg("muted", diff.oldText === null ? " (new)" : ""),
    0,
    0,
  );
  const oldText = diff.oldText ?? "";
  const body = renderDiff(diffText(oldText, diff.newText), {});
  return stack([header, new Text(body, 0, 0)]);
}

/** Minimal unified diff text (old → new), the input {@link renderDiff} expects. */
function diffText(oldText: string, newText: string): string {
  const oldLines = oldText.length > 0 ? oldText.split("\n") : [];
  const newLines = newText.length > 0 ? newText.split("\n") : [];
  const rows: string[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let index = 0; index < max; index++) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];
    if (oldLine === newLine) rows.push(`  ${oldLine}`);
    else {
      if (oldLine !== undefined) rows.push(`-${oldLine}`);
      if (newLine !== undefined) rows.push(`+${newLine}`);
    }
  }
  return rows.join("\n");
}

function renderDiffCall(view: DiffCallView, cwd: string): Component {
  return stack(view.diffs.map((diff) => renderFileDiff(diff, cwd)));
}

function renderDiffResult(view: DiffResultView, cwd: string): Component {
  return renderDiffCall(
    { card: "diff", title: view.title ?? "", diffs: view.diffs, locations: [] },
    cwd,
  );
}

/** Terminal card: the command as title, its output, and an exit-status pill. */
export function renderTerminalCard(view: TerminalCallView, cwd: string): Component {
  const rows: Component[] = [];
  rows.push(new Text(theme.fg("bashMode", theme.bold(`$ ${view.title}`)), 0, 0));
  if (view.description) rows.push(new Text(theme.fg("muted", view.description), 0, 0));
  const directory = view.cwd === undefined ? cwd : relPath(view.cwd, cwd);
  if (directory) rows.push(new Text(theme.fg("muted", directory), 0, 0));
  return stack(rows);
}

export function renderTerminalResult(view: TerminalResultView, expanded: boolean): Component {
  const rows: Component[] = [];
  if (view.title) rows.push(new Text(theme.fg("bashMode", theme.bold(view.title)), 0, 0));
  const output = view.output ?? "";
  const lines = output.replace(/\n+$/, "").split("\n");
  const display = expanded ? lines : lines.slice(-PREVIEW_LINES);
  const hidden = lines.length - display.length;
  let body = display.map((line) => theme.fg("muted", line)).join("\n");
  if (hidden > 0) body += `${theme.fg("muted", `\n... ${hidden} more lines`)}`;
  if (body.trim()) rows.push(new Text(body, 0, 0));
  if (view.signal !== undefined)
    rows.push(new Text(theme.fg("warning", `(killed by ${view.signal})`), 0, 0));
  else if (view.exitCode !== undefined)
    rows.push(
      new Text(
        view.exitCode === 0
          ? theme.fg("success", `(exit ${view.exitCode})`)
          : theme.fg("error", `(exit ${view.exitCode})`),
        0,
        0,
      ),
    );
  return stack(rows);
}

/** Read card: line-numbered, syntax-highlighted window of a file. */
function renderReadResult(view: ReadResultView, expanded: boolean): Component {
  const rows: Component[] = [];
  if (view.title) rows.push(new Text(theme.bold(view.title), 0, 0));
  const source = view.lines.map((line) => `${line.number}\t${line.text}`).join("\n");
  const highlighted =
    view.lang === undefined ? source.split("\n") : highlightCode(source, view.lang);
  const gutter =
    highlighted.length > 0 ? String(view.lines[view.lines.length - 1]?.number ?? 1).length : 1;
  const rowsToShow = expanded ? view.lines : view.lines.slice(0, PREVIEW_LINES);
  const hidden = view.lines.length - rowsToShow.length;
  const numberWidth = Math.max(gutter, 1);
  const body = rowsToShow
    .map(
      (line, index) =>
        `${String(line.number).padStart(numberWidth)} ${highlighted[index] ?? line.text}`,
    )
    .join("\n");
  rows.push(new Text(body, 0, 0));
  const footer =
    view.totalLines > view.lines.length ? ` ${view.lines.length} of ${view.totalLines} lines` : "";
  if (hidden > 0) rows.push(new Text(theme.fg("muted", `... ${hidden} more lines${footer}`), 0, 0));
  else if (footer) rows.push(new Text(theme.fg("muted", footer.trim()), 0, 0));
  return stack(rows);
}

/** Search card: matches grouped by file, or a flat path list. */
function renderSearchResult(view: SearchResultView, expanded: boolean): Component {
  const rows: Component[] = [];
  if (view.title) rows.push(new Text(theme.bold(view.title), 0, 0));
  if (view.shape === "paths") {
    const paths = expanded ? view.paths : view.paths.slice(0, PREVIEW_LINES);
    for (const path of paths) rows.push(new Text(theme.fg("toolOutput", path), 0, 0));
    if (view.paths.length > paths.length)
      rows.push(
        new Text(theme.fg("muted", `... ${view.paths.length - paths.length} more paths`), 0, 0),
      );
  } else {
    const files = expanded ? view.files : view.files.slice(0, PREVIEW_LINES);
    for (const file of files) {
      rows.push(new Text(theme.fg("muted", file.path), 0, 0));
      for (const match of expanded ? file.matches : file.matches.slice(0, PREVIEW_LINES))
        rows.push(
          new Text(
            `  ${theme.fg("muted", String(match.lineNumber))} ${theme.fg("toolOutput", match.line)}`,
            0,
            0,
          ),
        );
    }
    if (view.files.length > files.length)
      rows.push(
        new Text(theme.fg("muted", `... ${view.files.length - files.length} more files`), 0, 0),
      );
  }
  if (view.truncated)
    rows.push(new Text(theme.fg("warning", `capped · ${view.total} total`), 0, 0));
  return stack(rows);
}

/** Web card: cited sources, a provider answer, or a fetch summary. */
function renderWebResult(view: WebResultView): Component {
  const rows: Component[] = [];
  if (view.title) rows.push(new Text(theme.bold(view.title), 0, 0));
  if (view.kind === "search") {
    if (view.answer?.trim()) rows.push(new Text(theme.fg("toolOutput", view.answer), 0, 0));
    for (const source of view.sources)
      rows.push(
        new Text(
          `${theme.fg("muted", "•")} ${theme.fg("mdLink", source.title ?? source.url)}\n  ${theme.fg("muted", source.url)}`,
          0,
          0,
        ),
      );
    if (view.truncated) rows.push(new Text(theme.fg("warning", "sources capped"), 0, 0));
  } else {
    rows.push(
      new Text(
        `${theme.fg("success", String(view.statusCode))} ${theme.fg("mdLink", view.url)}`,
        0,
        0,
      ),
    );
    if (view.truncated) rows.push(new Text(theme.fg("warning", "body capped"), 0, 0));
  }
  return stack(rows);
}

/**
 * Resolve a tool's pending view. `undefined` means the tool declared no
 * presenter (or the definition is unavailable), and the caller falls back to
 * the generic title-plus-args card.
 */
export function presentCall(
  definition: { presentCall?: (args: unknown) => ToolCallView | undefined } | undefined,
  args: unknown,
  cwd: string,
): Component | undefined {
  if (definition?.presentCall === undefined) return undefined;
  let view: ToolCallView | undefined;
  try {
    view = definition.presentCall(args);
  } catch {
    return undefined;
  }
  if (view === undefined) return undefined;
  switch (view.card) {
    case "terminal":
      return renderTerminalCard(view, cwd);
    case "diff":
      return renderDiffCall(view, cwd);
    default:
      return renderGenericCall(view, cwd);
  }
}

/**
 * Resolve a tool's completed view. Falls back to the raw model-facing result
 * content when the tool declares no presenter or declines to project one.
 */
export function presentResult(
  definition:
    | { presentResult?: (args: unknown, result: ToolResult) => ToolResultView | undefined }
    | undefined,
  args: unknown,
  result: ToolResult,
  cwd: string,
  options: { expanded: boolean; showImages: boolean; imageWidthCells: number },
): { body: Component | undefined; images: ResolvedImage[] } {
  // Images are resolved by the caller through `resolveImages`: this module is
  // synchronous and must stay replay-safe.
  const images: ResolvedImage[] = [];
  if (definition?.presentResult === undefined)
    return { body: textCard(result.content, options.expanded), images };
  let view: ToolResultView | undefined;
  try {
    view = definition.presentResult(args, result);
  } catch {
    return { body: textCard(result.content, options.expanded), images };
  }
  if (view === undefined) return { body: textCard(result.content, options.expanded), images };
  let body: Component;
  switch (view.card) {
    case "terminal":
      body = renderTerminalResult(view, options.expanded);
      break;
    case "diff":
      body = renderDiffResult(view, cwd);
      break;
    case "read":
      body = renderReadResult(view, options.expanded);
      break;
    case "search":
      body = renderSearchResult(view, options.expanded);
      break;
    case "web":
      body = renderWebResult(view);
      break;
    default: {
      const generic: GenericResultView = view;
      body =
        generic.content !== undefined && generic.content.length > 0
          ? new Text(theme.fg("toolOutput", textOf(generic.content)), 0, 0)
          : textCard(result.content, options.expanded)!;
      break;
    }
  }
  return { body, images };
}

/** Raw result text with the usual collapsed preview. */
export function textCard(
  content: readonly ContentBlock[],
  expanded: boolean,
): Component | undefined {
  const output = textOf(content);
  if (!output.trim()) return undefined;
  const lines = output.replace(/\n+$/, "").split("\n");
  const display = expanded ? lines : lines.slice(-PREVIEW_LINES);
  const hidden = lines.length - display.length;
  let text = display.map((line) => theme.fg("toolOutput", line)).join("\n");
  if (hidden > 0) text += `${theme.fg("muted", `\n... ${hidden} more lines`)}`;
  return new Text(text, 0, 0);
}

/** Fallback pending card when a tool declares no presenter. */
export function genericCallFallback(toolName: string, args: unknown, expanded: boolean): Component {
  let raw: string;
  try {
    raw = typeof args === "string" ? args : JSON.stringify(args, null, 2);
  } catch {
    raw = String(args);
  }
  const lines = raw.length > 400 && !expanded ? raw.slice(0, 400) + " …" : raw;
  return new Text(
    theme.fg("toolTitle", theme.bold(toolName)) + "\n" + theme.fg("toolOutput", lines),
    0,
    0,
  );
}

/**
 * Resolve a result's image references through the caller's resolver.
 * Returns [] when the resolver is absent or a reference cannot be read.
 */
export async function resolveImages(
  content: readonly ContentBlock[],
  resolve: ImageResolver,
  showImages = true,
): Promise<ResolvedImage[]> {
  if (!showImages) return [];
  const resolved: ResolvedImage[] = [];
  for (const block of imageBlocks(content)) {
    try {
      const image = await resolve(block);
      if (image !== undefined) resolved.push(image);
    } catch {
      // An unreadable attachment shows as text, never as a broken card.
    }
  }
  return resolved;
}

/** Wrap a card so a left click toggles expansion. */
export function clickable(component: Component, onToggle: () => void): Component {
  return new MouseRegion(component, (event) => {
    if (event.type !== "click" || event.button !== "left") return undefined;
    onToggle();
    return { handled: true };
  });
}

export type { ToolCallView, ToolResultView };
