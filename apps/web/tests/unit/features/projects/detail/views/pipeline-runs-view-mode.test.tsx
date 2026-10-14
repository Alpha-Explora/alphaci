import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PipelineRunsTab } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-runs-tab";
import {
  getProjectWorkflowRuns,
  getProjectRunFailureLog,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import { getRuns } from "../../../../../../src/features/runs";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectWorkflowRuns: jest.fn(),
    getProjectRunJobs: jest.fn(),
    getProjectJobLog: jest.fn(),
    getProjectRunFailureLog: jest.fn(),
  }),
);

// Not under test here: the tab reads these once on open.
jest.mock("../../../../../../src/features/projects/detail/data/project-browser-tests-api", () => ({
  getProjectBrowserTests: jest.fn(() => Promise.reject(new Error("not under test"))),
  addProjectBrowserTests: jest.fn(),
}));
jest.mock("../../../../../../src/features/projects/detail/data/project-visual-api", () => ({
  getProjectVisualChecks: jest.fn(() => Promise.resolve({ branch: "uat", runId: null, canApprove: false, snapshots: [] })),
  approveProjectVisualChecks: jest.fn(),
}));

jest.mock("../../../../../../src/features/runs", () => ({
  ...jest.requireActual("../../../../../../src/features/runs"),
  getRuns: jest.fn(),
}));

const mockedRuns = getProjectWorkflowRuns as jest.MockedFunction<typeof getProjectWorkflowRuns>;
const mockedReports = getRuns as jest.MockedFunction<typeof getRuns>;
const mockedFailureLog = getProjectRunFailureLog as jest.MockedFunction<typeof getProjectRunFailureLog>;

const LOG_LINE = "sonar-project.properties files are not understood by the SonarScanner.";

/**
 * PERSONA_WORKFLOW_SPEC.md section 3: a developer gets the deep-debug view (tool
 * logs open, as always); lead, QA and admin get the summary, with the log
 * behind a "Show logs" disclosure per stage.
 */
describe("PipelineRunsTab summary vs deep debug", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    window.localStorage.setItem("alphaci.runs.branch.p1", "dev");

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
              checks: [{ name: "lint", conclusion: "failure" }],
            },
          ],
        },
      ],
    } as never);
    mockedFailureLog.mockResolvedValue({
      available: true,
      jobName: "sonar / Analysis",
      stepName: "Run scan",
      jobUrl: "https://github.com/org/repo/actions/runs/999/job/1",
      truncated: false,
      foundErrorMarker: true,
      lines: [LOG_LINE, "##[error]Process completed with exit code 1."],
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  async function render(appRole?: AppRole) {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" appRole={appRole} />);
    });
  }

  function logsToggle() {
    return host.querySelector<HTMLButtonElement>(".pipe-logs-toggle");
  }

  it("opens the tool log straight away for a developer", async () => {
    await render("member");

    expect(host.textContent).toContain(LOG_LINE);
    expect(logsToggle()).toBeNull();
    expect(mockedFailureLog).toHaveBeenCalledTimes(1);
  });

  it.each<AppRole | undefined>(["lead", "qa", "admin", undefined])(
    "keeps the log behind a disclosure for %s, with the stepper and verdict still visible",
    async (role) => {
      await render(role);

      expect(host.querySelector(".pipe-steps")).not.toBeNull();
      expect(host.querySelector(".pipe-stage__title")?.textContent).toContain("Quality");
      expect(host.textContent).not.toContain(LOG_LINE);
      // Nothing was fetched for a log nobody asked to see.
      expect(mockedFailureLog).not.toHaveBeenCalled();

      const toggle = logsToggle();
      expect(toggle?.textContent).toContain("Show logs");
      expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    },
  );

  it("shows the log after Show logs is pressed, and hides it again", async () => {
    await render("lead");

    await act(async () => {
      logsToggle()?.click();
    });
    expect(logsToggle()?.getAttribute("aria-expanded")).toBe("true");
    expect(logsToggle()?.textContent).toContain("Hide logs");
    expect(host.textContent).toContain(LOG_LINE);
    expect(mockedFailureLog).toHaveBeenCalledTimes(1);

    await act(async () => {
      logsToggle()?.click();
    });
    expect(logsToggle()?.getAttribute("aria-expanded")).toBe("false");
    expect(host.textContent).not.toContain(LOG_LINE);
  });
});
