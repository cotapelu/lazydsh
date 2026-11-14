import {
  Input,
  Text,
  SelectList,
  matchesKey,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui";
import type { AskUserQuestionItem, AskUserQuestionAnswer } from "@deepseek-ai/dsh-user-questions";
import { selectionTheme } from "./picker.ts";
import { accent, dim, safeText } from "./theme.ts";

type Question = AskUserQuestionItem;
type Answer = AskUserQuestionAnswer["answers"][number];
type State = { index: number; selected: Set<number>; input: Input; answer?: Answer };

export class QuestionPanel implements Component {
  readonly capturesViewportInput = true;
  onAnswer?: (answer: AskUserQuestionAnswer) => void;
  onCancel?: () => void;
  private readonly questions: Question[];
  private readonly states: State[];
  private current = 0;
  private active = false;
  private readonly maxOptions: number;

  constructor(questions: Question[], maxOptions = 6) {
    if (!questions.length) throw new Error("No questions supplied");
    this.questions = questions;
    this.maxOptions = Math.max(1, maxOptions);
    this.states = questions.map(() => {
      const input = new Input({ prompt: accent("┃ "), placeholder: "Type your answer…" });
      input.onSubmit = () => this.confirm();
      return { index: 0, selected: new Set(), input };
    });
  }
  get focused() {
    return this.active;
  }
  set focused(value: boolean) {
    this.active = value;
    this.states.forEach((state, index) => {
      state.input.focused = value && index === this.current;
    });
  }
  invalidate() {
    this.states.forEach((state) => state.input.invalidate());
  }
  private get question() {
    return this.questions[this.current];
  }
  private get state() {
    return this.states[this.current];
  }
  private get customAllowed() {
    return this.question.intent?.kind !== "approval";
  }
  private get optionCount() {
    return (this.question.options?.length ?? 0) + (this.customAllowed ? 1 : 0);
  }
  private get editing() {
    return this.customAllowed && this.state.index === (this.question.options?.length ?? 0);
  }

  private switchQuestion(direction: number) {
    this.current = (this.current + direction + this.questions.length) % this.questions.length;
    this.focused = this.active;
  }
  private confirm() {
    const options = this.question.options ?? [];
    const state = this.state;
    const selected = this.question.multiSelect
      ? [...state.selected].map((index) => options[index].label)
      : state.index < options.length
        ? [options[state.index].label]
        : [];
    const custom = this.editing ? state.input.getValue().trim() : "";
    if (this.editing && !custom) return;
    if (!selected.length && !custom) return;
    state.answer = { id: this.question.id, selected, ...(custom ? { custom } : {}) };
    const next = this.states.findIndex((item) => !item.answer);
    if (next < 0) this.onAnswer?.({ answers: this.states.map((item) => item.answer!) });
    else {
      this.current = next;
      this.focused = this.active;
    }
  }
  handleInput(data: string) {
    if (matchesKey(data, "escape")) {
      if (this.current > 0) {
        this.current--;
        this.focused = this.active;
      } else this.onCancel?.();
      return;
    }
    if (matchesKey(data, "tab") || matchesKey(data, "shift+tab")) {
      this.switchQuestion(matchesKey(data, "shift+tab") ? -1 : 1);
      return;
    }
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      const direction = matchesKey(data, "up") ? -1 : 1;
      this.state.index = (this.state.index + direction + this.optionCount) % this.optionCount;
      this.state.answer = undefined;
      return;
    }
    if (matchesKey(data, "enter")) {
      this.confirm();
      return;
    }
    if (this.editing) {
      this.state.answer = undefined;
      this.state.input.handleInput(data);
      return;
    }
    if (this.question.multiSelect && data === " ") {
      this.toggle(this.state.index);
      return;
    }
    if (/^[1-9]$/.test(data) && Number(data) <= this.optionCount) {
      this.state.index = Number(data) - 1;
      this.state.answer = undefined;
      if (this.editing) return;
      if (this.question.multiSelect) this.toggle(this.state.index);
      else this.confirm();
    }
  }
  private toggle(index: number) {
    if (this.state.selected.has(index)) this.state.selected.delete(index);
    else this.state.selected.add(index);
    this.state.answer = undefined;
  }
  render(width: number): string[] {
    const text = (value: string) => new Text(value, 2, 0).render(width);
    const options = this.question.options ?? [];
    const labels = [
      ...options.map((option) => safeText(option.label)),
      ...(this.customAllowed ? ["Other"] : []),
    ];
    const lines = [...text(dim("Question")), "", ...text(safeText(this.question.question))];
    if (this.question.detail) lines.push(...text(dim(safeText(this.question.detail))));
    lines.push("");
    const list = new SelectList(
      labels.map((label, index) => {
        const checked =
          this.question.multiSelect && index < options.length
            ? this.state.selected.has(index)
              ? "[x] "
              : "[ ] "
            : "";
        return {
          value: String(index),
          label: `${index + 1}) ${checked}${label}`,
          description:
            options[index]?.description &&
            safeText(options[index].description!).replace(/\s+/g, " "),
        };
      }),
      this.maxOptions,
      selectionTheme,
    );
    list.setSelectedIndex(this.state.index);
    lines.push(
      ...list.render(Math.max(1, width - 4)).map((line) => truncateToWidth("  " + line, width)),
    );
    if (this.editing)
      lines.push(
        "",
        ...this.state.input
          .render(Math.max(1, width - 4))
          .map((line) => truncateToWidth("  " + line, width)),
      );
    lines.push("");
    const help = this.editing
      ? "type answer"
      : this.question.multiSelect
        ? "Space toggle"
        : `1–${Math.min(9, labels.length)} choose now`;
    lines.push(...text(dim(`${help} · ↑↓ move · Tab questions · Enter select · Esc back`)));
    return lines;
  }
}
