import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { dispatchError, normalizeDispatch } from "../../../../../src/features/checklists/model/qa-automation-rules";
import { ApiError } from "../../../../../src/shared/api/request";

/* The dispatch goes through the REAL transport here (only fetch is faked), so
 * the 202 body, the empty 202 and each 409 code are exercised end to end. */

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function reply(status: number, body?: unknown) {
  const textBody = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (textBody ? JSON.parse(textBody) : Promise.reject(new SyntaxError("empty"))),
    text: async () => textBody,
  };
}

describe("qaRunsRepository.dispatchAutomation", () => {
  it("POSTs to the run's automation/dispatch endpoint with no body and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(202, { workflowFile: "verify.yml", ref: "main", headSha: "a1b2c3d4", targetsRunCommit: true }),
    );
    const result = await qaRunsRepository.dispatchAutomation("p/1", "run 1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/v1/projects/p%2F1/qa-runs/run%201/automation/dispatch");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init.body).toBeUndefined();
    expect(normalizeDispatch(result)).toEqual({
      workflowFile: "verify.yml",
      ref: "main",
      headSha: "a1b2c3d4",
      targetsRunCommit: true,
    });
  });

  it("treats an empty 202 as started, with nothing known", async () => {
    fetchMock.mockResolvedValueOnce(reply(202));
    const result = await qaRunsRepository.dispatchAutomation("p1", "r1");
    expect(normalizeDispatch(result)).toEqual({ workflowFile: null, ref: null, headSha: null, targetsRunCommit: null });
  });

  it.each([
    [409, { statusCode: 409, code: "GITHUB_REAUTH", message: "GitHub token expired" }, true, /sign in again/],
    [409, { statusCode: 409, code: "VERIFY_WORKFLOW_MISSING", message: "No verify workflow" }, false, /no verify workflow/],
    [409, { statusCode: 409, message: "This QA run is signed off." }, false, /This QA run is signed off\./],
    [403, { statusCode: 403, message: "Forbidden" }, false, /^GitHub refused to start Playwright\.$/],
    [403, { statusCode: 403, message: "Resource not accessible by integration" }, false, /^Resource not accessible by integration$/],
    [404, { statusCode: 404, message: "Not Found" }, false, /no longer exists/],
  ])("surfaces a %s as a typed ApiError the rules can read", async (status, body, signIn, message) => {
    fetchMock.mockResolvedValueOnce(reply(status, body));
    const failure = await qaRunsRepository.dispatchAutomation("p1", "r1").catch((cause: unknown) => cause);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(status);
    const copy = dispatchError(failure);
    expect(copy.signIn).toBe(signIn);
    expect(copy.message).toMatch(message);
  });
});

describe("projectQaRunsRepository.dispatchAutomation", () => {
  it("POSTs to the Project run's dispatch endpoint with no body, and normalises the reply", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(202, {
        dispatched: [{ projectId: "p1", repoFullName: "tone/web", workflowFile: "verify.yml", ref: "uat", headSha: "a1b2", targetsRunCommit: true }],
        failed: [{ projectId: "p2", repoFullName: "tone/api", code: "VERIFY_WORKFLOW_MISSING", message: "No verify workflow." }],
      }),
    );
    const result = await projectQaRunsRepository.dispatchAutomation("dp/1", "run 1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/v1/delivery-projects/dp%2F1/qa-runs/run%201/automation/dispatch");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init.body).toBeUndefined();
    expect(result).toEqual({
      dispatched: [{ projectId: "p1", repoFullName: "tone/web", ref: "uat", headSha: "a1b2", targetsRunCommit: true }],
      failed: [{ projectId: "p2", repoFullName: "tone/api", code: "VERIFY_WORKFLOW_MISSING", message: "No verify workflow." }],
    });
  });

  it("narrows to one repository when asked", async () => {
    fetchMock.mockResolvedValueOnce(reply(202, { dispatched: [], failed: [] }));
    await projectQaRunsRepository.dispatchAutomation("dp1", "r1", "p1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ projectId: "p1" });
  });

  it("maps a refused dispatch (nothing started) to the product sentence", async () => {
    fetchMock.mockResolvedValueOnce(reply(409, { statusCode: 409, code: "GITHUB_REAUTH", message: "Sign in to GitHub again", failed: [] }));
    const caught = await projectQaRunsRepository.dispatchAutomation("dp1", "r1").catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiError);
    expect(dispatchError(caught).signIn).toBe(true);
  });
});
