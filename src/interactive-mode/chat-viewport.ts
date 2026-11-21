/**
 * Chat Viewport Layout
 *
 * Fullscreen transcript and fixed input-dock layout ported from pi-coding-agent.
 * Layout: Header → Transcript (scroll) → Pending → Status → Widgets → Editor → Footer
 */
import {
  ScrollView,
  VStack,
  type Component,
  type ScrollViewScrollbar,
} from "@earendil-works/pi-tui";

export interface ChatViewportOptions {
  /** The main transcript document (scrollable) */
  document: Component;
  /** Pending messages queue (below transcript) */
  pendingMessages: Component;
  /** Status indicators (working/retry/compaction) */
  status: Component;
  /** Widgets above editor (extension widgets) */
  widgetsAbove?: Component;
  /** The prompt editor */
  editor: Component;
  /** Widgets below editor (extension widgets) */
  widgetsBelow?: Component;
  /** Footer component */
  footer: Component;
  /** Scrollbar mode */
  scrollbar?: ScrollViewScrollbar;
  /** Custom scrollbar track style */
  scrollbarTrackStyle?: (text: string) => string;
  /** Custom scrollbar thumb style */
  scrollbarThumbStyle?: (text: string) => string;
}

export interface ChatViewport {
  /** The scrollable transcript view */
  transcript: ScrollView;
  /** Root layout component */
  root: VStack;
}

/**
 * Creates the standard chat viewport layout.
 * Used in fullscreen TUI mode.
 */
export function createChatViewport(options: ChatViewportOptions): ChatViewport {
  const {
    document,
    pendingMessages,
    status,
    widgetsAbove,
    editor,
    widgetsBelow,
    footer,
    scrollbar = "auto",
    scrollbarTrackStyle,
    scrollbarThumbStyle,
  } = options;

  // Transcript area with follow-to-end behavior
  const transcript = new ScrollView(document, {
    follow: "end",
    primary: true,
    overscroll: "chain",
    scrollbar,
    ...(scrollbarTrackStyle === undefined ? {} : { scrollbarTrackStyle }),
    ...(scrollbarThumbStyle === undefined ? {} : { scrollbarThumbStyle }),
  });

  // Fixed dock at bottom: pending messages → status → widgets → editor → footer
  const dock = new VStack([
    { component: pendingMessages, shrink: 1, minSize: 0 },
    { component: status, shrink: 1, minSize: 0 },
    ...(widgetsAbove === undefined ? [] : [{ component: widgetsAbove, shrink: 1, minSize: 0 }]),
    { component: editor, shrink: 1, minSize: 3 },
    ...(widgetsBelow === undefined ? [] : [{ component: widgetsBelow, shrink: 1, minSize: 0 }]),
    { component: footer, shrink: 1, minSize: 0 },
  ]);

  // Root layout: transcript grows, dock stays fixed at bottom
  const root = new VStack([
    { component: transcript, basis: 0, grow: 1, shrink: 1, minSize: 1 },
    { component: dock, basis: "auto", grow: 0, shrink: 1, minSize: 1 },
  ]);

  return { transcript, root };
}
