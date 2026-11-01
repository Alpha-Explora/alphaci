import { request } from "../../../../../src/shared/api/request";
import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";

jest.mock("../../../../../src/shared/api/request", () => ({
  request: jest.fn().mockResolvedValue({}),
}));

const mockRequest = request as jest.MockedFunction<typeof request>;

function lastCall(): [string, RequestInit | undefined] {
  const call = mockRequest.mock.calls[mockRequest.mock.calls.length - 1];
  return [call[0], call[1]];
}

describe("checklistsRepository", () => {
  afterEach(() => mockRequest.mockClear());

  it("lists a workspace's checklists, archived only on request", async () => {
    await checklistsRepository.listForWorkspace("ws/1");
    expect(lastCall()[0]).toBe("/workspaces/ws%2F1/qa-checklists?includeArchived=false");
    await checklistsRepository.listForWorkspace("ws-1", { includeArchived: true });
    expect(lastCall()[0]).toBe("/workspaces/ws-1/qa-checklists?includeArchived=true");
  });

  it("lists a project's checklists and reads one", async () => {
    await checklistsRepository.listForProject("project-1");
    expect(lastCall()[0]).toBe("/projects/project-1/qa-checklists");
    await checklistsRepository.get("cl-1");
    expect(lastCall()[0]).toBe("/qa-checklists/cl-1");
  });

  it("sends every write to its endpoint with the version it read", async () => {
    await checklistsRepository.create("ws-1", { name: "N", items: [] });
    expect(lastCall()).toEqual([
      "/workspaces/ws-1/qa-checklists",
      { method: "POST", body: JSON.stringify({ name: "N", items: [] }) },
    ]);

    await checklistsRepository.update("cl-1", { expectedVersion: 2, name: "M" });
    expect(lastCall()).toEqual([
      "/qa-checklists/cl-1",
      { method: "PATCH", body: JSON.stringify({ expectedVersion: 2, name: "M" }) },
    ]);

    await checklistsRepository.replaceItems("cl-1", 3, []);
    expect(lastCall()).toEqual([
      "/qa-checklists/cl-1/items",
      { method: "PUT", body: JSON.stringify({ expectedVersion: 3, items: [] }) },
    ]);

    await checklistsRepository.archive("cl-1");
    expect(lastCall()).toEqual(["/qa-checklists/cl-1/archive", { method: "POST" }]);

    await checklistsRepository.share("cl-1", ["p1"]);
    expect(lastCall()).toEqual([
      "/qa-checklists/cl-1/projects",
      { method: "PUT", body: JSON.stringify({ projectIds: ["p1"] }) },
    ]);
  });
});
