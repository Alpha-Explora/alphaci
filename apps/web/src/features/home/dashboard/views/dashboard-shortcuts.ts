import { newProjectHref } from "../../model/home-rules";

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function dashboardShortcutHref(key: string): string | null {
  // The Projects page opens the New Project dialog only for a Product owner
  // or admin; anyone else simply lands on their team's Projects.
  if (key === "n") return newProjectHref();
  if (key === "w") return "/workflows?tab=current";
  if (key === "r") return "/runs";
  return null;
}
