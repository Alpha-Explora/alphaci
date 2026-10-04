import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { StageDetail } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-stage-detail";
import { stageEntries } from "../../../../../../src/features/projects/detail/model/pipeline-run-card-rules";
import {
  getProjectJobLog,
  getProjectRunFailureLog,
  type RunFailureLogResponse,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import type { StageReport, StageResults } from "../../../../../../src/shared/api/contracts";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectRunFailureLog: jest.fn(),
    getProjectJobLog: jest.fn(),
  }),
);

const mockedFailureLog = getProjectRunFailureLog as jest.MockedFunction<typeof getProjectRunFailureLog>;
const mockedJobLog = getProjectJobLog as jest.MockedFunction<typeof getProjectJobLog>;

const NO_ACCESS =
  "ALPHACI can't read this log: its GitHub connection has no access to Actions logs for this repository. Ask an admin to check the GitHub App's Actions permission.";
const EXPIRED = "This log has expired (GitHub keeps logs for 90 days).";

function report(status: StageReport["status"], results?: StageResults): StageReport {
  return {
    stage: "quality",
    status,
    runId: 42,
    friendlyMessages: [],
    githubRunUrl: "https://github.com/o/r/actions/runs/42",
    updatedAt: "2026-10-01T08:00:00Z",
    checks: [{ name: "lint", conclusion: status === "failure" ? "failure" : "success" }],
    ...(results ? { results } : {}),
  };
}

function entryFor(stage: StageReport) {
  return stageEntries([stage], [])[0]!;
}

describe("StageDetail failure output", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    mockedJobLog.mockResolvedValue({ available: true, truncated: false, content: "whole log line" });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  async function render(stage: StageReport, log?: RunFailureLogResponse) {
    if (log) mockedFailureLog.mockResolvedValue(log);
    await act(async () => {
      root = createRoot(host);
      root.render(<StageDetail projectId="p1" entry={entryFor(stage)} panelId="panel" viewMode="deep" />);
    });
  }

  it("shows every failed job with its step, hint and excerpt, and the jobs left out", async () => {
    await render(report("failure"), {
      available: true,
      jobId: 1,
      jobName: "lint / ESLint",
      lines: ["src/a.ts:1 error"],
      failures: [
        {
          jobId: 1,
          jobName: "lint / ESLint",
          stepName: "Run lint",
          lines: ["src/a.ts:1 error", "##[error]Process completed with exit code 1."],
          truncated: false,
          foundErrorMarker: true,
          hint: "ESLint found errors. Run npm run lint locally and fix them.",
        },
        {
          jobId: 2,
          jobName: "promote-to-uat / Create Promotion PR",
          lines: ["GraphQL: missing read:org"],
          truncated: true,
          foundErrorMarker: false,
        },
      ],
      omittedFailures: 2,
    });

    const blocks = [...host.querySelectorAll(".pipe-failures > .pipe-log")];
    expect(blocks.map((block) => block.querySelector(".pipe-log__source")?.textContent)).toEqual([
      "lint / ESLint › Run lint",
      "promote-to-uat / Create Promotion PR · earlier output omitted",
    ]);
    expect(blocks[0]!.querySelector(".pipe-hint")?.textContent).toBe(
      "What happenedESLint found errors. Run npm run lint locally and fix them.",
    );
    expect(blocks[1]!.querySelector(".pipe-hint")).toBeNull();
    expect(blocks[0]!.querySelector(".ws-console__line--error")?.textContent).toContain("exit code 1");
    expect(blocks[1]!.textContent).toContain("GraphQL: missing read:org");
    expect(host.querySelector(".pipe-failures__more")?.textContent).toBe("+2 more failed jobs");
  });

  it("opens a failed job's whole log in the product", async () => {
    await render(report("failure"), {
      available: true,
      failures: [
        { jobId: 7, jobName: "test", lines: ["boom"], truncated: false, foundErrorMarker: false },
      ],
    });

    const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "View full log")!;
    await act(async () => button.click());

    expect(mockedJobLog).toHaveBeenCalledWith("p1", 7);
    expect(host.textContent).toContain("whole log line");
    expect(button.textContent).toBe("Hide full log");
  });

  it("falls back to the single job an older backend describes", async () => {
    await render(report("failure"), {
      available: true,
      jobName: "sonar / Analysis",
      stepName: "Run scan",
      lines: ["sonar-project.properties files are not understood"],
      truncated: false,
      foundErrorMarker: true,
    });

    expect(host.querySelector(".pipe-log__source")?.textContent).toBe("sonar / Analysis › Run scan");
    expect(host.textContent).toContain("sonar-project.properties files are not understood");
    // No job id from the old backend: nothing to open.
    expect(host.textContent).not.toContain("View full log");
  });

  it.each([
    ["log-expired", EXPIRED],
    ["log-no-access", NO_ACCESS],
  ] as const)("says why a job's log is missing (%s)", async (reason, sentence) => {
    await render(report("failure"), {
      available: false,
      reason,
      failures: [
        { jobId: 3, jobName: "build", lines: [], truncated: false, foundErrorMarker: false, reason },
      ],
    });

    expect(host.querySelector(".pipe-log__source")?.textContent).toBe("build");
    expect(host.textContent).toContain(sentence);
    // The full log is just as unreadable: it is not offered.
    expect(host.textContent).not.toContain("View full log");
  });

  it.each([
    ["log-expired", EXPIRED],
    ["log-no-access", NO_ACCESS],
  ] as const)("says why the run's log is missing when no entry came back (%s)", async (reason, sentence) => {
    await render(report("failure"), { available: false, reason });

    expect(host.textContent).toContain(sentence);
  });
});

describe("StageDetail figures", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    mockedFailureLog.mockResolvedValue({ available: false, reason: "no-failed-job" });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  async function render(stage: StageReport) {
    await act(async () => {
      root = createRoot(host);
      root.render(<StageDetail projectId="p1" entry={entryFor(stage)} panelId="panel" viewMode="deep" />);
    });
  }

  function figures() {
    return [...host.querySelectorAll(".pipe-result")].map((figure) => [
      figure.querySelector("dt")?.textContent,
      figure.querySelector("dd")?.textContent,
      figure.className.replace("pipe-result pipe-result--", ""),
    ]);
  }

  it("shows a passing stage's figures, and reads no log for it", async () => {
    await render(
      report("success", {
        tests: { passed: 48, failed: 0, total: 48 },
        coverage: { pct: 87, threshold: 80 },
        lint: { errors: 0, warnings: 3 },
        security: { critical: 0, high: 0 },
        sonar: { gate: "OK" },
      }),
    );

    expect(figures()).toEqual([
      ["Tests", "48 / 48 passed", "success"],
      ["Coverage", "87% (min 80%)", "success"],
      ["Lint", "0 errors · 3 warnings", "warning"],
      ["Security", "0 critical · 0 high", "success"],
      ["Sonar", "Gate passed", "success"],
    ]);
    expect(mockedFailureLog).not.toHaveBeenCalled();
  });

  it("tones a failed figure and names the failing tests under it", async () => {
    await render(
      report("failure", {
        tests: {
          passed: 46,
          failed: 3,
          total: 49,
          failures: [
            { name: "orders > rejects an expired session", message: "expected 401, got 200" },
            { name: "cart > totals" },
          ],
        },
        coverage: { pct: 71.25, threshold: 80 },
      }),
    );

    expect(figures()).toEqual([
      ["Tests", "46 / 49 passed", "danger"],
      ["Coverage", "71.3% (min 80%)", "danger"],
    ]);
    const failures = [...host.querySelectorAll(".pipe-results__failure")].map((item) => item.textContent);
    expect(failures).toEqual(["orders > rejects an expired sessionexpected 401, got 200", "cart > totals"]);
    expect(host.querySelector(".pipe-results__more")?.textContent).toBe("+1 more failing");
  });

  it("shows no figures row when the backend sent no results", async () => {
    await render(report("success"));

    expect(host.querySelector(".pipe-results")).toBeNull();
  });
});
