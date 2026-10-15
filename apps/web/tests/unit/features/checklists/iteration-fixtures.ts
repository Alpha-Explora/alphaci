/** Iteration wire shapes, exactly as the Iterations phase 2 contract describes them. */

export const DELIVERED_AT = "2026-10-14T10:00:00.000Z";

export function currentWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iteration: {
      id: "it-3",
      deliveryProjectId: "dp-1",
      number: 3,
      goal: null,
      status: "active",
      startedAt: "2026-10-01T09:00:00.000Z",
      startedBy: { id: "u1", login: "pat" },
      deliveredAt: null,
      deliveredBy: null,
      signoffRunId: null,
    },
    canStartNext: false,
    deliveredRepositories: [],
    coveredRepositories: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", delivered: true, how: "merged" },
      { projectId: "proj-be", repoFullName: "tone/orders-api", delivered: false, how: null },
    ],
    canMergeAll: true,
    ...overrides,
  };
}


/** A delivered iteration: two repositories, one merged and one already in main. */
export function deliveredWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return currentWire({
    iteration: {
      ...(currentWire().iteration as Record<string, unknown>),
      status: "delivered",
      deliveredAt: DELIVERED_AT,
      deliveredBy: { id: "u2", login: "ana" },
      signoffRunId: "prun-1",
    },
    deliveredRepositories: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", uatHeadSha: "aaa", mergeSha: "abc1234ffff", prNumber: 12, how: "merged", at: DELIVERED_AT },
      { projectId: "proj-be", repoFullName: "tone/orders-api", uatHeadSha: "bbb", mergeSha: null, prNumber: null, how: "already_in_main", at: DELIVERED_AT },
    ],
    coveredRepositories: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", delivered: true, how: "merged" },
      { projectId: "proj-be", repoFullName: "tone/orders-api", delivered: true, how: "already_in_main" },
    ],
    canMergeAll: false,
    ...overrides,
  });
}

/** Delivered, seen by a Product owner the server lets start the next iteration. */
export function startableWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return deliveredWire({ canStartNext: true, ...overrides });
}

/** Delivered, seen by someone who waits (QA, a Developer): `canStartNext` is false. */
export function waitingWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return deliveredWire({ canStartNext: false, ...overrides });
}
