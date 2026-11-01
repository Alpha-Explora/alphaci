import { ApiError, request } from "../../../../../src/shared/api/request";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";

jest.mock("../../../../../src/shared/api/request", () => {
  const actual = jest.requireActual("../../../../../src/shared/api/request");
  return { ...actual, request: jest.fn() };
});

const mockedRequest = request as jest.MockedFunction<typeof request>;

afterEach(() => jest.clearAllMocks());

describe("projectsRepository.folder", () => {
  it("reads and normalises GET /projects/:id/folder", async () => {
    mockedRequest.mockResolvedValue({
      deliveryProjectId: "dp-1",
      groupId: "ws-1",
      name: "shop",
      repositories: [
        { projectId: "proj-be", name: "shop-be", repoFullName: "Org/shop-be", role: "backend", status: "provisioned" },
        { projectId: "proj-fe", name: "shop-fe", repoFullName: "Org/shop-fe", role: "frontend", status: "provisioned" },
      ],
    });
    const folder = await projectsRepository.folder("proj 1");
    expect(mockedRequest).toHaveBeenCalledWith("/projects/proj%201/folder");
    expect(folder?.name).toBe("shop");
    expect(folder?.repositories.map((repo) => repo.role)).toEqual(["frontend", "backend"]);
  });

  it("returns null for a body that is not a folder", async () => {
    mockedRequest.mockResolvedValue({ unexpected: true });
    await expect(projectsRepository.folder("proj-1")).resolves.toBeNull();
  });

  it("lets a 404 through for the view-model to read as unavailable", async () => {
    mockedRequest.mockRejectedValue(new ApiError("Not Found", 404));
    await expect(projectsRepository.folder("proj-1")).rejects.toMatchObject({ status: 404 });
  });
});
