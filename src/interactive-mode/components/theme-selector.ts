/**
 * Theme Selector Component
 *
 * Simple theme picker with live preview.
 * Ported from pi-coding-agent's ThemeSelectorComponent.
 */

import { Container, SelectList } from "@earendil-works/pi-tui";
import { getAvailableThemes, getSelectListTheme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";

const THEME_SELECT_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32,
};

/**
 * The follow-terminal entry. Its value is the `"<light>/<dark>"` setting the
 * theme controller persists (real theme names never contain a slash, so the
 * selection string is unambiguous).
 */
interface AutoThemeOption {
  light: string;
  dark: string;
  /** Whether the controller's current setting is this kind of pair. */
  active: boolean;
}

function autoValue(option: AutoThemeOption): string {
  return `${option.light}/${option.dark}`;
}

/**
 * Component that renders a theme selector. `onSelect`/`onPreview` receive a
 * theme name, or the `"<light>/<dark>"` pair when the auto row is chosen.
 */
export class ThemeSelectorComponent extends Container {
  private selectList: SelectList;
  private onPreview: (themeName: string) => void;

  constructor(
    currentTheme: string,
    onSelect: (themeName: string) => void,
    onCancel: () => void,
    onPreview: (themeName: string) => void,
    autoOption?: AutoThemeOption,
  ) {
    super();
    this.onPreview = onPreview;

    // Get available themes and create select items
    const themes = getAvailableThemes();
    const themeItems = themes.map((name: string) => ({
      value: name,
      label: name,
      description: name === currentTheme ? "(current)" : undefined,
    }));

    // The auto row rides on top so it is reachable without scrolling.
    const autoItem =
      autoOption === undefined
        ? undefined
        : {
            value: autoValue(autoOption),
            label: "auto (follow terminal)",
            description: autoOption.active
              ? "(active)"
              : `light → ${autoOption.light} · dark → ${autoOption.dark}`,
          };
    const items = autoItem === undefined ? themeItems : [autoItem, ...themeItems];

    // Add top border
    this.addChild(new DynamicBorder());

    // Create selector
    this.selectList = new SelectList(items, 10, getSelectListTheme(), THEME_SELECT_LIST_LAYOUT);

    // Preselect current theme; the auto row when the setting is a pair.
    const currentIndex =
      autoOption?.active === true
        ? 0
        : Math.max(
            0,
            items.findIndex((item: { value: string }) => item.value === currentTheme),
          );

    this.selectList.setSelectedIndex(currentIndex);

    this.selectList.onSelect = (item) => {
      onSelect(item.value);
    };
    this.selectList.onCancel = () => {
      onCancel();
    };
    this.selectList.onSelectionChange = (item) => {
      this.onPreview(item.value);
    };

    this.addChild(this.selectList);

    // Add bottom border
    this.addChild(new DynamicBorder());
  }

  getSelectList(): SelectList {
    return this.selectList;
  }
}
