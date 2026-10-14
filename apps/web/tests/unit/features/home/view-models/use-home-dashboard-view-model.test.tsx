import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { homeRepository } from "../../../../../src/features/home/data/home-repository";
import {
  useHomeDashboardViewModel,
  type HomeDashboardViewModel,
} from "../../../../../src/features/home/dashboard/view-models/use-home-dashboard-view-model";
import type { AppRole } from "../../../../../src/features/home/model/home-types";
import { WorkspaceProvider } from "../../../../../src/features/workspace/selection";
import { RUNS, overview, snapshot } from "../home-persona-fixtures";

jest.mock("../../../../../src/features/home/data/home-repository", () => ({
  homeRepository: {
    workflowHistory: jest.fn(),
    projects: jest.fn(),
    recentRuns: jest.fn(),
    workspaceOverview: jest.fn(),
    projectFolders: jest.fn(),
    teamQaOverview: jest.fn(),
    completeOnboarding: jest.fn(),
  },
}));

let mockCapabilities = { status: "ready", qaChecklistsEnabled: true };

jest.mock("../../../../../src/features/capabilities", () => ({
  useCapabilities: () => mockCapabilities,
}));

const repo = homeRepository as jest.Mocked<typeof homeRepository>;

let root: Root | null = null;
let latest: HomeDashboardViewModel | null = null;
let probeRole: AppRole | undefined;

function Probe() {
  // A probe hands the hook's value back to the test; the write IS the read.
  // eslint-disable-next-line react-hooks/globals
  latest = useHomeDashboardViewModel({ enabled: true, appRole: probeRole });
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

async function mount(appRole?: AppRole): Promise<void> {
  probeRole = appRole;
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
  mockCapabilities = { status: "ready", qaChecklistsEnabled: true };
  repo.workflowHistory.mockResolvedValue([]);
  repo.workspaceOverview.mockResolvedValue({
    group: null,
    portfolio: [],
    assignments: [],
    activity: [],
  });
  repo.projectFolders.mockResolvedValue(snapshot());
  repo.teamQaOverview.mockResolvedValue(overview());
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

describe("useHomeDashboardViewModel reads only what the layout shows", () => {
  beforeEach(() => {
    repo.projects.mockResolvedValue([{ id: "p1" }] as never);
    repo.recentRuns.mockResolvedValue(RUNS);
  });

  it("keeps the team dashboard's reads for a session with no role", async () => {
    await mount(undefined);
    await poll(() => latest?.workspace.status === "ready" && latest?.history.status === "ready");
    expect(latest?.layout.persona).toBe("team");
    expect(repo.workspaceOverview).toHaveBeenCalledWith("ws-1");
    expect(repo.projectFolders).not.toHaveBeenCalled();
    expect(repo.teamQaOverview).not.toHaveBeenCalled();
  });

  it("never reads the team walk, its Activity or history for a Developer", async () => {
    await mount("member");
    await poll(() => latest?.folders.status === "ready" && latest?.qaOverview.status === "ready");
    expect(latest?.layout.persona).toBe("developer");
    expect(repo.projectFolders).toHaveBeenCalledWith("ws-1");
    expect(repo.teamQaOverview).toHaveBeenCalledWith("ws-1");
    expect(repo.workspaceOverview).not.toHaveBeenCalled();
    expect(repo.workflowHistory).not.toHaveBeenCalled();
    expect(latest?.persona.scope).toEqual({ mode: "mine", projectIds: ["dp-shop"] });
    expect(latest?.sections.qaOverview).toEqual({ status: "ready", error: null });
  });

  it("reads history for a Product owner, for the get-started journey", async () => {
    await mount("lead");
    await poll(() => latest?.history.status === "ready" && latest?.qaOverview.status === "ready");
    expect(repo.workflowHistory).toHaveBeenCalled();
    expect(repo.workspaceOverview).not.toHaveBeenCalled();
    expect(latest?.persona.production.ready.map((row) => row.name)).toEqual(["Payments"]);
  });

  it("does not read the QA overview with the QA capability off", async () => {
    mockCapabilities = { status: "ready", qaChecklistsEnabled: false };
    await mount("member");
    await poll(() => latest?.folders.status === "ready");
    expect(repo.teamQaOverview).not.toHaveBeenCalled();
    expect(latest?.qaOverview).toEqual({ data: null, status: "ready", error: null });
    expect(latest?.layout.qa).toBe(false);
  });

  it("gives the QA Team the team dashboard, and its reads, with the QA capability off", async () => {
    mockCapabilities = { status: "ready", qaChecklistsEnabled: false };
    await mount("qa");
    await poll(() => latest?.workspace.status === "ready");
    expect(latest?.layout.persona).toBe("team");
    expect(repo.workspaceOverview).toHaveBeenCalled();
    expect(repo.teamQaOverview).not.toHaveBeenCalled();
  });

  it("reads nothing that depends on the role's layout until the capabilities are known", async () => {
    mockCapabilities = { status: "loading", qaChecklistsEnabled: false };
    await mount("member");
    await poll(() => latest?.runs.status === "ready" && latest?.projects.status === "ready");
    expect(repo.projectFolders).not.toHaveBeenCalled();
    expect(repo.teamQaOverview).not.toHaveBeenCalled();
    expect(repo.workspaceOverview).not.toHaveBeenCalled();
    // Laid out as if QA were on meanwhile, so the QA blocks wait rather than vanish.
    expect(latest?.layout.qa).toBe(true);
    expect(latest?.sections.qaOverview.status).toBe("loading");
  });

  it("fails only the QA blocks when the overview cannot be read", async () => {
    repo.teamQaOverview.mockRejectedValue(new Error("boom"));
    await mount("member");
    await poll(() => latest?.qaOverview.status === "error" && latest?.folders.status === "ready");
    expect(latest?.qaOverview.error).toBe("Could not load QA progress for this team.");
    expect(latest?.persona.scope.mode).toBe("team");
    expect(latest?.persona.runs).toHaveLength(RUNS.length);
  });

  it("re-reads on reload", async () => {
    await mount("member");
    await poll(() => latest?.folders.status === "ready");
    act(() => latest?.reload());
    await poll(() => repo.projectFolders.mock.calls.length === 2);
    expect(repo.teamQaOverview).toHaveBeenCalledTimes(2);
  });
});
