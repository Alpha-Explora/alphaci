import {
  cleanUserMessage,
  formatApiError,
  formatQuotaStatus,
} from "../../src/components/product/workflow-builder-utils";

describe("workflow-builder-utils error formatting", () => {
  it("cleans duplicate GitHub repository payloads", () => {
    const message =
      'Repository already exists or name is invalid: {"message":"Repository creation failed.","errors":[{"resource":"Repository","code":"custom","field":"name","message":"name already exists on this account"}],"documentation_url":"https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user","status":"422"}';

    expect(formatApiError({ details: { message } }, "Project creation failed")).toBe(
      "Project creation failed: A repository with this name already exists on this GitHub account. Choose another repository name and try again.",
    );
  });

  it("cleans Vercel GitHub integration errors", () => {
    const message =
      'Vercel project could not be created: 400 {"error":{"code":"bad_request","message":"To link a GitHub repository, you need to install the GitHub integration first.","action":"Install GitHub App","repo":"tone/web"}}';

    expect(cleanUserMessage(message)).toBe(
      "Vercel cannot access this GitHub repository yet. Install or update the Vercel GitHub integration for the repository owner, then retry.",
    );
  });

  it("cleans Vercel root directory errors", () => {
    const message =
      'Vercel project could not be created: 400 {"error":{"code":"invalid_root_directory","message":"If defined, the Root Directory must be a relative path not starting with `./` and not including `../` or other special characters."}}';

    expect(cleanUserMessage(message)).toBe(
      'The root directory must be a relative path, for example "frontend". Do not use "./" or "../".',
    );
  });

  it("maps generic server failures to an actionable retry message", () => {
    expect(cleanUserMessage("Internal Server Error")).toBe(
      "Something went wrong while processing the request. Please retry, then check the backend logs if it happens again.",
    );
  });

  it("formats quota status for remaining, reached, and unavailable limits", () => {
    expect(formatQuotaStatus({ current: 2, limit: 5, upgradeRequired: false })).toBe("3 remaining");
    expect(formatQuotaStatus({ current: 5, limit: 5, upgradeRequired: false })).toBe("Limit reached.");
    expect(formatQuotaStatus({ current: 5, limit: 5, upgradeRequired: true })).toBe("Limit reached. Upgrade to continue.");
    expect(formatQuotaStatus({ current: 0, limit: 0, upgradeRequired: false })).toBe("Unavailable");
  });

  it("normalizes quota API failures to upgrade or cleanup guidance", () => {
    expect(formatApiError({ status: 403, details: { code: "quota_exceeded" } }, "Project creation failed")).toBe(
      "Quota reached. Upgrade your plan or remove unused resources.",
    );
    expect(cleanUserMessage("Request failed with status 402")).toBe(
      "Quota reached. Upgrade your plan or remove unused resources.",
    );
  });

  it("detects the backend quota guard shape (BadRequestException with limitCode)", () => {
    expect(
      formatApiError(
        {
          status: 400,
          details: {
            message: "Usage quota exceeded",
            limitCode: "projects",
            upgradeRequired: true,
          },
        },
        "Project creation failed",
      ),
    ).toBe("Quota reached. Upgrade your plan or remove unused resources.");
  });

  it("does not mislabel a permission 403 as a quota error", () => {
    const message =
      "The GitHub App is not installed on the Alpha-Explora organization for this account. Install it on Alpha-Explora with access to all repositories, then try again.";

    expect(
      formatApiError({ status: 403, details: { message } }, "Project creation failed"),
    ).toBe(`Project creation failed: ${message}`);
  });

  it("maps a bare 403 with no useful body to an access message, not a quota message", () => {
    expect(cleanUserMessage("Request failed with status 403")).toBe(
      "You do not have access to perform this action.",
    );
  });
});
