import {
  canCreateRepositories,
  roleGateErrorMessage,
} from "../../../../../../src/features/workflows/studio/model/role-gate-rules";
import { buildSetupExistingRepoPayload } from "../../../../../../src/features/workflows/studio/model/studio-command-payloads";
import { ApiError } from "../../../../../../src/shared/api/request";

const FALLBACK = "Repository discovery failed";

function apiError(status: number, code?: string, message = "Server text"): ApiError {
  return new ApiError(`Request failed with status ${status}`, status, {
    statusCode: status,
    error: "x",
    ...(code ? { code } : {}),
    message,
  });
}

describe("canCreateRepositories", () => {
  it.each([
    ["admin", false, true],
    ["lead", false, true],
    ["member", false, false],
    ["qa", false, false],
    [undefined, false, false],
    [null, false, false],
    [undefined, true, true],
  ] as const)("role %s guest %s -> %s", (role, guest, expected) => {
    expect(canCreateRepositories(role, guest)).toBe(expected);
  });
});

describe("roleGateErrorMessage", () => {
  it.each([
    [403, "PROJECT_ROLE_FORBIDDEN", "Only team leads and admins can create or onboard repositories."],
    [
      403,
      "REPO_NOT_ACCESSIBLE",
      "ALPHACI cannot access that repository with your GitHub account. Check the name and your access, then try again.",
    ],
    [
      403,
      "MAIN_PR_RESTRICTED",
      "Pull requests into main are restricted to the QA Studio promotion flow.",
    ],
    [
      409,
      "PR_BASE_BRANCH_MISSING",
      "This repository has no dev or uat branch to open the setup pull request against. Create one, then try again.",
    ],
    [403, "INSTALLATION_NOT_ACCESSIBLE", "You do not have access to that GitHub installation."],
  ])("maps %s %s", (status, code, expected) => {
    expect(roleGateErrorMessage(apiError(status, code), FALLBACK)).toBe(expected);
  });

  it("matches codes case-insensitively", () => {
    expect(roleGateErrorMessage(apiError(403, "repo_not_accessible"), FALLBACK)).toContain(
      "cannot access that repository",
    );
  });

  it("asks for a fresh sign-in on 401", () => {
    expect(roleGateErrorMessage(apiError(401), FALLBACK)).toBe(
      "Your GitHub session expired. Sign in again, then retry.",
    );
  });

  it("explains a 502 from GitHub", () => {
    expect(roleGateErrorMessage(apiError(502), FALLBACK)).toBe(
      "GitHub could not be reached just now. Try again in a moment.",
    );
  });

  it("falls through to the server's reason for an unknown code", () => {
    expect(roleGateErrorMessage(apiError(403, "OTHER", "Some reason"), FALLBACK)).toBe(
      `${FALLBACK}: Some reason`,
    );
  });

  it("falls back for a non-API error", () => {
    expect(roleGateErrorMessage(new TypeError("boom"), FALLBACK)).toBe(FALLBACK);
  });
});

describe("existing-repo setup payload", () => {
  it("never carries a baseBranch, so the backend picks dev or uat", () => {
    const payload = buildSetupExistingRepoPayload({
      projectName: "Checkout",
      repoFullName: "tone/app",
      selectedProjectTypeId: "node",
      selectedWorkflowRecipeId: undefined,
      recipesForSelectedProject: [],
      serviceName: "app",
      servicePath: ".",
      nodeVersion: "24",
      coverageThreshold: "80",
      outputFileName: "ci.yml",
      deploymentProvisioning: undefined,
    } as Parameters<typeof buildSetupExistingRepoPayload>[0]);
    expect(payload).not.toHaveProperty("baseBranch");
    expect(payload.projectName).toBe("Checkout");
  });
});
