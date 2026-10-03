import {
  canCreateRepositories,
  roleGateErrorMessage,
  studioCreateGates,
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
    ["member", false, true],
    ["lead", false, false],
    ["qa", false, false],
    [undefined, false, false],
    [null, false, false],
    [undefined, true, true],
  ] as const)("role %s guest %s -> %s", (role, guest, expected) => {
    expect(canCreateRepositories(role, guest)).toBe(expected);
  });
});

describe("studioCreateGates", () => {
  it.each([
    ["lead", false, { canCreateRepositories: false, canCreateProjects: true, existingRepoAllowed: true }],
    ["member", false, { canCreateRepositories: true, canCreateProjects: false, existingRepoAllowed: false }],
    ["admin", false, { canCreateRepositories: true, canCreateProjects: true, existingRepoAllowed: true }],
    ["qa", false, { canCreateRepositories: false, canCreateProjects: false, existingRepoAllowed: true }],
    [undefined, true, { canCreateRepositories: true, canCreateProjects: false, existingRepoAllowed: true }],
  ] as const)("role %s guest %s", (role, guest, expected) => {
    expect(studioCreateGates(role, guest)).toEqual(expected);
  });
});

describe("roleGateErrorMessage", () => {
  it.each([
    [403, "PROJECT_ROLE_FORBIDDEN", "Your role cannot create or onboard repositories."],
    [403, "REPOSITORY_CREATE_FORBIDDEN", "Developers create repositories inside a Project."],
    [400, "PROJECT_REQUIRED", "Choose the Project this repository belongs to."],
    [409, "PROJECT_FEATURES_REQUIRED", "Waiting for your Product owner to add the first Feature."],
    [403, "PROJECT_CREATE_FORBIDDEN", "Product owners create Projects."],
    [
      403,
      "REPO_NOT_ACCESSIBLE",
      "ALPHACI cannot access that repository with your GitHub account. Check the name and your access, then try again.",
    ],
    [
      403,
      "MAIN_PR_RESTRICTED",
      "Pull requests into main are restricted to the PO Studio promotion flow.",
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
