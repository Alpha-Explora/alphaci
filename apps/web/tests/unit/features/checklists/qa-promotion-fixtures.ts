import type { QaPromotionStatusWire } from "../../../../src/features/checklists/model/qa-promotion-types";

export const HEAD_SHA = "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432";

/** A wire promotion status, exactly as the contract describes it. */
export function promotionWire(overrides: Record<string, unknown> = {}): QaPromotionStatusWire {
  return {
    qaBranch: "uat",
    targetBranch: "main",
    headSha: HEAD_SHA,
    checklists: [
      { id: "cl-1", name: "Release smoke test", runId: "run-1", verdict: "APPROVED", runStatus: "signed_off", approvedForHead: true },
      { id: "cl-2", name: "Accessibility pass", runId: null, verdict: null, runStatus: null, approvedForHead: false },
    ],
    eligible: false,
    reasons: ["Accessibility pass has no QA run on uat @ 9f8e7d6."],
    pullRequest: { number: 42, url: "https://github.com/tone/storefront-web/pull/42", headSha: HEAD_SHA },
    canMerge: true,
    ...overrides,
  };
}

export function readyWire(overrides: Record<string, unknown> = {}): QaPromotionStatusWire {
  return promotionWire({
    checklists: [
      { id: "cl-1", name: "Release smoke test", runId: "run-1", verdict: "APPROVED", runStatus: "signed_off", approvedForHead: true },
    ],
    eligible: true,
    reasons: [],
    ...overrides,
  });
}

/** An ApiError-shaped rejection with a `details` body (code, message, reasons…). */
export function apiErrorWith(status: number, details?: Record<string, unknown>) {
  return Object.assign(new Error(`Request failed with status ${status}`), { status, details });
}
