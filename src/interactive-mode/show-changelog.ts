import { Container } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";
import { ChangelogComponent } from "./changelog.ts";

/** Show the changelog panel. */
export function showChangelog(
  tui: TUI,
  showPanel: (panel: Container) => void,
  dismissPanel: () => void,
): void {
  const changelog = new ChangelogComponent();
  changelog.onCancel = dismissPanel;
  showPanel(changelog);
}
