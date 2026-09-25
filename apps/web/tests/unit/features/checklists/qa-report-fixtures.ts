import type { QaReport } from "../../../../src/features/checklists/model/qa-report-types";
import { qaRun, runItem } from "./qa-run-fixtures";

const ANA = { id: "u-qa", login: "ana-qa" };
const LEAD = { id: "u-lead", login: "tone-lead" };
const DEV = { id: "u-dev", login: "miguel-dev" };

/** A signed-off (frozen) report: five items, two defects, one superseded sign-off. */
export function frozenReport(overrides: Partial<QaReport> = {}): QaReport {
  const items = [
    runItem(0, {
      title: "Checkout completes with a saved card",
      description: "Use the staging Visa ending 4242.",
      targetPersona: "qa",
      verificationType: "playwright",
      testIdentifier: "e2e/checkout.spec.ts › pays with a saved card",
      status: "passed",
      verifiedBy: ANA,
    }),
    runItem(1, {
      title: "Cart total matches line items",
      targetPersona: "developer",
      verificationType: "unit_test",
      testIdentifier: "src/cart/cart-total.test.ts",
      status: "failed",
      defectSeverity: "major",
      notes: "Total ignores the coupon.",
      reproductionSteps: "1. Add two mugs\n2. Apply SPRING10",
      verifiedBy: ANA,
    }),
    runItem(2, {
      title: "POST /orders rejects an expired session",
      targetPersona: "developer",
      verificationType: "bruno",
      testIdentifier: "collections/orders/create-order.bru",
      status: "passed",
    }),
    runItem(3, { title: "Phone layout", targetPersona: "qa", status: "passed" }),
    runItem(4, { title: "Flags set", targetPersona: "all", status: "blocked", notes: "No prod access" }),
  ];
  const run = qaRun({
    items,
    status: "signed_off",
    branch: "feat/checkout",
    commitSha: "a1b2c3d4e5f6a7b8",
    signoff: {
      id: "so-2",
      verdict: "CONDITIONAL",
      summary: "Checkout verified on desktop and phone.",
      conditions: "Fix the coupon total in the next patch.",
      signedBy: LEAD,
      signedAt: "2026-09-25T06:30:00.000Z",
    },
  });
  return {
    schemaVersion: "qa-report/v1",
    generatedAt: "2026-09-25T07:00:00.000Z",
    frozen: true,
    project: { id: "project-1", repoFullName: "tone/orders-api", name: "orders-api" },
    run,
    summary: {
      totalItems: 5,
      passed: 3,
      failed: 1,
      blocked: 1,
      returnedToDev: 0,
      pending: 0,
      inProgress: 0,
      completionRate: 0.6,
      openDefects: 2,
      blockers: 0,
      verdict: "CONDITIONAL",
    },
    defects: [
      {
        position: 1,
        title: "Cart total matches line items",
        status: "failed",
        severity: "major",
        notes: "Total ignores the coupon.",
        reproductionSteps: "1. Add two mugs\n2. Apply SPRING10",
        targetPersona: "developer",
        fixRequest: { requestedAt: "2026-09-25T05:00:00.000Z", requestedBy: DEV, note: "Fixed in #218" },
      },
      {
        position: 4,
        title: "Flags set",
        status: "blocked",
        severity: null,
        notes: "No prod access",
        reproductionSteps: null,
        targetPersona: "all",
        fixRequest: null,
      },
    ],
    automatedResults: null,
    signoffHistory: [
      {
        verdict: "REJECTED",
        summary: "Coupon broken.",
        conditions: null,
        signedBy: ANA,
        signedAt: "2026-09-24T10:00:00.000Z",
        supersededAt: "2026-09-24T12:00:00.000Z",
        supersededBy: LEAD,
      },
      {
        verdict: "CONDITIONAL",
        summary: "Checkout verified on desktop and phone.",
        conditions: "Fix the coupon total in the next patch.",
        signedBy: LEAD,
        signedAt: "2026-09-25T06:30:00.000Z",
        supersededAt: null,
        supersededBy: null,
      },
    ],
    ...overrides,
  };
}

/** An open run's live report: nothing signed. */
export function liveReport(): QaReport {
  const base = frozenReport();
  return {
    ...base,
    frozen: false,
    run: { ...base.run, status: "open", signoff: null },
    summary: { ...base.summary, verdict: null },
    signoffHistory: [],
  };
}
