import { request } from "../../../../../../src/shared/api/request";
import { checklistsRepository } from "../../../../../../src/features/checklists/data/checklists-repository";
import { projectFoldersRepository } from "../../../../../../src/features/teams/project-folders/data/project-folders-repository";
import { foldersWire, GROUP_ID } from "../folder-fixtures";

jest.mock("../../../../../../src/shared/api/request", () => {
  const actual = jest.requireActual("../../../../../../src/shared/api/request");
  return { ...actual, request: jest.fn() };
});

const mockedRequest = request as jest.MockedFunction<typeof request>;

afterEach(() => jest.clearAllMocks());

describe("projectFoldersRepository", () => {
  it("reads and normalises GET /groups/:id/project-folders", async () => {
    mockedRequest.mockResolvedValue(foldersWire());
    const snapshot = await projectFoldersRepository.list("ws 1");
    expect(mockedRequest).toHaveBeenCalledWith("/groups/ws%201/project-folders");
    expect(snapshot.folders.map((folder) => folder.deliveryProjectId)).toEqual(["dp-1", "dp-2"]);
  });

  it("creates an empty Project with POST /groups/:id/projects", async () => {
    mockedRequest.mockResolvedValue({ id: "dp-3" });
    await projectFoldersRepository.create(GROUP_ID, { name: "wallet" });
    expect(mockedRequest).toHaveBeenCalledWith("/groups/ws-1/projects", {
      method: "POST",
      body: JSON.stringify({ name: "wallet" }),
    });
  });

  it("moves with POST /repositories/:id/move and reads the outcome", async () => {
    mockedRequest.mockResolvedValue({ repository: {}, moved: true, sourceDeliveryProjectId: "dp-1", sourceDeliveryProjectEmpty: false });
    const outcome = await projectFoldersRepository.moveRepository("repo-fe", "dp-2");
    expect(mockedRequest).toHaveBeenCalledWith("/repositories/repo-fe/move", {
      method: "POST",
      body: JSON.stringify({ deliveryProjectId: "dp-2" }),
    });
    expect(outcome).toEqual({ moved: true, sourceDeliveryProjectId: "dp-1", sourceDeliveryProjectEmpty: false });
  });

  it("archives an emptied Project through the delivery-project archive", async () => {
    mockedRequest.mockResolvedValue({});
    await projectFoldersRepository.archive("dp-1");
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1/archive", { method: "POST" });
  });

  it("deletes with DELETE /delivery-projects/:id and reads the outcome", async () => {
    mockedRequest.mockResolvedValue({
      deliveryProjectId: "dp-1",
      name: "testfinals",
      deletedRepositories: [{ repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: true }],
    });
    const outcome = await projectFoldersRepository.deleteProject("dp-1", {
      confirmName: "testfinals",
      deleteGithubRepos: true,
    });
    expect(mockedRequest).toHaveBeenCalledWith("/delivery-projects/dp-1", {
      method: "DELETE",
      body: JSON.stringify({ confirmName: "testfinals", deleteGithubRepos: true }),
    });
    expect(outcome).toEqual({
      deliveryProjectId: "dp-1",
      name: "testfinals",
      deletedRepositories: [{ repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: true }],
    });
  });

  it("lists the team's live checklists", async () => {
    mockedRequest.mockResolvedValue({ items: [{ id: "cl-1", name: "Smoke", items: [{}], archivedAt: null, sharedProjectIds: ["p"] }], canManage: true });
    const checklists = await projectFoldersRepository.listChecklists(GROUP_ID);
    expect(mockedRequest).toHaveBeenCalledWith("/workspaces/ws-1/qa-checklists?includeArchived=false");
    expect(checklists).toEqual([{ id: "cl-1", name: "Smoke", itemCount: 1, archived: false, sharedProjectIds: ["p"] }]);
  });

  it("edits shares with PATCH, never the PUT full replace", async () => {
    mockedRequest.mockResolvedValue({ id: "cl-1", name: "Smoke", items: [], archivedAt: null, sharedProjectIds: [] });
    const share = jest.spyOn(checklistsRepository, "share");
    await projectFoldersRepository.updateChecklistShares("cl-1", { remove: ["proj-fe"] });
    expect(mockedRequest).toHaveBeenCalledWith("/qa-checklists/cl-1/projects", {
      method: "PATCH",
      body: JSON.stringify({ remove: ["proj-fe"] }),
    });
    expect(share).not.toHaveBeenCalled();
  });
});
