/**
 * Skill Invocation Message Component
 *
 * Component that renders a skill invocation message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 * Only renders the skill block itself - user message is rendered separately.
 * Ported from pi-coding-agent's SkillInvocationMessageComponent.
 */

import { Box, Container, Markdown, MouseRegion, Text } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { keyText } from "../keybinding-hints.ts";

interface SkillBlock {
  name: string;
  content: string;
}

/**
 * Component that renders a skill invocation message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 * Only renders the skill block itself - user message is rendered separately.
 */
export class SkillInvocationMessageComponent extends Box {
  expanded = false;
  skillBlock: SkillBlock;
  markdownTheme: ReturnType<typeof getMarkdownTheme>;

  constructor(skillBlock: SkillBlock, markdownTheme = getMarkdownTheme(), outputPad = 1) {
    super(outputPad, 1, (t) => theme.bg("customMessageBg", t));
    this.skillBlock = skillBlock;
    this.markdownTheme = markdownTheme;
    this.updateDisplay();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.updateDisplay();
  }

  setOutputPad(outputPad: number): void {
    this.setPaddingX(outputPad);
  }

  invalidate(): void {
    super.invalidate();
    this.updateDisplay();
  }

  updateDisplay(): void {
    this.clear();
    const content = new Container();
    if (this.expanded) {
      // Expanded: label + skill name header + full content
      const label = theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m`);
      content.addChild(new Text(label, 0, 0));
      const header = `**${this.skillBlock.name}**\n\n`;
      content.addChild(
        new Markdown(header + this.skillBlock.content, 0, 0, this.markdownTheme, {
          color: (text) => theme.fg("customMessageText", text),
        }),
      );
    } else {
      // Collapsed: single line - [skill] name (hint to expand)
      const line =
        theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m `) +
        theme.fg("customMessageText", this.skillBlock.name) +
        theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
      content.addChild(new Text(line, 0, 0));
    }
    this.addChild(
      new MouseRegion(content, (event) => {
        if (event.type !== "click" || event.button !== "left") return undefined;
        this.setExpanded(!this.expanded);
        return { handled: true };
      }),
    );
  }
}
