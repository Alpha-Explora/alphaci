/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice so a consumer pulls in one action
 * rather than the whole domain:
 *   - `@/features/checklists/manage`  — the team-level list and editor
 *   - `@/features/checklists/project` — the project's Checklists tab
 *   - `@/features/checklists/items`   — read-only item rendering
 *   - `@/features/checklists/studio`  — the project's QA Studio tab
 *   - `@/features/checklists/returned` — the Overview's "My QA items" card
 *   - `@/features/checklists/report`  — the printable QA report page
 *   - `@/features/checklists/requirements` — a Project's requirements and QA workspace */
export type {
  ChecklistShareTarget,
  ChecklistTargetPersona,
  ChecklistVerificationType,
  QaChecklist,
  QaChecklistItem,
} from "./model/checklist-types";

export {
  QA_CHECKLISTS_SECTION,
  checklistManageHref,
  itemCountLabel,
  targetPersonaLabel,
  verificationTypeLabel,
} from "./model/checklist-rules";

export { qaStudioHref } from "./model/qa-report-rules";
/* Where a repository's QA happens (its Project, or the repository itself). */
export { qaScopeFromFolder, REPOSITORY_SCOPE, type QaScope } from "./model/qa-scope";
/* Whether a repository's Checklists tab carries the full "My QA items" list
 * (no Project to send the viewer to). */
export { checklistsTabShowsMyItems } from "./model/my-qa-items-summary-rules";
/* Project requirement counts for the team's Project cards. */
export { canManageRequirements, requirementCountLabel } from "./model/requirement-rules";
export { requirementsRepository } from "./data/requirements-repository";
export { roleCanStartRun } from "./model/qa-run-rules";
/* Team-level checklist reads and share edits, for features that show a
 * team's checklists in their own context (the Teams project explorer). */
export { checklistsRepository } from "./data/checklists-repository";

export type {
  QaRun,
  QaRunItem,
  QaRunItemStatus,
  QaReturnedItem,
} from "./model/qa-run-types";
