import { homeRepository } from "../../../../../src/features/home/data/home-repository";
import { requirementsRepository } from "../../../../../src/features/checklists";
import { getRuns } from "../../../../../src/features/runs";
import { projectFoldersRepository } from "../../../../../src/features/teams/project-folders";

jest.mock("../../../../../src/features/runs", () => ({ getRuns: jest.fn() }));
jest.mock("../../../../../src/features/groups", () => ({}));
jest.mock("../../../../../src/features/workflows", () => ({}));
jest.mock("../../../../../src/features/projects", () => ({}));
jest.mock("../../../../../src/features/auth/session", () => ({}));
jest.mock("../../../../../src/features/checklists", () => ({
  requirementsRepository: { teamOverview: jest.fn() },
}));
jest.mock("../../../../../src/features/teams/project-folders", () => ({
  projectFoldersRepository: { list: jest.fn() },
}));

const mockGetRuns = getRuns as jest.Mock;
const mockTeamOverview = requirementsRepository.teamOverview as jest.Mock;
const mockListFolders = projectFoldersRepository.list as jest.Mock;

describe("homeRepository.recentRuns", () => {
  it("asks for the selected team's runs", async () => {
    mockGetRuns.mockResolvedValue({ runs: [{ runId: 1 }] });
    const runs = await homeRepository.recentRuns("ws-1");
    expect(mockGetRuns).toHaveBeenCalledWith(undefined, { workspaceId: "ws-1" });
    expect(runs).toEqual([{ runId: 1 }]);
  });
});

describe("homeRepository role reads", () => {
  it("reads the team's Projects list", async () => {
    mockListFolders.mockResolvedValue({ folders: [] });
    expect(await homeRepository.projectFolders("ws-1")).toEqual({ folders: [] });
    expect(mockListFolders).toHaveBeenCalledWith("ws-1");
  });

  it("reads the team's QA overview", async () => {
    mockTeamOverview.mockResolvedValue({ projects: [] });
    expect(await homeRepository.teamQaOverview("ws-1")).toEqual({ projects: [] });
    expect(mockTeamOverview).toHaveBeenCalledWith("ws-1");
  });
});
