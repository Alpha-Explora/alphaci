import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { normalizeProjectReport } from "../../../../../src/features/checklists/model/project-report-rules";
import { useProjectReportViewModel } from "../../../../../src/features/checklists/report/view-models/use-project-report-view-model";
import { useProjectQaExportViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-export-view-model";
import { downloadBlob } from "../../../../../src/shared/browser/download-blob";
import { apiError } from "../checklist-fixtures";
import { projectReportWire } from "../project-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { report: jest.fn(), reportMarkdown: jest.fn() },
}));
jest.mock("../../../../../src/shared/browser/download-blob", () => ({ downloadBlob: jest.fn() }));

const repo = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const download = downloadBlob as jest.MockedFunction<typeof downloadBlob>;
const REPORT = normalizeProjectReport(projectReportWire())!;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

function renderHook<T>(useHook: () => T): () => T {
  let latest: T | undefined;
  function Probe({ onRender }: { onRender: (value: T) => void }) {
    onRender(useHook());
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Probe onRender={(value) => (latest = value)} />));
  return () => latest as T;
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("useProjectQaExportViewModel", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockReset().mockResolvedValue(undefined);
  });

  it("points Download PDF at the Project print page with ?print=1", () => {
    const vm = renderHook(() => useProjectQaExportViewModel({ deliveryProjectId: "dp-1", runId: "run-1" }));
    expect(vm().pdfHref).toBe("/qa/project-report/dp-1/run-1?print=1");
    expect(vm().status).toBe("idle");
  });

  it("copies the Project report's Markdown from the delivery-project route", async () => {
    repo.reportMarkdown.mockResolvedValue("# QA Report");
    const vm = renderHook(() => useProjectQaExportViewModel({ deliveryProjectId: "dp-1", runId: "run-1" }));
    await act(async () => {
      await vm().copyMarkdown();
    });
    expect(repo.reportMarkdown).toHaveBeenCalledWith("dp-1", "run-1");
    expect(writeText).toHaveBeenCalledWith("# QA Report");
    expect(vm().status).toBe("copied");
  });

  it("saves the JSON under the Project report's file name", async () => {
    repo.report.mockResolvedValue(REPORT);
    const vm = renderHook(() => useProjectQaExportViewModel({ deliveryProjectId: "dp-1", runId: "run-1" }));
    await act(async () => {
      await vm().downloadJson();
    });
    expect(repo.report).toHaveBeenCalledWith("dp-1", "run-1");
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0]?.[0]).toBe("QA-Report-storefront-prun-1.json");
    const blob = download.mock.calls[0]?.[1];
    expect(blob?.type).toBe("application/json");
    expect(blob?.size).toBeGreaterThan(JSON.stringify(REPORT).length);
    expect(vm().status).toBe("idle");
  });

  it("says the download failed when the report cannot be read", async () => {
    repo.report.mockRejectedValue(apiError(404));
    const vm = renderHook(() => useProjectQaExportViewModel({ deliveryProjectId: "dp-1", runId: "run-1" }));
    await act(async () => {
      await vm().downloadJson();
    });
    expect(download).not.toHaveBeenCalled();
    expect(vm().status).toBe("failed");
    expect(vm().message).toMatch(/not available any more/);
  });
});

describe("useProjectReportViewModel", () => {
  let print: jest.SpyInstance;

  beforeEach(() => {
    print = jest.spyOn(window, "print").mockImplementation(() => undefined);
  });

  afterEach(() => print.mockRestore());

  it("loads the report once and becomes ready", async () => {
    repo.report.mockResolvedValue(REPORT);
    const vm = renderHook(() => useProjectReportViewModel({ deliveryProjectId: "dp-1", runId: "run-1", autoPrint: false }));
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().report?.project.name).toBe("storefront");
    expect(repo.report).toHaveBeenCalledTimes(1);
    expect(repo.report).toHaveBeenCalledWith("dp-1", "run-1");
    expect(print).not.toHaveBeenCalled();
  });

  it("names the browser tab after the report, so Save as PDF uses it", async () => {
    repo.report.mockResolvedValue(REPORT);
    renderHook(() => useProjectReportViewModel({ deliveryProjectId: "dp-1", runId: "run-1", autoPrint: false }));
    await flush();
    expect(document.title).toBe("QA-Report-storefront-prun-1");
  });

  it("opens the print dialog once when asked to", async () => {
    repo.report.mockResolvedValue(REPORT);
    renderHook(() => useProjectReportViewModel({ deliveryProjectId: "dp-1", runId: "run-1", autoPrint: true }));
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("explains a missing report and loads again on reload", async () => {
    repo.report.mockRejectedValueOnce(apiError(404)).mockResolvedValueOnce(REPORT);
    const vm = renderHook(() => useProjectReportViewModel({ deliveryProjectId: "dp-1", runId: "run-1", autoPrint: false }));
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error?.title).toBe("This report is not available");
    act(() => vm().reload());
    await flush();
    expect(vm().status).toBe("ready");
    expect(repo.report).toHaveBeenCalledTimes(2);
  });

  it("does not print an error", async () => {
    repo.report.mockRejectedValue(apiError(500));
    renderHook(() => useProjectReportViewModel({ deliveryProjectId: "dp-1", runId: "run-1", autoPrint: true }));
    await flush();
    expect(print).not.toHaveBeenCalled();
  });
});
