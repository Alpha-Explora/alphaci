import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaAttachmentsRepository } from "../../../../../src/features/checklists/data/qa-attachments-repository";
import { normalizeProjectReport } from "../../../../../src/features/checklists/model/project-report-rules";
import { ProjectQaReportView } from "../../../../../src/features/checklists/report";
import { ProjectQaReportDocument } from "../../../../../src/features/checklists/report/views/project-report-document";
import { attachment } from "../attachment-fixtures";
import { apiError } from "../checklist-fixtures";
import { projectReportWire } from "../project-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { report: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/qa-attachments-repository", () => ({
  qaAttachmentsRepository: { listForRun: jest.fn() },
}));

let search = "";
jest.mock("next/navigation", () => ({
  useParams: () => ({ deliveryProjectId: "dp-1", runId: "run-1" }),
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/qa/project-report/dp-1/run-1",
}));

const repo = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const attachments = qaAttachmentsRepository as jest.Mocked<typeof qaAttachmentsRepository>;

let root: Root | null = null;
let print: jest.SpyInstance;

beforeEach(() => {
  print = jest.spyOn(window, "print").mockImplementation(() => undefined);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  search = "";
  print.mockRestore();
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  await flush();
  return container;
}

/** The report with screenshots frozen on its first item. */
function reportWithEvidence() {
  const wire = projectReportWire();
  const items = (wire.run as { items: Record<string, unknown>[] }).items;
  items[0].attachments = [
    { id: "att-1", caption: "Pay button missing", kind: "evidence", contentType: "image/webp" },
    { id: "att-2", caption: null, kind: "evidence", contentType: "image/png" },
  ];
  return normalizeProjectReport(wire)!;
}

function runList() {
  return [
    attachment({ id: "att-1", url: "https://storage.example.test/a.webp" }),
    attachment({ id: "att-2", url: "https://storage.example.test/b.png" }),
  ];
}

describe("Project report: each item's own screenshots", () => {
  it("draws nothing extra without a renderer, or for an item without screenshots", async () => {
    const view = await render(<ProjectQaReportDocument report={reportWithEvidence()} />);
    expect(view.querySelector(".qa-report-evidence")).toBeNull();
    expect(view.querySelectorAll("#qa-report-checklist ~ * tbody tr, section[aria-labelledby='qa-report-checklist'] tbody tr")).toHaveLength(2);
  });

  it("shows them under the item, eager, with captions, beside an unchanged Visual evidence appendix", async () => {
    repo.report.mockResolvedValue(reportWithEvidence());
    attachments.listForRun.mockResolvedValue(runList());
    const view = await render(<ProjectQaReportView renderEvidence={() => <p>appendix</p>} />);
    expect(attachments.listForRun).toHaveBeenCalledWith("dp-1", "run-1");
    const rows = [...view.querySelectorAll("section[aria-labelledby='qa-report-checklist'] tbody tr")];
    // Item 1, its evidence row, item 2.
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute("data-evidence")).toBe("true");
    const images = [...rows[1].querySelectorAll<HTMLImageElement>("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://storage.example.test/a.webp",
      "https://storage.example.test/b.png",
    ]);
    expect(images.every((img) => img.getAttribute("loading") === "eager")).toBe(true);
    expect(images.map((img) => img.alt)).toEqual(["Pay button missing", "Screenshot 2 of As a shopper, I can pay with a saved card"]);
    expect(rows[1].textContent).toContain("Pay button missing");
    expect(rows[1].textContent).toContain("Screenshot 2");
    expect(view.querySelector("section[aria-labelledby='qa-report-visual']")?.textContent).toContain("appendix");
  });

  it("reads nothing for a report without per-item screenshots", async () => {
    repo.report.mockResolvedValue(normalizeProjectReport(projectReportWire())!);
    await render(<ProjectQaReportView />);
    expect(attachments.listForRun).not.toHaveBeenCalled();
  });

  it("still prints with captions when the images could not be read", async () => {
    search = "print=1";
    repo.report.mockResolvedValue(reportWithEvidence());
    attachments.listForRun.mockRejectedValue(apiError(503));
    const view = await render(<ProjectQaReportView />);
    expect(view.textContent).toContain("The screenshot could not be loaded.");
    expect(view.textContent).toContain("Pay button missing");
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("waits for every image to load or fail before opening the print dialog", async () => {
    search = "print=1";
    repo.report.mockResolvedValue(reportWithEvidence());
    attachments.listForRun.mockResolvedValue(runList());
    const view = await render(<ProjectQaReportView />);
    const images = [...view.querySelectorAll<HTMLImageElement>(".qa-report-evidence img")];
    expect(images).toHaveLength(2);
    expect(print).not.toHaveBeenCalled();
    await act(async () => {
      images[0].dispatchEvent(new Event("load"));
    });
    await flush();
    expect(print).not.toHaveBeenCalled();
    await act(async () => {
      images[1].dispatchEvent(new Event("error"));
    });
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });
});
