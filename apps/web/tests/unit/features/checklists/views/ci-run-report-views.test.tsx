import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ciRunReportRepository } from "../../../../../src/features/checklists/data/ci-run-report-repository";
import { normalizeCiRunReport } from "../../../../../src/features/checklists/model/ci-run-report-rules";
import { CiRunReportView } from "../../../../../src/features/checklists/report";
import { CiRunReportDocument } from "../../../../../src/features/checklists/report/views/ci-run-report-document";
import { apiError } from "../checklist-fixtures";
import realCases from "../../runs/test-report/real-playwright-cases.json";
import { CI_REF, CI_SHA, ciRunReportWire } from "../ci-run-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/ci-run-report-repository", () => ({
  ciRunReportRepository: { report: jest.fn() },
}));

let search = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/runs/report",
}));

const repo = ciRunReportRepository as jest.Mocked<typeof ciRunReportRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  search = "";
  jest.clearAllMocks();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

function report(overrides: Record<string, unknown> = {}) {
  return normalizeCiRunReport(ciRunReportWire(overrides))!;
}

function section(view: HTMLElement, id: string): Element {
  return view.querySelector(`section[aria-labelledby='${id}']`)!;
}

describe("CiRunReportDocument", () => {
  it("names the repository, branch and commit, and the result", async () => {
    const view = await render(<CiRunReportDocument report={report()} />);
    expect(view.querySelector("h1")?.textContent).toBe("CI results");
    expect(view.textContent).toContain("acme/orders-api");
    expect(view.textContent).toContain("uat @ a1b2c3d");
    expect(view.querySelector(".qa-report-stamp")?.textContent).toContain("Failed");
    expect(view.textContent).toContain("1 of 4 stages passed, 1 failed, 2 not run");
  });

  it("puts the failures first, each with what happened, how to fix it and its details", async () => {
    const view = await render(<CiRunReportDocument report={report()} />);
    const sections = [...view.querySelectorAll("section")].map((node) => node.getAttribute("aria-labelledby"));
    expect(sections).toEqual(["ci-report-failures", "ci-report-stages", "ci-report-details"]);
    const failures = section(view, "ci-report-failures");
    expect(failures.textContent).toContain("2 tests failed");
    expect(failures.textContent).toContain("Two checkout tests did not pass.");
    expect(failures.textContent).toContain("Fix the failing tests, then re-run.");
    expect(failures.textContent).toContain("checkout › pays");
    expect(failures.textContent).toContain("Timed out");
    expect(failures.textContent).toContain("cart › coupon");
  });

  it("says nothing needs fixing when no stage failed", async () => {
    const view = await render(
      <CiRunReportDocument report={report({ failures: [], overallStatus: "success", summary: { stages: 1, passed: 1, failed: 0, inProgress: 0, notRun: 0 } })} />,
    );
    expect(section(view, "ci-report-failures").textContent).toContain("No failed stages");
  });

  it("tables every stage with its status and when it reported", async () => {
    const view = await render(<CiRunReportDocument report={report()} />);
    const rows = [...section(view, "ci-report-stages").querySelectorAll("tbody tr")];
    expect(rows.map((row) => row.querySelector("th")?.textContent)).toEqual(["Access", "Quality", "Package", "Verify"]);
    expect(rows[1]?.textContent).toContain("Failed");
    expect(rows[2]?.textContent).toContain("Blocked by an earlier failure");
    expect(rows[3]?.textContent).toContain("Not run yet");
    expect(rows[2]?.querySelectorAll("td")[1]?.textContent).toBe("—");
  });

  it("details a stage's figures, failed tests and checks, and says when it reported none", async () => {
    const view = await render(<CiRunReportDocument report={report()} />);
    const details = section(view, "ci-report-details");
    const blocks = [...details.querySelectorAll(".qa-report-auto")];
    expect(blocks).toHaveLength(4);
    const quality = blocks[1]!;
    expect(quality.textContent).toContain("18 / 20 passed, 2 failed");
    expect(quality.textContent).toContain("81.5% (threshold 80%)");
    expect(quality.textContent).toContain("0 errors, 3 warnings");
    expect(quality.textContent).toContain("0 critical, 1 high");
    expect(quality.textContent).toContain("0 secrets, 1 forbidden licences, 2 undetermined licences");
    expect(quality.textContent).toContain("ERROR");
    expect(quality.textContent).toContain("Failed tests (1 listed)");
    expect(quality.textContent).toContain("Unit tests");
    expect(blocks[0]!.textContent).toContain("No figures were reported for this stage.");
  });

  it("never links to GitHub", async () => {
    const view = await render(<CiRunReportDocument report={report()} />);
    expect(view.querySelector("a")).toBeNull();
    expect(view.innerHTML).not.toContain("github.com");
  });
});

describe("CiRunReportDocument details", () => {
  function withResults(stage: string, results: Record<string, unknown>) {
    const wire = ciRunReportWire();
    const stages = (wire.stages as Array<Record<string, unknown>>).map((entry) =>
      entry.stage === stage ? { ...entry, results } : entry,
    );
    return normalizeCiRunReport({ ...wire, stages })!;
  }

  it("prints every browser test, and the detail of each worth reading", async () => {
    const view = await render(
      <CiRunReportDocument report={withResults("verify", { tests: { total: 6, passed: 5, failed: 1, cases: realCases } })} />,
    );
    const details = section(view, "ci-report-details");
    expect(details.textContent).toContain("Browser tests (6)");
    expect(details.textContent).toContain("What it checks: Runs the axe accessibility checker on /");
    expect(details.textContent).toContain("Result: 3 critical or serious and 2 minor or moderate violations");
    expect(details.textContent).toContain("Check for critical or serious violations — failed");
    expect(details.querySelector("pre")?.textContent).toContain("label (critical)");
  });

  it("prints what SonarCloud said", async () => {
    const view = await render(
      <CiRunReportDocument
        report={withResults("quality", {
          sonar: {
            gate: "ERROR",
            failedConditions: [{ metric: "new_coverage", actual: "61.2", threshold: "80" }],
            measures: { bugs: "0" },
            issues: [{ rule: "r1", severity: "MAJOR", message: "Fix this.", file: "src/a.ts", line: 3 }],
          },
        })}
      />,
    );
    const details = section(view, "ci-report-details");
    expect(details.textContent).toContain("SonarCloud · Quality gate failed");
    expect(details.textContent).toContain("Failed: Coverage on new code 61.2% (needs 80%)");
    expect(details.textContent).toContain("Major · src/a.ts:3 · r1");
  });
});

describe("CiRunReportView", () => {
  const query = `repoFullName=acme/orders-api&branch=uat&commitSha=${CI_SHA}`;

  it("loads the execution the link names and shows it, with a print button", async () => {
    search = query;
    repo.report.mockResolvedValue(report());
    const view = await render(<CiRunReportView />);
    expect(repo.report).toHaveBeenCalledWith(CI_REF);
    expect(view.querySelector("article[aria-label='CI results']")).not.toBeNull();
    const print = [...view.querySelectorAll("button")].find((button) => /Print/.test(button.textContent ?? ""));
    expect(print?.disabled).toBe(false);
  });

  it("shows a loading skeleton, with Print disabled, until then", async () => {
    search = query;
    repo.report.mockReturnValue(new Promise(() => undefined));
    const view = await render(<CiRunReportView />);
    expect(view.querySelector("[aria-busy='true']")).not.toBeNull();
    const print = [...view.querySelectorAll("button")].find((button) => /Print/.test(button.textContent ?? ""));
    expect(print?.disabled).toBe(true);
  });

  it("explains a link that names no execution, without asking the server", async () => {
    search = "repoFullName=acme/orders-api";
    const view = await render(<CiRunReportView />);
    expect(repo.report).not.toHaveBeenCalled();
    expect(view.querySelector("[role='alert']")?.textContent).toContain("missing the repository, branch or commit");
  });

  it("explains a report that is gone and offers to try again", async () => {
    search = query;
    repo.report.mockRejectedValue(apiError(404));
    const view = await render(<CiRunReportView />);
    expect(view.querySelector("[role='alert']")?.textContent).toContain("This report is not available");
    expect([...view.querySelectorAll("button")].some((button) => /Try again/.test(button.textContent ?? ""))).toBe(true);
  });

  it("asks a signed-out viewer to sign in", async () => {
    search = query;
    repo.report.mockRejectedValue(apiError(401));
    const view = await render(<CiRunReportView />);
    expect(view.querySelector("a[href='/login']")?.textContent).toBe("Sign in");
  });
});
