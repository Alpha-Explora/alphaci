import type {
  QaRun,
  QaRunItem,
  QaRunItemStatus,
  QaRunPermissions,
} from "../../../../src/features/checklists/model/qa-run-types";
import type { AppRole } from "../../../../src/shared/api/contracts";

const EMPTY_COUNTS: Record<QaRunItemStatus, number> = {
  pending: 0,
  in_progress: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  returned_to_dev: 0,
};

export function runItem(position: number, overrides: Partial<QaRunItem> = {}): QaRunItem {
  return {
    id: `ri-${position}`,
    runId: "run-1",
    position,
    title: `Check ${position + 1}`,
    description: null,
    targetPersona: "all",
    verificationType: "manual",
    testIdentifier: null,
    status: "pending",
    notes: null,
    defectSeverity: null,
    reproductionSteps: null,
    fixRequest: null,
    verifiedBy: null,
    verifiedAt: null,
    rowVersion: 1,
    canUpdate: true,
    previous: null,
    ...overrides,
  };
}

/** What the server would say this role may do on an open run. */
export function permissionsFor(role: AppRole): QaRunPermissions {
  return {
    canUpdateItems: true,
    canReturnToDev: role !== "member",
    canRequestRetest: role !== "qa",
    canSignOff: role !== "member",
    canReopen: role === "lead" || role === "admin",
  };
}

/** item.canUpdate as the server decides it: developer items for devs, qa items for QA. */
export function canUpdateFor(role: AppRole, persona: QaRunItem["targetPersona"]): boolean {
  if (persona === "developer") return role !== "qa";
  if (persona === "qa") return role !== "member";
  return true;
}

export function qaRun(overrides: Partial<QaRun> = {}): QaRun {
  const items = overrides.items ?? [
    runItem(0, { title: "Checkout works", targetPersona: "qa" }),
    runItem(1, { title: "Totals add up", targetPersona: "developer" }),
  ];
  const byStatus = { ...EMPTY_COUNTS };
  for (const item of items) byStatus[item.status] += 1;
  return {
    id: "run-1",
    projectId: "project-1",
    checklistId: "cl-1",
    checklistName: "Release smoke test",
    checklistVersion: 3,
    branch: "main",
    commitSha: "abc1234def5678",
    commitSource: "deployment",
    status: "open",
    createdBy: { id: "u-qa", login: "ana" },
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    summary: { total: items.length, byStatus, openDefects: 0, blockers: 0 },
    signoff: null,
    permissions: permissionsFor("qa"),
    ...overrides,
    items,
  };
}

/** A run as a given role sees it: permissions and per-item canUpdate from the server's rules. */
export function runAs(role: AppRole, overrides: Partial<QaRun> = {}): QaRun {
  const base = qaRun(overrides);
  return {
    ...base,
    permissions: permissionsFor(role),
    items: base.items.map((item) => ({ ...item, canUpdate: canUpdateFor(role, item.targetPersona) })),
  };
}
