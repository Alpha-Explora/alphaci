import type {
  VisualChecksResponse,
  VisualSnapshot,
} from "../../../../../src/features/projects/detail/model/visual-check-types";

export const EVIDENCE_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

function path(kind: string, name: string): string {
  return `/projects/p1/workspace/visual/image?kind=${kind}&branch=uat&runId=77&name=${name}`;
}

/** A screenshot as the server reports it (image paths without the API prefix). */
export function shot(name: string, status: VisualSnapshot["status"]): VisualSnapshot {
  return {
    name,
    status,
    baselineUrl: status === "new" ? null : path("baseline", name),
    actualUrl: path("actual", name),
    diffUrl: status === "changed" ? path("diff", name) : null,
    baselineApprovedBy: null,
    baselineApprovedAt: null,
    inheritedFrom: null,
    approved: false,
  };
}

export function visualResponse(
  snapshots: VisualSnapshot[],
  overrides: Partial<Extract<VisualChecksResponse, { runId: number }>> = {},
): VisualChecksResponse {
  return {
    branch: "uat",
    runId: 77,
    commitSha: EVIDENCE_SHA,
    reportedAt: "2026-10-09T08:00:00.000Z",
    browser: "chromium",
    canApprove: false,
    snapshots,
    ...overrides,
  };
}

/** One changed screenshot (three images), one new (two), one that matched. */
export const MIXED = [shot("home-desktop.png", "changed"), shot("cart-mobile.png", "new"), shot("login-desktop.png", "passed")];

export const NOTHING_REPORTED: VisualChecksResponse = { branch: "uat", runId: null, canApprove: false, snapshots: [] };
