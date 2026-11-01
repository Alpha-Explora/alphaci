/* Which key a role's shortcut answers lives in the model
 * (dashboardShortcutHref in home-layout-rules.ts); this is the DOM half. */
export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
