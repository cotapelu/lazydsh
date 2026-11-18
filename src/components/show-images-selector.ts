/**
 * Show Images Selector Component
 *
 * Renders a yes/no selector for whether images should be shown inline in the
 * terminal or replaced with a text placeholder.
 * Ported from pi-coding-agent's `show-images-selector.js`.
 */

import { Container, SelectList } from "@earendil-works/pi-tui";
import { getSelectListTheme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

const SHOW_IMAGES_SELECT_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32,
};

/**
 * Component that renders a show images selector with borders.
 */
export class ShowImagesSelectorComponent extends Container {
  private selectList: SelectList;

  constructor(currentValue: boolean, onSelect: (show: boolean) => void, onCancel: () => void) {
    super();
    const items = [
      { value: "yes", label: "Yes", description: "Show images inline in terminal" },
      { value: "no", label: "No", description: "Show text placeholder instead" },
    ];
    // Add top border
    this.addChild(new DynamicBorder());
    // Create selector
    this.selectList = new SelectList(
      items,
      5,
      getSelectListTheme(),
      SHOW_IMAGES_SELECT_LIST_LAYOUT,
    );
    // Preselect current value
    this.selectList.setSelectedIndex(currentValue ? 0 : 1);
    this.selectList.onSelect = (item) => {
      onSelect(item.value === "yes");
    };
    this.selectList.onCancel = () => {
      onCancel();
    };
    this.addChild(this.selectList);
    // Add bottom border
    this.addChild(new DynamicBorder());
  }

  getSelectList(): SelectList {
    return this.selectList;
  }
}
