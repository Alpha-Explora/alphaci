import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { normalizeProjectReport } from "../../../../../src/features/checklists/model/project-report-rules";
import { ProjectQaReportView } from "../../../../../src/features/checklists/report";
import { ProjectQaReportDocument } from "../../../../../src/features/checklists/report/views/project-report-document";
import { apiError } from "../checklist-fixtures";
import { projectReportWire } from "../project-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { report: jest.fn() },
}));

let search = "";
jest.mock("next/navigation", () => ({
  useParams: () => ({ deliveryProjectId: "dp-1", runId: "run-1" }),
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/qa/project-report/dp-1/run-1",
}));

const repo = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

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
  return normalizeProjectReport(projectReportWire(overrides))!;
}

describe("ProjectQaReportDocument", () => {
  it("names the project and every repository with the head the run captured", async () => {
    const view = await render(<ProjectQaReportDocument report={report()} />);
    expect(view.querySelector("h1")?.textContent).toBe("QA Report");
    expect(view.textContent).toContain("storefront");
    expect(view.textContent).toContain("2 repositories");
    expect(view.textContent).toContain("storefront-web @ a1b2c3d");
    expect(view.textContent).toContain("orders-api @ e4f5a6b");
  });

  it("lists each checklist item under the requirement it speaks for", async () => {
    const view = await render(<ProjectQaReportDocument report={report()} />);
    const rows = Array.from(view.querySelectorAll("#qa-report-checklist ~ * tbody tr, section[aria-labelledby='qa-report-checklist'] tbody tr"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Checkout with saved cards");
    expect(rows[0]?.textContent).toContain("Feature");
    expect(rows[0]?.textContent).toContain("Pay button never appears");
    expect(rows[1]?.textContent).toContain("Release smoke test");
    expect(rows[1]?.textContent).toContain("System requirement");
  });

  it("draws the automated results once per repository, with failures", async () => {
    const view = await render(<ProjectQaReportDocument report={report()} />);
    const section = view.querySelector("section[aria-labelledby='qa-report-automated']");
    const blocks = Array.from(section?.querySelectorAll(".qa-report-auto") ?? []);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.textContent).toContain("storefront-web");
    expect(blocks[0]?.textContent).toContain("18 / 20");
    expect(blocks[0]?.textContent).toContain("pays with a saved card");
    expect(blocks[1]?.textContent).toContain("orders-api");
    expect(blocks[1]?.textContent).toContain("9 / 9");
  });

  it("says results are not available when the run carries no per-repository breakdown", async () => {
    const view = await render(
      <ProjectQaReportDocument report={report({ run: { ...(projectReportWire().run as object), automationByRepository: undefined } })} />,
    );
    const section = view.querySelector("section[aria-labelledby='qa-report-automated']");
    expect(section?.textContent).toContain("Not available yet");
  });

  it("says a repository with nothing reported has no stage results yet", async () => {
    const run = projectReportWire().run as Record<string, unknown>;
    const view = await render(
      <ProjectQaReportDocument
        report={report({
          run: {
            ...run,
            automationByRepository: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: {} }],
          },
        })}
      />,
    );
    expect(view.textContent).toContain("CI had not reported the verify or quality stage for this head.");
  });

  it("logs the open defects with their requirement", async () => {
    const view = await render(<ProjectQaReportDocument report={report()} />);
    const section = view.querySelector("section[aria-labelledby='qa-report-defects']");
    expect(section?.textContent).toContain("As a shopper, I can pay with a saved card");
    expect(section?.textContent).toContain("Pay button never appears");
  });

  it("labels a live run as live and a signed-off one as frozen", async () => {
    const live = await render(<ProjectQaReportDocument report={report({ frozen: false })} />);
    expect(live.textContent).toContain("Live");
    expect(live.textContent).not.toContain("Frozen at sign-off");
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    const frozen = await render(<ProjectQaReportDocument report={report({ frozen: true })} />);
    expect(frozen.textContent).toContain("Frozen at sign-off");
  });
});

describe("ProjectQaReportView", () => {
  it("shows the report once it has loaded, with a print button", async () => {
    repo.report.mockResolvedValue(report());
    const view = await render(<ProjectQaReportView />);
    expect(repo.report).toHaveBeenCalledWith("dp-1", "run-1");
    expect(view.querySelector("article[aria-label='QA Report']")).not.toBeNull();
    const print = Array.from(view.querySelectorAll("button")).find((button) => /Print/.test(button.textContent ?? ""));
    expect(print?.disabled).toBe(false);
  });

  it("shows a loading skeleton, with Print disabled, until then", async () => {
    repo.report.mockReturnValue(new Promise(() => undefined));
    const view = await render(<ProjectQaReportView />);
    expect(view.querySelector("[aria-busy='true']")).not.toBeNull();
    const print = Array.from(view.querySelectorAll("button")).find((button) => /Print/.test(button.textContent ?? ""));
    expect(print?.disabled).toBe(true);
  });

  it("explains a report that is gone and offers to try again", async () => {
    repo.report.mockRejectedValue(apiError(404));
    const view = await render(<ProjectQaReportView />);
    expect(view.querySelector("[role='alert']")?.textContent).toContain("This report is not available");
    expect(Array.from(view.querySelectorAll("button")).some((button) => /Try again/.test(button.textContent ?? ""))).toBe(true);
  });

  it("asks a signed-out viewer to sign in", async () => {
    repo.report.mockRejectedValue(apiError(401));
    const view = await render(<ProjectQaReportView />);
    expect(view.querySelector("a[href='/login']")?.textContent).toBe("Sign in");
  });
});
