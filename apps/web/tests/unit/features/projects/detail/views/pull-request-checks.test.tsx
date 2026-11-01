import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PullRequestChecks } from "../../../../../../src/features/projects/detail/views/workspace/pull-request-checks";
import {
  getProjectJobLog,
  type PullRequestCheck,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectJobLog: jest.fn(),
  }),
);

const mockedJobLog = getProjectJobLog as jest.MockedFunction<typeof getProjectJobLog>;

function check(overrides: Partial<PullRequestCheck> & { name: string }): PullRequestCheck {
  return {
    status: "completed",
    conclusion: "success",
    detailsUrl: "https://github.com/o/r/runs/1",
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

const STATUSES: PullRequestCheck[] = [
  check({ name: "alphaci/access", kind: "status", description: "The access stage passed." }),
  check({ name: "alphaci/quality", kind: "status", conclusion: "failure", description: "The quality stage failed." }),
];

/** The new backend's shape: workflow, event, job id, output and annotations. */
const FAILING: PullRequestCheck[] = [
  ...STATUSES,
  check({ name: "build", id: 11, kind: "check-run", workflowName: "Quality", event: "pull_request", jobId: 11 }),
  check({ name: "build", id: 12, kind: "check-run", workflowName: "Quality", event: "push", jobId: 12 }),
  check({
    name: "lint",
    id: 13,
    kind: "check-run",
    workflowName: "Quality",
    event: "pull_request",
    conclusion: "failure",
    jobId: 13,
    title: "ESLint found 2 problems",
    summary: "**2 errors**\n<img src=x onerror=alert(1)>",
    annotations: [
      { path: "src/app.ts", line: 12, level: "failure", title: null, message: "'x' is defined but never used." },
      { path: "src/lib.ts", line: null, level: "warning", title: "Style", message: "Prefer const." },
    ],
  }),
  check({ name: "SonarCloud Code Analysis", id: 14, kind: "check-run", workflowName: null, status: "in_progress", conclusion: null }),
];

describe("PullRequestChecks", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    mockedJobLog.mockResolvedValue({
      available: true,
      truncated: false,
      content: "2026-09-22T14:02:31.0000000Z ##[error]Process completed with exit code 1.",
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  async function render(checks: PullRequestCheck[]) {
    await act(async () => {
      root = createRoot(host);
      root.render(<PullRequestChecks projectId="p1" checks={checks} />);
    });
  }

  function button(text: string) {
    return [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  }

  it("summarises, shows the stages as pills, and opens the list when something failed", async () => {
    await render(FAILING);

    expect(host.querySelector(".ws-checks__summary")?.textContent).toBe(
      "6 checks · 3 passed · 2 failed · 1 running",
    );
    expect([...host.querySelectorAll(".ws-stagepill")].map((pill) => pill.textContent)).toEqual([
      "✓Access passed",
      "✗Quality failed",
    ]);
    // Stage statuses are pills, not rows.
    expect(host.textContent).not.toContain("alphaci/quality");
    expect(button("Hide checks")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("groups by workflow, failures first, and tells same-named checks apart", async () => {
    await render(FAILING);

    const groups = [...host.querySelectorAll(".ws-checkgroup")];
    expect(groups.map((group) => group.querySelector(".ws-checkgroup__title")?.textContent)).toEqual([
      "Quality3",
      "Other checks1",
    ]);
    const names = [...groups[0]!.querySelectorAll(".ws-check__name")].map((name) => name.textContent);
    expect(names).toEqual(["lint", "build", "build"]);
    const qualifiers = [...groups[0]!.querySelectorAll(".ws-check__qualifier")].map((q) => q.textContent);
    expect(qualifiers).toEqual(["Quality · pull_request", "Quality · push"]);
  });

  it("opens a failed check on its own error: title, summary as text, annotations", async () => {
    await render(FAILING);

    const lint = [...host.querySelectorAll<HTMLElement>(".ws-check")].find(
      (row) => row.querySelector(".ws-check__name")?.textContent === "lint",
    )!;
    expect(lint.querySelector("details")?.open).toBe(true);
    expect(lint.querySelector(".ws-check__title")?.textContent).toBe("ESLint found 2 problems");
    // Markdown and HTML stay text: nothing from the check is injected.
    expect(lint.querySelector(".ws-check__text")?.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(lint.querySelector("img")).toBeNull();
    const annotations = [...lint.querySelectorAll(".ws-annotation")];
    expect(annotations.map((item) => item.textContent)).toEqual([
      "src/app.ts:12 — 'x' is defined but never used.",
      "src/lib.ts — Style: Prefer const.",
    ]);
    expect(annotations[0]!.className).toContain("ws-annotation--failure");
    expect(annotations[1]!.className).toContain("ws-annotation--warning");
  });

  it("reads the failed job's log in the product on View log, once", async () => {
    await render(FAILING);

    const lint = [...host.querySelectorAll<HTMLElement>(".ws-check")].find(
      (row) => row.querySelector(".ws-check__name")?.textContent === "lint",
    )!;
    const view = [...lint.querySelectorAll("button")].find((candidate) => candidate.textContent === "View log")!;
    await act(async () => view.click());

    expect(mockedJobLog).toHaveBeenCalledWith("p1", 13);
    expect(lint.textContent).toContain("Process completed with exit code 1.");

    await act(async () => view.click());
    await act(async () => view.click());
    expect(mockedJobLog).toHaveBeenCalledTimes(1);
  });

  it("says why a log cannot be read instead of calling it expired", async () => {
    mockedJobLog.mockResolvedValue({ available: false, truncated: false, content: "", reason: "log-no-access" });
    await render(FAILING);

    const lint = [...host.querySelectorAll<HTMLElement>(".ws-check")].find(
      (row) => row.querySelector(".ws-check__name")?.textContent === "lint",
    )!;
    await act(async () => [...lint.querySelectorAll("button")].find((b) => b.textContent === "View log")!.click());

    expect(lint.textContent).toContain("Ask an admin to check the GitHub App's Actions permission.");
  });

  it("folds a clean pull request down to the count and the pills", async () => {
    await render([
      check({ name: "alphaci/access", kind: "status" }),
      check({ name: "alphaci/quality", kind: "status" }),
      check({ name: "build", id: 11, kind: "check-run", workflowName: "Quality", event: "pull_request", jobId: 11 }),
    ]);

    expect(host.querySelector(".ws-checks__summary")?.textContent).toBe("3 checks · 3 passed");
    expect(host.querySelectorAll(".ws-stagepill")).toHaveLength(2);
    expect(host.querySelector(".ws-checkgroup")).toBeNull();
    expect(button("Show all 3 checks")?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => button("Show all 3 checks")!.click());
    expect(host.querySelector(".ws-check__name")?.textContent).toBe("build");
    // A passing check with a job id can be opened, but does not open itself.
    expect(host.querySelector(".ws-check details")?.hasAttribute("open")).toBe(false);
  });

  it("never links out to GitHub", async () => {
    await render(FAILING);

    expect(host.querySelector("a")).toBeNull();
    expect(host.querySelector('a[href*="github.com"]')).toBeNull();
  });
});
