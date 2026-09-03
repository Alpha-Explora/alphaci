export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function dashboardShortcutHref(key: string): string | null {
  if (key === "n") return "/workflows?tab=setup";
  if (key === "w") return "/workflows?tab=current";
  if (key === "r") return "/runs";
  return null;
}
