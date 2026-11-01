import type {
  ProjectRequirementsResponseWire,
  RequirementItemWire,
  RequirementWire,
} from "../../../../src/features/checklists/model/requirement-types";
import type { HeadStatusWire } from "../../../../src/features/checklists/model/project-run-types";

/* Wire fixtures for Project requirements and Project QA runs, shaped exactly
 * like docs/design/project-requirements.md sections 2.1 to 2.5. */

export const DP_ID = "dp-1";
export const SHA_FE = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
export const SHA_BE = "e4f5a6b7c8d90123456789abcdef0123456789ab";
export const SHA_BE_NEW = "ffffeeee00001111222233334444555566667777";

export function itemWire(overrides: Partial<RequirementItemWire> = {}): RequirementItemWire {
  return {
    id: "item-1",
    position: 0,
    title: "As a shopper, I can pay with a saved card",
    acceptanceCriteria: "Given a saved card\nWhen I pay\nThen the order is confirmed",
    verificationType: "manual",
    testIdentifier: null,
    progress: "todo",
    progressBy: null,
    progressAt: null,
    rowVersion: 1,
    canSetProgress: true,
    ...overrides,
  };
}

export function requirementWire(overrides: Partial<RequirementWire> = {}): RequirementWire {
  return {
    id: "req-1",
    kind: "functional",
    deliveryProjectId: DP_ID,
    workspaceId: "ws-1",
    name: "Checkout with saved cards",
    description: "Returning shoppers pay in one tap.",
    version: 1,
    archivedAt: null,
    createdBy: "user-lead",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    legacyChecklistId: null,
    items: [itemWire(), itemWire({ id: "item-2", position: 1, title: "As a shopper, I can save a card", progress: "done" })],
    progressCounts: { todo: 1, in_progress: 0, done: 1 },
    ...overrides,
  };
}

export function systemRequirementWire(overrides: Partial<RequirementWire> = {}): RequirementWire {
  return requirementWire({
    id: "req-sys",
    kind: "system",
    name: "Release smoke test",
    description: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    legacyChecklistId: "cl-1",
    items: [itemWire({ id: "sys-1", title: "Checkout works", acceptanceCriteria: null, verificationType: "playwright", testIdentifier: "e2e/checkout.spec.ts" })],
    progressCounts: { todo: 1, in_progress: 0, done: 0 },
    ...overrides,
  });
}

export function projectRequirementsWire(
  overrides: Partial<ProjectRequirementsResponseWire> = {},
): ProjectRequirementsResponseWire {
  return {
    deliveryProject: { id: DP_ID, name: "storefront", groupId: "ws-1" },
    requirements: [requirementWire(), systemRequirementWire()],
    permissions: { canManage: true, canSetProgress: true },
    ...overrides,
  };
}

export function headWire(overrides: Partial<HeadStatusWire> = {}): HeadStatusWire {
  return {
    projectId: "proj-fe",
    repoFullName: "tone/storefront-web",
    runSha: SHA_FE,
    currentSha: SHA_FE,
    moved: false,
    ...overrides,
  };
}

export function runItemWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "run-item-1",
    position: 0,
    title: "As a shopper, I can pay with a saved card",
    acceptanceCriteria: "Given a saved card",
    requirementId: "req-1",
    requirementName: "Checkout with saved cards",
    requirementKind: "functional",
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
    progress: "done",
    ...overrides,
  };
}

export function projectRunWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "prun-1",
    scope: "project",
    deliveryProjectId: DP_ID,
    deliveryProjectName: "storefront",
    status: "open",
    createdBy: { id: "user-qa", login: "ana-qa" },
    createdAt: "2026-10-01T09:00:00.000Z",
    signoff: null,
    repositories: [headWire(), headWire({ projectId: "proj-be", repoFullName: "tone/orders-api", runSha: SHA_BE, currentSha: SHA_BE })],
    stale: false,
    requirementsChanged: false,
    items: [
      runItemWire(),
      runItemWire({ id: "run-item-2", position: 1, title: "Checkout works", requirementId: "req-sys", requirementName: "Release smoke test", requirementKind: "system", progress: "todo" }),
    ],
    permissions: { canSetVerification: true, canSignOff: true, canReopen: false, canDispatch: true },
    ...overrides,
  };
}
