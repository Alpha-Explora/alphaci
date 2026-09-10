import type { RunsResponse } from "../model/runs-types";

/**
 * Mock fixture for the /ci/runs API. Used while the backend endpoint is not
 * yet live. Three representative runs:
 *   1. All stages succeeded.
 *   2. Quality stage failed (failing tests + low coverage).
 *   3. Access stage failed (crash / deploy error).
 */
export const MOCK_RUNS: RunsResponse = {
  runs: [
    /* ── Run 1: Full success ──────────────────────────────────────────── */
    {
      runId: 1001,
      repoFullName: "acme-org/api-service",
      branch: "main",
      commitSha: "a1b2c3d4e5f6g7h",
      startedAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(), // 14m ago
      overallStatus: "success",
      stages: [
        {
          stage: "access",
          runId: 11001,
          status: "success",
          githubRunUrl:
            "https://github.com/acme-org/api-service/actions/runs/11001",
          updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
          friendlyMessages: [
            {
              severity: "success",
              title: "Repository access verified",
              detail:
                "The GitHub App has read/write access to this repository and its secrets.",
              hint: "No action needed — access looks healthy.",
            },
          ],
        },
        {
          stage: "quality",
          runId: 11002,
          status: "success",
          githubRunUrl:
            "https://github.com/acme-org/api-service/actions/runs/11002",
          updatedAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
          friendlyMessages: [
            {
              severity: "success",
              title: "All 47 tests passed",
              detail:
                "Jest completed with 100% pass rate. Coverage: 92% statements, 88% branches.",
              hint: "Coverage is above the required 80% threshold.",
            },
          ],
        },
        {
          stage: "package",
          runId: 11003,
          status: "success",
          githubRunUrl:
            "https://github.com/acme-org/api-service/actions/runs/11003",
          updatedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
          friendlyMessages: [
            {
              severity: "success",
              title: "Docker image built and pushed",
              detail:
                "Image tagged as acme-org/api-service:a1b2c3d and pushed to GHCR.",
              hint: "The image is ready to deploy.",
            },
          ],
        },
      ],
    },

    /* ── Run 2: Quality stage failed ─────────────────────────────────── */
    {
      runId: 1002,
      repoFullName: "acme-org/web-frontend",
      branch: "feature/dashboard",
      commitSha: "dead0beef1234ab",
      startedAt: new Date(Date.now() - 1000 * 60 * 37).toISOString(), // 37m ago
      overallStatus: "failure",
      stages: [
        {
          stage: "access",
          runId: 22001,
          status: "success",
          githubRunUrl:
            "https://github.com/acme-org/web-frontend/actions/runs/22001",
          updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
          friendlyMessages: [
            {
              severity: "success",
              title: "Repository access verified",
              detail: "GitHub App has full access to this repository.",
              hint: "Access is healthy.",
            },
          ],
        },
        {
          stage: "quality",
          runId: 22002,
          status: "failure",
          githubRunUrl:
            "https://github.com/acme-org/web-frontend/actions/runs/22002",
          updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
          friendlyMessages: [
            {
              severity: "error",
              title: "3 tests failed",
              detail:
                "Jest completed with 3 failures across 2 test suites. The failures are listed below.",
              hint: "Run `npm test -- --watch` locally to debug. Check that mocks return the shape your component expects.",
              items: [
                {
                  label: "UserProfile › renders user display name",
                  sub: "Expected 'John' but received undefined",
                },
                {
                  label: "CartTotal › calculates discount correctly",
                  sub: "TypeError: Cannot read properties of null (reading 'price')",
                },
                {
                  label: "CheckoutFlow › submits order on confirmation",
                  sub: "Async timeout after 5000ms — awaited promise never resolved",
                },
              ],
            },
            {
              severity: "warning",
              title: "Coverage below threshold",
              detail:
                "Statement coverage is 61% (threshold: 80%). Branches coverage is 54% (threshold: 80%).",
              hint: "Add tests for the new checkout module. Focus on the untested branch paths in `src/checkout/`.",
              items: [
                {
                  label: "no-unused-vars",
                  sub: "src/checkout/CartContext.tsx:42",
                },
                {
                  label: "react-hooks/exhaustive-deps",
                  sub: "src/checkout/useOrderSummary.ts:18",
                },
                {
                  label: "@typescript-eslint/no-explicit-any",
                  sub: "src/utils/apiAdapter.ts:7",
                },
              ],
            },
          ],
        },
        {
          stage: "package",
          runId: 22003,
          status: "pending",
          githubRunUrl:
            "https://github.com/acme-org/web-frontend/actions/runs/22003",
          updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
          friendlyMessages: [],
        },
      ],
    },

    /* ── Run 3: Access stage crashed ─────────────────────────────────── */
    {
      runId: 1003,
      repoFullName: "acme-org/infra-scripts",
      branch: "hotfix/creds-rotation",
      commitSha: "f00dcafe9876543",
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
      overallStatus: "failure",
      stages: [
        {
          stage: "access",
          runId: 33001,
          status: "failure",
          githubRunUrl:
            "https://github.com/acme-org/infra-scripts/actions/runs/33001",
          updatedAt: new Date(
            Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60 * 3,
          ).toISOString(),
          friendlyMessages: [
            {
              severity: "error",
              title: "GitHub App installation not found",
              detail:
                "The ALPHACI GitHub App is not installed on acme-org/infra-scripts. The pipeline cannot read or write files in this repository.",
              hint: "Go to your GitHub organisation settings → Installed GitHub Apps and grant ALPHACI access to this repository. Then re-trigger the pipeline.",
            },
            {
              severity: "info",
              title: "Required CI token may be missing",
              detail:
                "The ALPHACI_TOKEN repository secret was not found. This secret is required for the access stage to authenticate.",
              hint: "In GitHub, go to Settings → Secrets → Actions and add ALPHACI_TOKEN. Copy the value from your ALPHACI dashboard.",
            },
          ],
        },
        {
          stage: "quality",
          runId: 33002,
          status: "cancelled",
          githubRunUrl:
            "https://github.com/acme-org/infra-scripts/actions/runs/33002",
          updatedAt: new Date(
            Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60 * 4,
          ).toISOString(),
          friendlyMessages: [
            {
              severity: "warning",
              title: "Stage cancelled due to upstream failure",
              detail:
                "Quality checks were skipped because the access stage did not complete successfully.",
              hint: "Fix the access stage error first, then re-run the pipeline.",
            },
          ],
        },
        {
          stage: "package",
          runId: 33003,
          status: "cancelled",
          githubRunUrl:
            "https://github.com/acme-org/infra-scripts/actions/runs/33003",
          updatedAt: new Date(
            Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60 * 4,
          ).toISOString(),
          friendlyMessages: [
            {
              severity: "warning",
              title: "Stage cancelled due to upstream failure",
              detail:
                "Packaging was skipped because earlier stages did not complete successfully.",
              hint: "Fix the access and quality stages, then re-run.",
            },
          ],
        },
      ],
    },
  ],
};
