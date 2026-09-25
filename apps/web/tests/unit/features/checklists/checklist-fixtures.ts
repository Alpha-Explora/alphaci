import type {
  QaChecklist,
  QaChecklistItem,
} from "../../../../src/features/checklists/model/checklist-types";

export function checklistItem(
  position: number,
  overrides: Partial<QaChecklistItem> = {},
): QaChecklistItem {
  return {
    id: `item-${position}`,
    position,
    title: `Check ${position + 1}`,
    description: null,
    targetPersona: "all",
    verificationType: "manual",
    testIdentifier: null,
    ...overrides,
  };
}

export function checklist(overrides: Partial<QaChecklist> = {}): QaChecklist {
  return {
    id: "cl-1",
    workspaceId: "ws-1",
    name: "Release smoke test",
    description: "Before every promotion.",
    version: 3,
    archivedAt: null,
    createdBy: "user-1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    items: [
      checklistItem(0, {
        title: "Checkout works",
        targetPersona: "qa",
        verificationType: "playwright",
        testIdentifier: "e2e/checkout.spec.ts",
      }),
      checklistItem(1, { title: "Totals add up", targetPersona: "developer" }),
    ],
    sharedProjectIds: ["project-1"],
    ...overrides,
  };
}

/** A 409/403/404 shaped like the ApiError request() throws. */
export function apiError(status: number, message?: string) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    status,
    details: message ? { message } : undefined,
  });
}
