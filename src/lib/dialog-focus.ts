/** Next tab stop inside a dialog. A focus outside the list is pulled back in. */
export function cycleTab<T>(items: readonly T[], current: T | null, shift: boolean): T | null {
  if (!items.length) return null;
  const index = current == null ? -1 : items.indexOf(current);
  if (shift) {
    const previous = index <= 0 ? items.length - 1 : index - 1;
    return items[previous] ?? null;
  }
  const next = index === -1 || index >= items.length - 1 ? 0 : index + 1;
  return items[next] ?? null;
}

const TABBABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Controls a keyboard user can reach inside a dialog. */
export function tabbable(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((node) => {
    if (node.tabIndex < 0 || node.hasAttribute("disabled")) return false;
    return node.getClientRects().length > 0;
  });
}
