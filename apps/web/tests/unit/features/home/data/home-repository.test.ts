import { homeRepository } from "../../../../../src/features/home/data/home-repository";
import { getRuns } from "../../../../../src/features/runs";

jest.mock("../../../../../src/features/runs", () => ({ getRuns: jest.fn() }));
jest.mock("../../../../../src/features/groups", () => ({}));
jest.mock("../../../../../src/features/workflows", () => ({}));
jest.mock("../../../../../src/features/projects", () => ({}));
jest.mock("../../../../../src/features/auth/session", () => ({}));

const mockGetRuns = getRuns as jest.Mock;

describe("homeRepository.recentRuns", () => {
  it("asks for the selected team's runs", async () => {
    mockGetRuns.mockResolvedValue({ runs: [{ runId: 1 }] });
    const runs = await homeRepository.recentRuns("ws-1");
    expect(mockGetRuns).toHaveBeenCalledWith(undefined, { workspaceId: "ws-1" });
    expect(runs).toEqual([{ runId: 1 }]);
  });
});
