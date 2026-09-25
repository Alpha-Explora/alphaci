/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice so a consumer pulls in one action
 * rather than the whole domain:
 *   - `@/features/checklists/manage`  — the team-level list and editor
 *   - `@/features/checklists/project` — the project's Checklists tab
 *   - `@/features/checklists/items`   — read-only item rendering
 *   - `@/features/checklists/studio`  — the project's QA Studio tab
 *   - `@/features/checklists/returned` — the Overview's "Returned by QA" card */
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

export type {
  QaRun,
  QaRunItem,
  QaRunItemStatus,
  QaReturnedItem,
} from "./model/qa-run-types";
