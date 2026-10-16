import type { AppRole } from "@/shared/api/contracts";

/**
 * The one view a persona gets on a Project's checklist. Not tabs: each role
 * works one part of the flow, so each sees only that part.
 *
 * - `author`: the Product owner (and an admin) writes the requirements and
 *   reads where every item stands.
 * - `developer`: the same checklist, moving each item To do, In progress
 *   or Done, with what QA sent back on top.
 * - `qa`: verifies the items on uat (the same run QA Studio shows).
 */
export type ChecklistView = "author" | "developer" | "qa";

/**
 * By role, as an allow-list: a role this build does not know (or none yet)
 * gets the developer's view, where the server's own flags decide what can be
 * changed, rather than an author's or a verifier's screen.
 */
export function checklistViewFor(appRole: AppRole | null | undefined): ChecklistView {
  if (appRole === "lead" || appRole === "admin") return "author";
  if (appRole === "qa") return "qa";
  return "developer";
}

/** The view's name, for the region a screen reader announces. */
export const CHECKLIST_VIEW_LABELS: Readonly<Record<ChecklistView, string>> = {
  author: "Requirements",
  developer: "Checklist",
  qa: "QA testing",
};
