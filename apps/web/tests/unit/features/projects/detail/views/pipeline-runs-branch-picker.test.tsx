import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PipelineRunsTab } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-runs-tab";
import { getProjectWorkflowRuns } from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import { getRuns } from "../../../../../../src/features/runs";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectWorkflowRuns: jest.fn(),
    getProjectRunJobs: jest.fn(),
    getProjectJobLog: jest.fn(),
  }),
);

jest.mock("../../../../../../src/features/runs", () => ({
  getRuns: jest.fn(),
}));

const mockedRuns = getProjectWorkflowRuns as jest.MockedFunction<
  typeof getProjectWorkflowRuns
>;
const mockedReports = getRuns as jest.MockedFunction<typeof getRuns>;

/**
 * The picker must offer every branch, not only the one already chosen.
 *
 * It regressed to `visibleSections` — the FILTERED list — which collapsed the
 * dropdown to a single option and made it impossible to switch branches at
 * all, since the only other entry was "All branches".
 */
describe("PipelineRunsTab branch picker", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);

    mockedRuns.mockResolvedValue({
      repoFullName: "org/repo",
      actionsUrl: "https://github.com/org/repo/actions",
      runs: [
        {
          id: 1,
          name: "ALPHACI Access Gate",
          displayTitle: "ci: add ALPHACI workflow",
          headBranch: "dev",
          headSha: "a98cf829",
          event: "push",
          status: "completed",
          conclusion: "success",
          runNumber: 1,
          runAttempt: 1,
          htmlUrl: "https://github.com/org/repo/actions/runs/1",
          actor: "bot",
          createdAt: "2026-09-09T08:00:00Z",
          updatedAt: "2026-09-09T08:01:00Z",
        },
      ],
    });
    mockedReports.mockResolvedValue({ runs: [] });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  it("lists every declared branch, not just the selected one", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    const options = [...host.querySelectorAll("option")].map(
      (option) => option.value,
    );

    expect(options).toEqual(
      expect.arrayContaining(["dev", "uat", "main", "all"]),
    );
  });

  it("marks the branches that recorded nothing", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    const labels = [...host.querySelectorAll("option")].map(
      (option) => option.textContent ?? "",
    );

    expect(labels.some((l) => l.includes("dev (1)"))).toBe(true);
    expect(labels.some((l) => l.includes("uat") && l.includes("no runs"))).toBe(
      true,
    );
  });
});
