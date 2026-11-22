/**
 * What Ctrl+C should do in the chat view. Only two states: clear the draft,
 * or interrupt the running turn. An idle press exits.
 */
export type CtrlCAction = "clear" | "interrupt" | "exit";

export function ctrlCAction(state: {
  /** The prompt or attachments contain unsaved input. */
  draft: boolean;
  /** A turn is generating (or otherwise live). */
  active: boolean;
}): CtrlCAction {
  if (state.draft) return "clear";
  if (state.active) return "interrupt";
  return "exit";
}
