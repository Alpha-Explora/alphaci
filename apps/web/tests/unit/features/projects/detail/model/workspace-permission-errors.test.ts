import { workspacePermissionErrorMessage } from "../../../../../../src/features/projects/detail/model/workspace-permission-errors";
import { ApiError } from "../../../../../../src/shared/api/request";

const FALLBACK = "The request could not be sent.";

function forbidden(code: string, message = "Forbidden"): ApiError {
  return new ApiError("Request failed with status 403", 403, {
    statusCode: 403,
    error: "Forbidden",
    code,
    message,
  });
}

describe("workspacePermissionErrorMessage", () => {
  it.each([
    [
      "MAIN_MERGE_VIA_QA_STUDIO",
      "Merges into main go through PO Studio — Ready for production.",
    ],
    ["PR_ROLE_FORBIDDEN", "QA does not open or merge pull requests."],
    [
      "PR_ROUTE_RESTRICTED",
      "Developers open pull requests from a feature branch into dev, and from dev into uat.",
    ],
    [
      "MAIN_PR_RESTRICTED",
      "Pull requests into main are restricted to the PO Studio promotion flow.",
    ],
    [
      "ENV_VARS_LEAD_ONLY",
      "Developers and admins can change environment variables.",
    ],
    [
      "PROJECT_ROLE_FORBIDDEN",
      "Only Product owners and admins can make this change.",
    ],
    [
      "HOSTING_LEAD_ONLY",
      "Developers and admins can change hosting services and custom domains.",
    ],
    [
      "PR_BASE_BRANCH_MISSING",
      "This repository has no dev or uat branch to open the pull request against. Create one, then try again.",
    ],
  ])("maps %s to its own sentence, not the server's", (code, expected) => {
    const error = forbidden(code, "generic backend text");
    expect(workspacePermissionErrorMessage(error, FALLBACK)).toBe(expected);
  });

  it("matches a code case-insensitively", () => {
    const error = forbidden("main_pr_restricted");
    expect(workspacePermissionErrorMessage(error, FALLBACK)).toBe(
      "Pull requests into main are restricted to the PO Studio promotion flow.",
    );
  });

  it("falls back to the server's own message for a code it does not know", () => {
    const error = new ApiError("Request failed with status 403", 403, {
      code: "SOME_OTHER_CODE",
      message: "A different reason entirely.",
    });
    expect(workspacePermissionErrorMessage(error, FALLBACK)).toBe(
      "A different reason entirely.",
    );
  });

  it("falls back to the caller's fallback when there is no code and no message", () => {
    const error = new ApiError("Request failed with status 403", 403, {});
    expect(workspacePermissionErrorMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it("falls back for an error that never reached the API", () => {
    expect(
      workspacePermissionErrorMessage(new TypeError("Failed to fetch"), FALLBACK),
    ).toBe(FALLBACK);
  });
});
