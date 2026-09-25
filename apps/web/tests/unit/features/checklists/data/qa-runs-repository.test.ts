import { request, requestText } from "../../../../../src/shared/api/request";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";

jest.mock("../../../../../src/shared/api/request", () => ({
  request: jest.fn().mockResolvedValue({}),
  requestText: jest.fn().mockResolvedValue("# QA Report"),
}));

const mockRequest = request as jest.MockedFunction<typeof request>;
const mockRequestText = requestText as jest.MockedFunction<typeof requestText>;

function lastCall(): [string, RequestInit | undefined] {
  const call = mockRequest.mock.calls[mockRequest.mock.calls.length - 1];
  return [call[0], call[1]];
}

describe("qaRunsRepository", () => {
  afterEach(() => mockRequest.mockClear());

  it("lists runs with only the filters given, encoded", async () => {
    await qaRunsRepository.list("p/1");
    expect(lastCall()[0]).toBe("/projects/p%2F1/qa-runs");
    await qaRunsRepository.list("p1", { branch: "feat/x", checklistId: "cl-1", limit: 5 });
    expect(lastCall()[0]).toBe("/projects/p1/qa-runs?branch=feat%2Fx&checklistId=cl-1&limit=5");
  });

  it("reads the current run by branch and checklist — never by sha", async () => {
    await qaRunsRepository.current("p1", { branch: "main", checklistId: "cl-1" });
    expect(lastCall()).toEqual(["/projects/p1/qa-runs/current?branch=main&checklistId=cl-1", undefined]);
  });

  it("starts a run with the checklist and branch only, even if handed a sha", async () => {
    await qaRunsRepository.create("p1", {
      checklistId: "cl-1",
      branch: "main",
      commitSha: "abc1234",
    } as never);
    const [url, init] = lastCall();
    expect(url).toBe("/projects/p1/qa-runs");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ checklistId: "cl-1", branch: "main" });
    expect(String(init?.body)).not.toContain("abc1234");
  });

  it("sends each write to its endpoint", async () => {
    await qaRunsRepository.get("p1", "r1");
    expect(lastCall()[0]).toBe("/projects/p1/qa-runs/r1");

    await qaRunsRepository.updateItem("p1", "r1", "i1", { expectedRowVersion: 4, status: "passed" });
    expect(lastCall()).toEqual([
      "/projects/p1/qa-runs/r1/items/i1",
      { method: "PATCH", body: JSON.stringify({ expectedRowVersion: 4, status: "passed" }) },
    ]);

    await qaRunsRepository.requestRetest("p1", "r1", "i1", "fixed in #12");
    expect(lastCall()).toEqual([
      "/projects/p1/qa-runs/r1/items/i1/request-retest",
      { method: "POST", body: JSON.stringify({ note: "fixed in #12" }) },
    ]);
    await qaRunsRepository.requestRetest("p1", "r1", "i1", null);
    expect(lastCall()[1]).toEqual({ method: "POST", body: "{}" });

    await qaRunsRepository.signoff("p1", "r1", { verdict: "CONDITIONAL", conditions: "c" });
    expect(lastCall()).toEqual([
      "/projects/p1/qa-runs/r1/signoff",
      { method: "POST", body: JSON.stringify({ verdict: "CONDITIONAL", conditions: "c" }) },
    ]);

    await qaRunsRepository.reopen("p1", "r1");
    expect(lastCall()).toEqual(["/projects/p1/qa-runs/r1/reopen", { method: "POST" }]);

    await qaRunsRepository.returnedItems("p1");
    expect(lastCall()[0]).toBe("/projects/p1/qa-returned-items");
  });

  it("reads the JSON report with format=json through the JSON transport", async () => {
    await qaRunsRepository.report("p/1", "r 1");
    expect(lastCall()).toEqual(["/projects/p%2F1/qa-runs/r%201/report?format=json", undefined]);
    expect(mockRequestText).not.toHaveBeenCalled();
  });

  it("reads the Markdown report with format=md as text, never parsed as JSON", async () => {
    mockRequest.mockClear();
    const markdown = await qaRunsRepository.reportMarkdown("p1", "r1");
    expect(markdown).toBe("# QA Report");
    expect(mockRequestText).toHaveBeenCalledWith("/projects/p1/qa-runs/r1/report?format=md", {
      headers: { Accept: "text/markdown" },
    });
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
