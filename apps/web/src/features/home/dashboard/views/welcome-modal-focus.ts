export function queryFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => !node.hasAttribute("disabled"));
}

export function wrapFocus(event: KeyboardEvent, focusable: HTMLElement[]): void {
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function handleWelcomeModalKeyDown(
  event: KeyboardEvent,
  dialog: HTMLDivElement | null,
  onDismiss: () => void,
): void {
  if (event.key === "Escape") {
    onDismiss();
    return;
  }
  if (event.key !== "Tab" || !dialog) return;
  const focusable = queryFocusable(dialog);
  if (focusable.length === 0) return;
  wrapFocus(event, focusable);
}
