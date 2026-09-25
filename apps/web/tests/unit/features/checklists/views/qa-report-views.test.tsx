import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { QaReportView } from "../../../../../src/features/checklists/report";
import { useQaExportViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-export-view-model";
import { ExportMenu, ExportStatus } from "../../../../../src/features/checklists/studio/views/export-menu";
import { downloadBlob } from "../../../../../src/shared/browser/download-blob";
import { apiError } from "../checklist-fixtures";
import { frozenReport, liveReport } from "../qa-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: { report: jest.fn(), reportMarkdown: jest.fn() },
}));
jest.mock("../../../../../src/shared/browser/download-blob", () => ({ downloadBlob: jest.fn() }));

let search = "";
jest.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "project-1", runId: "run-1" }),
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/projects/project-1/qa/report/run-1",
}));

const repo = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const download = downloadBlob as jest.MockedFunction<typeof downloadBlob>;

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

function click(element: Element | null | undefined) {
  if (!element) throw new Error("element not found");
  act(() => (element as HTMLElement).click());
}

async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/* ── Export menu ─────────────────────────────────────────────────────────── */

function ExportHarness() {
  const vm = useQaExportViewModel({ projectId: "project-1", runId: "run-1" });
  return (
    <>
      <ExportMenu vm={vm} />
      <ExportStatus vm={vm} />
    </>
  );
}

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
}

function menuItem(container: HTMLElement, name: string): HTMLElement | undefined {
  return [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((node) =>
    node.textContent?.includes(name),
  );
}

describe("ExportMenu", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockReset().mockResolvedValue(undefined);
  });

  it("is a menu button that opens, focuses the first item, and closes on Escape", async () => {
    const container = await render(<ExportHarness />);
    const button = trigger(container);
    expect(button.textContent).toContain("Export report");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[role="menu"]')).toBeNull();

    click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(button.getAttribute("aria-controls")).toBe(menu.id);
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map((node) => node.textContent);
    expect(items[0]).toContain("Download PDF");
    expect(items[1]).toContain("Copy PR Markdown");
    expect(items[2]).toContain("Download JSON");
    expect(document.activeElement).toBe(menuItem(container, "Download PDF"));

    act(() => {
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(document.activeElement).toBe(menuItem(container, "Copy PR Markdown"));
    act(() => {
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(document.activeElement).toBe(menuItem(container, "Download JSON"));

    act(() => {
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on a press outside", async () => {
    const container = await render(<ExportHarness />);
    click(trigger(container));
    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("Download PDF opens the print page with ?print=1 in a new tab", async () => {
    const container = await render(<ExportHarness />);
    click(trigger(container));
    const link = menuItem(container, "Download PDF") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/projects/project-1/qa/report/run-1?print=1");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(repo.report).not.toHaveBeenCalled();
  });

  it("Copy PR Markdown fetches the Markdown, copies it and shows Copied", async () => {
    repo.reportMarkdown.mockResolvedValue("# QA Report — orders-api");
    const container = await render(<ExportHarness />);
    click(trigger(container));
    click(menuItem(container, "Copy PR Markdown"));
    await settle();
    expect(repo.reportMarkdown).toHaveBeenCalledWith("project-1", "run-1");
    expect(repo.report).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("# QA Report — orders-api");
    expect(trigger(container).textContent).toContain("Copied");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("PR Markdown copied to the clipboard.");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows a clear message when the clipboard refuses", async () => {
    repo.reportMarkdown.mockResolvedValue("# QA Report");
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    const container = await render(<ExportHarness />);
    click(trigger(container));
    click(menuItem(container, "Copy PR Markdown"));
    await settle();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("blocked clipboard access, so nothing was copied");
    expect(trigger(container).textContent).toContain("Export report");
    click([...container.querySelectorAll("button")].find((node) => node.textContent === "Dismiss"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("Download JSON saves the report via downloadBlob", async () => {
    repo.report.mockResolvedValue(frozenReport());
    const container = await render(<ExportHarness />);
    click(trigger(container));
    click(menuItem(container, "Download JSON"));
    await settle();
    expect(repo.report).toHaveBeenCalledWith("project-1", "run-1");
    expect(repo.reportMarkdown).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledWith("QA-Report-orders-api-feat-checkout-a1b2c3d.json", expect.any(Blob));
  });
});

/* ── Print page ──────────────────────────────────────────────────────────── */

function sectionTitles(container: HTMLElement): string[] {
  return [...container.querySelectorAll("h2")].map((node) => node.textContent ?? "");
}

function text(container: HTMLElement): string {
  return container.textContent ?? "";
}

describe("QaReportView", () => {
  let print: jest.SpyInstance;

  beforeEach(() => {
    print = jest.spyOn(window, "print").mockImplementation(() => undefined);
  });

  afterEach(() => print.mockRestore());

  it("renders all six parts of the report from the fixture", async () => {
    repo.reportMarkdown.mockResolvedValue("");
    repo.report.mockResolvedValue(frozenReport());
    const container = await render(<QaReportView />);
    const page = text(container);

    // 1. Header and metadata
    expect(container.querySelector("h1")?.textContent).toBe("QA Report");
    expect(page).toContain("orders-api");
    expect(page).toContain("tone/orders-api");
    expect(page).toContain("feat/checkout");
    expect(page).toContain("a1b2c3d");
    expect(page).toContain("Deployed");
    expect(page).toContain("Release smoke test");
    expect(page).toContain("Version 3");
    expect(page).toContain("Signed off");
    expect(container.querySelector(".qa-report-stamp")?.textContent).toBe("VerdictConditional");
    expect(page).toContain("@tone-lead");
    expect(page).toContain("Frozen at sign-off");

    expect(sectionTitles(container)).toEqual([
      "Executive summary",
      "Checklist",
      "Automated results",
      "Defect log",
      "Sign-off",
    ]);

    // 2. Executive summary
    expect(container.querySelector(".qa-report-summary__figure")?.textContent).toBe("3 / 5 passed (60%)");
    const facts = [...container.querySelectorAll(".qa-report-fact")].map((node) => node.textContent);
    expect(facts).toEqual(["2Open defects", "0Blockers"]);
    expect(container.querySelector(".qa-report-bar")?.getAttribute("aria-label")).toBe("3 passed, 1 failed, 1 blocked");

    // 3. Checklist table
    const headers = [...container.querySelectorAll("thead th")].map((node) => node.textContent);
    expect(headers).toEqual(["#", "Item", "Persona", "Verification", "Status", "Notes"]);
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(5);
    const first = rows[0].textContent ?? "";
    expect(first).toContain("Checkout completes with a saved card");
    expect(first).toContain("Use the staging Visa ending 4242.");
    expect(first).toContain("QA Team");
    expect(first).toContain("Playwright E2E");
    expect(rows[0].querySelector("code")?.textContent).toBe("e2e/checkout.spec.ts › pays with a saved card");
    expect(first).toContain("Passed");
    expect(rows[1].textContent).toContain("Failed");
    expect(rows[1].textContent).toContain("Major");
    expect(rows[4].textContent).toContain("Everyone");
    expect(rows[4].textContent).toContain("Blocked");

    // 4. Automated results
    expect(page).toContain("Not available yet");

    // 5. Defect log
    const defects = [...container.querySelectorAll(".qa-report-defect")];
    expect(defects).toHaveLength(2);
    expect(defects[0].textContent).toContain("#2");
    expect(defects[0].textContent).toContain("Major");
    expect(defects[0].querySelector(".qa-report-prose--steps")?.textContent).toBe("1. Add two mugs\n2. Apply SPRING10");
    expect(defects[0].textContent).toContain("Re-test requested by @miguel-dev");
    expect(defects[0].textContent).toContain("Fixed in #218");
    expect(defects[1].textContent).toContain("Unrated");
    expect(defects[1].textContent).toContain("Not requested yet");

    // 6. Sign-off
    const signoff = container.querySelector(".qa-report-signoff")?.textContent ?? "";
    expect(signoff).toContain("Conditional");
    expect(signoff).toContain("Checkout verified on desktop and phone.");
    expect(signoff).toContain("Fix the coupon total in the next patch.");
    const history = [...container.querySelectorAll(".qa-report-history__item")];
    expect(history).toHaveLength(1);
    expect(history[0].textContent).toContain("Rejected");
    expect(history[0].textContent).toContain("by @tone-lead");
  });

  it("marks a live report as not signed off", async () => {
    repo.report.mockResolvedValue(liveReport());
    const container = await render(<QaReportView />);
    const page = text(container);
    expect(page).toContain("Live — not signed off");
    expect(page).not.toContain("Frozen at sign-off");
    expect(container.querySelector(".qa-report-stamp")?.textContent).toBe("VerdictNot signed off");
    expect(page).toContain("This run has not been signed off.");
    expect(container.querySelector(".qa-report-history")).toBeNull();
  });

  it("renders without the app shell: no nav, sidebar or dashboard frame", async () => {
    repo.report.mockResolvedValue(frozenReport());
    const container = await render(<QaReportView />);
    expect(container.querySelector("nav, aside, .dash-shell, .app-sidebar, .app-nav")).toBeNull();
    expect(container.querySelector(".qa-report-page")).not.toBeNull();
    const toolbar = container.querySelector(".qa-report-toolbar");
    expect(toolbar?.getAttribute("data-print")).toBe("hide");
    expect(toolbar?.textContent).toContain("Print / Save as PDF");
    const back = [...container.querySelectorAll("a")].find((node) => node.textContent?.includes("Back to QA Studio"));
    expect(back?.getAttribute("href")).toBe("/projects/project-1#qa");
  });

  it("Print / Save as PDF calls window.print", async () => {
    repo.report.mockResolvedValue(frozenReport());
    const container = await render(<QaReportView />);
    click([...container.querySelectorAll("button")].find((node) => node.textContent?.includes("Print / Save as PDF")));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("with ?print=1, calls window.print exactly once, after the report rendered", async () => {
    search = "print=1";
    let resolve: (value: ReturnType<typeof frozenReport>) => void = () => undefined;
    repo.report.mockReturnValue(new Promise((done) => (resolve = done)));
    let renderedWhenPrinted = false;
    print.mockImplementation(() => {
      renderedWhenPrinted = document.querySelector(".qa-report-table") !== null;
    });
    const container = await render(<QaReportView />);
    expect(print).not.toHaveBeenCalled();
    await act(async () => resolve(frozenReport()));
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
    expect(renderedWhenPrinted).toBe(true);
    expect(container.querySelector("h1")?.textContent).toBe("QA Report");
  });

  it("without ?print=1 it never prints on its own", async () => {
    repo.report.mockResolvedValue(frozenReport());
    await render(<QaReportView />);
    expect(print).not.toHaveBeenCalled();
  });

  it("says 'This report is not available' on a 404, with a retry", async () => {
    repo.report.mockRejectedValue(apiError(404));
    const container = await render(<QaReportView />);
    expect(container.querySelector('[role="alert"] h1')?.textContent).toBe("This report is not available");
    const retry = [...container.querySelectorAll("button")].find((node) => node.textContent === "Try again");
    repo.report.mockResolvedValue(frozenReport());
    click(retry);
    await settle();
    expect(container.querySelector("h1")?.textContent).toBe("QA Report");
  });
});
