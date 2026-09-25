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
    [403, { statusCode: 403, message: "Forbidden" }, false, /role cannot start/],
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
