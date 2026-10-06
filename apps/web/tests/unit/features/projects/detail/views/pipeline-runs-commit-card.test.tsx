import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PipelineRunsTab } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-runs-tab";
import {
  getProjectRunFailureLog,
  getProjectRunJobs,
  getProjectWorkflowRuns,
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
const mockedJobs = getProjectRunJobs as jest.MockedFunction<typeof getProjectRunJobs>;

const REPEATED = "dev · Release: Promote DEV → UAT (6380118)";

function run(id: number, sha: string, conclusion: string, event = "workflow_run", title = REPEATED) {
  return {
    id,
    name: title,
    displayTitle: title,
    headBranch: "dev",
    headSha: sha,
    event,
    status: "completed",
    conclusion,
    runNumber: id,
    runAttempt: 1,
    htmlUrl: `https://github.com/org/repo/actions/runs/${String(id)}`,
    actor: "LloydLim1",
    createdAt: "2026-09-25T08:00:00Z",
    updatedAt: "2026-09-25T08:02:00Z",
  };
}

function stage(name: string, status: string, runId: number, checks?: [string, string][], friendlyMessages: unknown[] = []) {
  return {
    stage: name,
    status,
    runId,
    friendlyMessages,
    githubRunUrl: `https://github.com/org/repo/actions/runs/${String(runId)}`,
    updatedAt: "2026-09-25T08:02:00Z",
    checks: checks?.map(([checkName, conclusion]) => ({ name: checkName, conclusion })),
  };
}

/* The screenshot that prompted the redesign, as data: package reported
 * success with the promotion still running, GitHub then failed the package run,
 * and verify never started. Plus a clean commit and a second commit that shares
 * the first one's inherited run title. */
function installFixtures() {
  mockedRuns.mockResolvedValue({
    repoFullName: "org/repo",
    actionsUrl: "https://github.com/org/repo/actions",
    runs: [
      run(14, "aaaaaaa1", "failure"),
      run(13, "aaaaaaa1", "success"),
      run(12, "bbbbbbb2", "success"),
    ],
  });
  mockedReports.mockResolvedValue({
    runs: [
      {
        runId: 13,
        repoFullName: "org/repo",
        branch: "dev",
        commitSha: "aaaaaaa1",
        startedAt: "2026-09-25T08:00:00Z",
        overallStatus: "failure",
        stages: [
          stage("quality", "success", 13, [["lint", "success"]]),
          stage("package", "success", 14, [
            ["build", "success"],
            ["promote-to-uat", "in_progress"],
            ["deploy-render-api-uat", "skipped"],
          ]),
          stage("verify", "stalled", 0, [], [
            { severity: "error", title: "Stage reported nothing", detail: "Verify never reported.", hint: "A very long generic hint." },
          ]),
        ],
      },
      {
        runId: 12,
        repoFullName: "org/repo",
        branch: "dev",
        commitSha: "bbbbbbb2",
        startedAt: "2026-09-25T07:00:00Z",
        overallStatus: "success",
        stages: [stage("quality", "success", 12, [["lint", "success"]])],
      },
    ],
  } as never);
  mockedFailureLog.mockResolvedValue({ available: false });
  mockedJobs.mockResolvedValue([]);
}

describe("PipelineRunsTab commit card", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    window.localStorage.setItem("alphaci.runs.branch.p1", "dev");
    installFixtures();
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  async function render() {
    await act(async () => {
      root = createRoot(host);
      root.render(<PipelineRunsTab projectId="p1" appRole="member" />);
    });
  }

  function cards() {
    return [...host.querySelectorAll<HTMLElement>("[data-commit-card]")];
  }

  function steps(card: HTMLElement) {
    return [...card.querySelectorAll<HTMLButtonElement>(".pipe-step__button")].map((button) => button.textContent);
  }

  it("reads each stage in one plain word, reconciled with GitHub", async () => {
    await render();

    expect(steps(cards()[0]!)).toEqual(["QualityPassed", "PackageFailed after passing", "VerifyDid not start"]);
  });

  it("opens the failing stage without a click, and leaves a clean commit compact", async () => {
    await render();

    const [failing, clean] = cards();
    expect(failing!.querySelector(".pipe-stage__title")?.textContent).toContain("Package");
    expect(clean!.querySelector(".pipe-stage")).toBeNull();
  });

  it("opens and closes a stage from its step", async () => {
    await render();

    const clean = cards()[1]!;
    const step = clean.querySelector<HTMLButtonElement>(".pipe-step__button")!;
    await act(async () => step.click());
    expect(step.getAttribute("aria-expanded")).toBe("true");
    expect(clean.querySelector(".pipe-stage")).not.toBeNull();

    await act(async () => step.click());
    expect(step.getAttribute("aria-expanded")).toBe("false");
    expect(clean.querySelector(".pipe-stage")).toBeNull();
  });

  it("says the promotion failed rather than that it was never opened", async () => {
    await render();

    expect(cards()[0]!.textContent).toContain("The promotion into uat failed after Package reported");
  });

  it("drops a title every commit shares, and identifies the commit by its sha", async () => {
    await render();

    expect(cards().map((card) => card.querySelector("h4")?.textContent)).toEqual([
      "Commit aaaaaaa",
      "Commit bbbbbbb",
    ]);
  });

  it("reads the log only for the stage that failed after passing, never for a clean commit", async () => {
    await render();

    // Package passed, then its run (14) failed: that log is read, once. The
    // clean commit and the stalled Verify stage ask for nothing.
    expect(mockedFailureLog).toHaveBeenCalledTimes(1);
    expect(mockedFailureLog).toHaveBeenCalledWith("p1", 14);
  });

  it("shows the promotion job's error under a stage that failed after passing", async () => {
    mockedFailureLog.mockResolvedValue({
      available: true,
      jobId: 901,
      jobName: "promote-to-uat / Create Promotion PR",
      lines: ["##[error]GraphQL: Your token has not been granted the required scopes (read:org)."],
      truncated: false,
      foundErrorMarker: true,
      hint: "The token that opens promotion pull requests is missing the read:org scope.",
      failures: [
        {
          jobId: 901,
          jobName: "promote-to-uat / Create Promotion PR",
          stepName: "Open the promotion PR",
          lines: ["##[error]GraphQL: Your token has not been granted the required scopes (read:org)."],
          truncated: false,
          foundErrorMarker: true,
          hint: "The token that opens promotion pull requests is missing the read:org scope.",
        },
      ],
    });

    await render();

    const stageCard = cards()[0]!.querySelector(".pipe-stage")!;
    expect(stageCard.textContent).toContain("failed after the stage reported success");
    expect(stageCard.textContent).not.toContain("still running at report time");
    expect(stageCard.querySelector(".pipe-log__source")?.textContent).toBe(
      "promote-to-uat / Create Promotion PR › Open the promotion PR",
    );
    expect(stageCard.querySelector(".pipe-hint")?.textContent).toContain("missing the read:org scope");
    expect(stageCard.textContent).toContain("required scopes (read:org)");
  });

  it("loads jobs only when a single run is opened, never for the list", async () => {
    await render();

    const card = cards()[0]!;
    await act(async () => card.querySelector<HTMLButtonElement>("[data-runs-toggle]")!.click());
    expect(card.querySelectorAll("[data-run-head]")).toHaveLength(2);
    expect(mockedJobs).not.toHaveBeenCalled();

    await act(async () => card.querySelector<HTMLButtonElement>("[data-run-head]")!.click());
    expect(mockedJobs).toHaveBeenCalledTimes(1);
    expect(mockedJobs).toHaveBeenCalledWith("p1", 14);
  });

  it("previews each failed job's error inline, from one failure-log read per run", async () => {
    const failure = (jobId: number, jobName: string, line: string, hint?: string) => ({
      jobId,
      jobName,
      lines: ["", line, "##[error]Process completed with exit code 1."],
      truncated: false,
      foundErrorMarker: true,
      ...(hint ? { hint } : {}),
    });
    mockedFailureLog.mockResolvedValue({
      available: true,
      failures: [
        failure(901, "promote-to-uat / Create Promotion PR", "GraphQL: missing read:org", "Add the read:org scope."),
        failure(902, "production-gate / Readiness", "##[error]Readiness check failed: 2 open issues"),
      ],
    });
    const job = (id: number, name: string, conclusion: string) => ({
      id,
      name,
      status: "completed",
      conclusion,
      startedAt: null,
      completedAt: null,
      htmlUrl: null,
      steps: [{ name: "Set up job", status: "completed", conclusion: "success", number: 1, startedAt: null, completedAt: null }],
    });
    mockedJobs.mockResolvedValue([
      job(900, "build", "success"),
      job(901, "promote-to-uat / Create Promotion PR", "failure"),
      job(902, "production-gate / Readiness", "failure"),
    ]);

    await render();
    const before = mockedFailureLog.mock.calls.length;
    const card = cards()[0]!;
    await act(async () => card.querySelector<HTMLButtonElement>("[data-runs-toggle]")!.click());
    await act(async () => card.querySelector<HTMLButtonElement>("[data-run-head]")!.click());

    // One read for the expanded run, however many of its jobs failed.
    expect(mockedFailureLog.mock.calls.length - before).toBe(1);
    const rows = [...card.querySelectorAll<HTMLElement>(".pipe-job")];
    expect(rows).toHaveLength(3);
    expect(rows[0]!.querySelector(".pipe-job__error")).toBeNull();
    // The tool's line, not the runner's "exit code 1", and above the steps.
    expect(rows[1]!.querySelector(".pipe-job__preview")?.textContent).toBe("GraphQL: missing read:org");
    expect(rows[1]!.querySelector(".pipe-hint")?.textContent).toContain("Add the read:org scope.");
    expect(rows[2]!.querySelector(".pipe-job__preview")?.textContent).toBe("Readiness check failed: 2 open issues");
    expect(rows[2]!.querySelector(".pipe-hint")).toBeNull();
    const error = rows[1]!.querySelector(".pipe-job__error")!;
    const steps = rows[1]!.querySelector(".pipe-job__steps")!;
    expect(error.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no link to GitHub, even with a run list and a run open", async () => {
    await render();

    const card = cards()[0]!;
    await act(async () => card.querySelector<HTMLButtonElement>("[data-runs-toggle]")!.click());
    await act(async () => card.querySelector<HTMLButtonElement>("[data-run-head]")!.click());
    // The fixture carries htmlUrl, githubRunUrl and actionsUrl; none may surface.
    expect(card.querySelector("[data-run-head][aria-expanded='true']")).not.toBeNull();
    expect(host.querySelector('a[href*="github.com"]')).toBeNull();
    expect(host.textContent).not.toContain("Open this run on GitHub");
    expect(host.textContent).not.toContain("Open Actions on GitHub");
  });

  it("names each workflow run by the stage it executed", async () => {
    await render();

    const card = cards()[0]!;
    await act(async () => card.querySelector<HTMLButtonElement>("[data-runs-toggle]")!.click());
    const labels = [...card.querySelectorAll(".pipe-run__label")].map((label) => label.textContent);
    expect(labels).toEqual(["Package workflow", "Quality workflow"]);
  });

  it("keeps a graded commit's run list folded when its report arrives after the runs", async () => {
    // The report is fetched after the run list, so the first render has no
    // report and shows the runs. Seeding the fold from that render left every
    // graded commit's run list open once the report landed.
    const graded = await getRuns();
    let release: (value: typeof graded) => void = () => undefined;
    mockedReports.mockReturnValue(new Promise((resolve) => (release = resolve)));

    await render();
    expect(cards()[0]!.querySelectorAll("[data-run-head]")).toHaveLength(2);

    await act(async () => release(graded));
    expect(cards()[0]!.querySelectorAll("[data-run-head]")).toHaveLength(0);
  });
});
