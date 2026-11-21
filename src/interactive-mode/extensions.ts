import { Container, Text } from "@earendil-works/pi-tui";
import { dim } from "./theme/theme.ts";

/** Extension widget interface. */
export interface ExtensionWidget {
  /** Unique identifier for the widget. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** The component to render. */
  component: Container;
  /** Position: "above" or "below" editor. */
  position: "above" | "below";
  /** Optional priority for ordering (lower = first). */
  priority?: number;
  /**
   * Optional one-line status for the footer's extension row. Returning
   * undefined (or omitting the hook) removes the widget's status.
   */
  status?: () => string | undefined;
}

/** Registry of extension widgets. */
export class ExtensionWidgetRegistry {
  private widgets: Map<string, ExtensionWidget> = new Map();

  /** Register a new widget. */
  register(widget: ExtensionWidget): void {
    if (this.widgets.has(widget.id)) {
      throw new Error(`Widget with id "${widget.id}" already registered`);
    }
    this.widgets.set(widget.id, widget);
  }

  /** Unregister a widget. */
  unregister(id: string): void {
    this.widgets.delete(id);
  }

  /** Get all widgets for a position, sorted by priority. */
  getWidgets(position: "above" | "below"): ExtensionWidget[] {
    return Array.from(this.widgets.values())
      .filter((w) => w.position === position)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /** Get all registered widgets. */
  getAll(): ExtensionWidget[] {
    return Array.from(this.widgets.values());
  }
}

/** Create a container for extension widgets at a specific position. */
export function createExtensionWidgetContainer(
  registry: ExtensionWidgetRegistry,
  position: "above" | "below",
): Container {
  const container = new Container();
  const widgets = registry.getWidgets(position);

  if (widgets.length > 0) {
    container.addChild(new Text(dim(`── Extensions (${position}) ──`), 0, 0));
    for (const widget of widgets) {
      container.addChild(widget.component);
    }
  }

  return container;
}

/** Global widget registry instance. */
export const extensionWidgets = new ExtensionWidgetRegistry();
