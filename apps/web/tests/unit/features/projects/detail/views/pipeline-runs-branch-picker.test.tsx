import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PipelineRunsTab } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-runs-tab";
import {
  getProjectWorkflowRuns,
  getProjectRunFailureLog,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import { getRuns } from "../../../../../../src/features/runs";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectWorkflowRuns: jest.fn(),
    getProjectRunJobs: jest.fn(),
    getProjectJobLog: jest.fn(),
    getProjectRunFailureLog: jest.fn(),
  }),
);

/* Only the network call is stubbed. The rest of the barrel is pure rules —
 * checkTone, checkLabel, summarizeChecks — and replacing them with nothing
 * made the view throw the moment it started rendering the check roster. A
 * mock that erases more of a module than the test needs breaks on the next
 * thing that module legitimately grows. */
jest.mock("../../../../../../src/features/runs", () => ({
  ...jest.requireActual("../../../../../../src/features/runs"),
  getRuns: jest.fn(),
}));

const mockedRuns = getProjectWorkflowRuns as jest.MockedFunction<
  typeof getProjectWorkflowRuns
>;
const mockedReports = getRuns as jest.MockedFunction<typeof getRuns>;
const mockedFailureLog = getProjectRunFailureLog as jest.MockedFunction<
  typeof getProjectRunFailureLog
>;

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
    mockedFailureLog.mockResolvedValue({ available: false });
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

/**
 * The change this whole feature exists for: the card must contain the error,
 * not an instruction to go and read it on GitHub.
 */
describe("PipelineRunsTab failure output", () => {
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
          name: "ALPHACI Quality",
          displayTitle: "ci: add ALPHACI workflow",
          headBranch: "dev",
          headSha: "a98cf829",
          event: "push",
          status: "completed",
          conclusion: "failure",
          runNumber: 1,
          runAttempt: 1,
          htmlUrl: "https://github.com/org/repo/actions/runs/1",
          actor: "bot",
          createdAt: "2026-09-09T08:00:00Z",
          updatedAt: "2026-09-09T08:01:00Z",
        },
      ],
    });

    mockedReports.mockResolvedValue({
      runs: [
        {
          runId: 999,
          repoFullName: "org/repo",
          branch: "dev",
          commitSha: "a98cf829",
          startedAt: "2026-09-09T08:00:00Z",
          overallStatus: "failure",
          stages: [
            {
              stage: "quality",
              status: "failure",
              runId: 999,
              friendlyMessages: [],
              githubRunUrl: "https://github.com/org/repo/actions/runs/999",
              updatedAt: "2026-09-09T08:01:00Z",
            },
          ],
        },
      ],
    });

    mockedFailureLog.mockResolvedValue({
      available: true,
      jobName: "sonar / SonarCloud .NET Analysis",
      stepName: "Run SonarSource/sonarcloud-github-action",
      jobUrl: "https://github.com/org/repo/actions/runs/999/job/1",
      truncated: false,
      foundErrorMarker: true,
      // Shaped like the real excerpt: 30 lines of analyzer provisioning, then
      // the reason. Rendering it in order buried the reason below the fold.
      lines: [
        ...Array.from(
          { length: 30 },
          (_, i) => `Processing plugin: noise-${String(i)}`,
        ),
        "sonar-project.properties files are not understood by the SonarScanner for .NET.",
        "Post-processing failed. Exit code: 1",
        "##[error]Process completed with exit code 1.",
      ],
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  it("shows the real error output, not a note telling you to go read it", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    const text = host.textContent ?? "";
    expect(text).toContain("sonar-project.properties files are not understood");
    expect(text).toContain("Post-processing failed");
    expect(text).not.toContain("Open the workflow logs");
  });

  it("names the job and step the output came from", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    expect(host.textContent).toContain("SonarCloud .NET Analysis");
  });

  it("does not ask GitHub for a log when the stage never ran", async () => {
    mockedReports.mockResolvedValue({
      runs: [
        {
          runId: 999,
          repoFullName: "org/repo",
          branch: "dev",
          commitSha: "a98cf829",
          startedAt: "2026-09-09T08:00:00Z",
          overallStatus: "failure",
          stages: [
            {
              stage: "package",
              status: "blocked",
              runId: 999,
              friendlyMessages: [],
              githubRunUrl: "https://github.com/org/repo/actions/runs/999",
              updatedAt: "2026-09-09T08:01:00Z",
            },
          ],
        },
      ],
    });

    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    expect(mockedFailureLog).not.toHaveBeenCalled();
  });
});

/**
 * A forty-line excerpt whose last line is the failure renders with the failure
 * out of sight unless the tail is what gets shown. Showing lots of context and
 * hiding the conclusion is the same failure as saying nothing.
 */
describe("PipelineRunsTab log excerpt", () => {
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
          name: "ALPHACI Quality",
          displayTitle: "ci: add ALPHACI workflow",
          headBranch: "dev",
          headSha: "a98cf829",
          event: "push",
          status: "completed",
          conclusion: "failure",
          runNumber: 1,
          runAttempt: 1,
          htmlUrl: "https://github.com/org/repo/actions/runs/1",
          actor: "bot",
          createdAt: "2026-09-09T08:00:00Z",
          updatedAt: "2026-09-09T08:01:00Z",
        },
      ],
    });

    mockedReports.mockResolvedValue({
      runs: [
        {
          runId: 999,
          repoFullName: "org/repo",
          branch: "dev",
          commitSha: "a98cf829",
          startedAt: "2026-09-09T08:00:00Z",
          overallStatus: "failure",
          stages: [
            {
              stage: "quality",
              status: "failure",
              runId: 999,
              friendlyMessages: [],
              githubRunUrl: "https://github.com/org/repo/actions/runs/999",
              updatedAt: "2026-09-09T08:01:00Z",
            },
          ],
        },
      ],
    });

    mockedFailureLog.mockResolvedValue({
      available: true,
      jobName: "sonar / SonarCloud .NET Analysis",
      stepName: "Run SonarSource/sonarcloud-github-action",
      jobUrl: "https://github.com/org/repo/actions/runs/999/job/1",
      truncated: false,
      foundErrorMarker: true,
      lines: [
        ...Array.from(
          { length: 30 },
          (_, i) => `Processing plugin: noise-${String(i)}`,
        ),
        "sonar-project.properties files are not understood by the SonarScanner for .NET.",
        "Post-processing failed. Exit code: 1",
        "##[error]Process completed with exit code 1.",
      ],
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  it("shows the error without anyone expanding anything", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    const shown = host.querySelector("pre")?.textContent ?? "";
    expect(shown).toContain("Post-processing failed");
    expect(shown).toContain(
      "sonar-project.properties files are not understood",
    );
  });

  it("keeps the provisioning noise out of the way until asked", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    const shown = host.querySelector("pre")?.textContent ?? "";
    expect(shown).not.toContain("noise-0");
    expect(host.textContent).toContain("earlier lines");
  });

  it("marks the error line so it is findable at a glance", async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" />);
    });

    const errorLine = host.querySelector(".ws-console__line--error");
    expect(errorLine?.textContent).toContain(
      "Process completed with exit code 1",
    );
  });
});
