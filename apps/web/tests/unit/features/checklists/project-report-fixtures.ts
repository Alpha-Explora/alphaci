import { automation, verifyFailure } from "./qa-automation-fixtures";
import { DP_ID, SHA_BE, SHA_FE, projectRunWire, runItemWire } from "./requirement-fixtures";

/** A server-built `qa-report/v2` for a Project run covering two repositories. */
export function projectReportWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "qa-report/v2",
    generatedAt: "2026-10-09T09:00:00.000Z",
    frozen: false,
    project: { id: DP_ID, name: "storefront" },
    repositories: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", name: "storefront-web", headSha: SHA_FE },
      { projectId: "proj-be", repoFullName: "tone/orders-api", name: "orders-api", headSha: SHA_BE },
    ],
    run: projectRunWire({
      automation: automation(),
      automationByRepository: [
        { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: automation() },
        {
          projectId: "proj-be",
          repoFullName: "tone/orders-api",
          automation: {
            verify: verifyFailure({
              status: "success",
              tests: { total: 9, passed: 9, failed: 0, failures: [], failuresTruncated: false },
            }),
            quality: null,
          },
        },
      ],
      items: [
        runItemWire({ status: "failed", notes: "Pay button never appears" }),
        runItemWire({
          id: "run-item-2",
          position: 1,
          title: "Checkout works",
          requirementName: "Release smoke test",
          requirementKind: "system",
          status: "passed",
        }),
      ],
    }),
    summary: {
      totalItems: 2,
      passed: 1,
      failed: 1,
      blocked: 0,
      returnedToDev: 0,
      pending: 0,
      inProgress: 0,
      completionRate: 0.5,
      openDefects: 1,
      blockers: 0,
      verdict: null,
    },
    defects: [
      {
        position: 0,
        title: "As a shopper, I can pay with a saved card",
        status: "failed",
        severity: "major",
        notes: "Pay button never appears",
        reproductionSteps: null,
        targetPersona: "all",
        fixRequest: null,
        requirementName: "Checkout with saved cards",
        requirementKind: "functional",
      },
    ],
    signoffHistory: [],
    ...overrides,
  };
}
