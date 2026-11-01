import type { CiRunReportRef } from "../../../../src/features/checklists/model/ci-run-report-types";

export const CI_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

export const CI_REF: CiRunReportRef = { repoFullName: "acme/orders-api", branch: "uat", commitSha: CI_SHA };

/** A server-built `ci-run-report/v1`: quality failed, package was blocked, verify never ran. */
export function ciRunReportWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "ci-run-report/v1",
    generatedAt: "2026-10-09T09:00:00.000Z",
    ...CI_REF,
    startedAt: "2026-10-09T07:55:00.000Z",
    overallStatus: "failure",
    summary: { stages: 4, passed: 1, failed: 1, inProgress: 0, notRun: 2 },
    failures: [
      {
        stage: "quality",
        severity: "error",
        title: "2 tests failed",
        detail: "Two checkout tests did not pass.",
        hint: "Fix the failing tests, then re-run.",
        items: [{ label: "checkout › pays", sub: "Timed out" }, { label: "cart › coupon" }],
      },
    ],
    stages: [
      { stage: "access", status: "success", runId: 100, reportedAt: "2026-10-09T07:56:00.000Z", messages: [], checks: [], results: null, hasLogs: false },
      {
        stage: "quality",
        status: "failure",
        runId: 200,
        reportedAt: "2026-10-09T08:00:00.000Z",
        messages: [],
        checks: [
          { name: "Unit tests", conclusion: "failure" },
          { name: "Lint", conclusion: "success" },
        ],
        results: {
          tests: { passed: 18, failed: 2, total: 20, failures: [{ name: "checkout › pays", message: "Timed out" }] },
          coverage: { pct: 81.5, threshold: 80 },
          lint: { errors: 0, warnings: 3 },
          security: { high: 1, critical: 0 },
          findings: { secrets: 0, forbiddenLicenses: 1, undeterminedLicenses: 2 },
          sonar: { gate: "ERROR" },
        },
        hasLogs: true,
      },
      { stage: "package", status: "blocked", runId: 200, reportedAt: null, messages: [], checks: [], results: null, hasLogs: false },
      { stage: "verify", status: "pending", runId: 200, reportedAt: null, messages: [], checks: [], results: null, hasLogs: false },
    ],
    ...overrides,
  };
}
