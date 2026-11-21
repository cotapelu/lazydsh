/**
 * Model cycling
 *
 * Ctrl+P / Shift+Ctrl+P walk the route through the providers the user can
 * authenticate against. Pure so the wrap-around and single-provider cases are
 * testable without a TUI.
 */

/** The provider after moving `direction` steps around `order`, wrapping. */
export function nextProvider(
  order: readonly string[],
  current: string,
  direction: 1 | -1,
): string | undefined {
  if (order.length === 0) return undefined;
  if (order.length === 1) return order[0];
  const index = order.indexOf(current);
  // An unknown current provider starts the walk from the top.
  const from = index === -1 ? 0 : index;
  return order[(from + direction + order.length) % order.length];
}
