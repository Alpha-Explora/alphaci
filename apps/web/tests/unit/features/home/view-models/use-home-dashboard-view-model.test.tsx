import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { homeRepository } from "../../../../../src/features/home/data/home-repository";
import {
  useHomeDashboardViewModel,
  type HomeDashboardViewModel,
} from "../../../../../src/features/home/dashboard/view-models/use-home-dashboard-view-model";
import { WorkspaceProvider } from "../../../../../src/features/workspace/selection";

jest.mock("../../../../../src/features/home/data/home-repository", () => ({
  homeRepository: {
    workflowHistory: jest.fn(),
    projects: jest.fn(),
    recentRuns: jest.fn(),
    workspaceOverview: jest.fn(),
    completeOnboarding: jest.fn(),
  },
}));

const repo = homeRepository as jest.Mocked<typeof homeRepository>;

let root: Root | null = null;
let latest: HomeDashboardViewModel | null = null;

function Probe() {
  // A probe hands the hook's value back to the test; the write IS the read.
  // eslint-disable-next-line react-hooks/globals
  latest = useHomeDashboardViewModel({ enabled: true });
  return null;
}

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

async function mount(): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <WorkspaceProvider initialWorkspaceId="ws-1">
        <Probe />
      </WorkspaceProvider>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = null;
  repo.workflowHistory.mockResolvedValue([]);
  repo.workspaceOverview.mockResolvedValue({
    group: null,
    portfolio: [],
    assignments: [],
    activity: [],
  });
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("useHomeDashboardViewModel team scoping", () => {
  it("loads runs for the header team", async () => {
    repo.projects.mockResolvedValue([]);
    repo.recentRuns.mockResolvedValue([]);
    await mount();
    await poll(() => latest?.runs.status === "ready");
    expect(repo.recentRuns).toHaveBeenCalledWith("ws-1");
  });

  it("shows no runs for a team with no projects, even if some arrive", async () => {
    repo.projects.mockResolvedValue([]);
    repo.recentRuns.mockResolvedValue([
      { runId: 9, overallStatus: "failure", stages: [] },
    ] as never);
    await mount();
    await poll(() => latest?.runs.status === "ready" && latest?.projects.status === "ready");
    expect(latest?.runs.data).toHaveLength(1);
    expect(latest?.teamRuns).toEqual([]);
    expect(latest?.runStats.failureStreak).toBe(0);
  });

  it("keeps the runs of a team that has projects", async () => {
    repo.projects.mockResolvedValue([{ id: "p1" }] as never);
    repo.recentRuns.mockResolvedValue([
      { runId: 9, overallStatus: "failure", stages: [] },
    ] as never);
    await mount();
    await poll(() => latest?.runs.status === "ready" && latest?.projects.status === "ready");
    expect(latest?.teamRuns).toHaveLength(1);
    expect(latest?.runStats.failureStreak).toBe(1);
  });
});
