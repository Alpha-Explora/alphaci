import {
  cleanUserMessage,
  formatApiError,
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
});
