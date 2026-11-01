import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ciRunReportRepository } from "../../../../../src/features/checklists/data/ci-run-report-repository";
import { normalizeCiRunReport } from "../../../../../src/features/checklists/model/ci-run-report-rules";
import { useCiRunReportViewModel } from "../../../../../src/features/checklists/report/view-models/use-ci-run-report-view-model";
import { useCiRunReportExportViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-export-view-model";
import { downloadBlob } from "../../../../../src/shared/browser/download-blob";
import { apiError } from "../checklist-fixtures";
import { CI_REF, ciRunReportWire } from "../ci-run-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/ci-run-report-repository", () => ({
  ciRunReportRepository: { report: jest.fn(), reportBody: jest.fn(), reportMarkdown: jest.fn() },
}));
jest.mock("../../../../../src/shared/browser/download-blob", () => ({ downloadBlob: jest.fn() }));

const repo = ciRunReportRepository as jest.Mocked<typeof ciRunReportRepository>;
const download = downloadBlob as jest.MockedFunction<typeof downloadBlob>;
const REPORT = normalizeCiRunReport(ciRunReportWire())!;

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

/** A Blob's text, through FileReader (jsdom has no Blob.text). */
function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("useCiRunReportExportViewModel", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockReset().mockResolvedValue(undefined);
  });

  it("points Download PDF at the CI report page for this execution, with print=1", () => {
    const vm = renderHook(() => useCiRunReportExportViewModel(CI_REF));
    expect(vm().pdfHref).toBe(`/runs/report?repoFullName=acme%2Forders-api&branch=uat&commitSha=${CI_REF.commitSha}&print=1`);
    expect(vm().status).toBe("idle");
  });

  it("copies the Markdown for exactly this repository, branch and commit", async () => {
    repo.reportMarkdown.mockResolvedValue("# CI results");
    const vm = renderHook(() => useCiRunReportExportViewModel(CI_REF));
    await act(async () => {
      await vm().copyMarkdown();
    });
    expect(repo.reportMarkdown).toHaveBeenCalledWith(CI_REF);
    expect(writeText).toHaveBeenCalledWith("# CI results");
    expect(vm().status).toBe("copied");
  });

  it("saves the server's body untouched under the CI results file name", async () => {
    const body = ciRunReportWire({ extra: "kept" });
    repo.reportBody.mockResolvedValue(body);
    const vm = renderHook(() => useCiRunReportExportViewModel(CI_REF));
    await act(async () => {
      await vm().downloadJson();
    });
    expect(repo.reportBody).toHaveBeenCalledWith(CI_REF);
    expect(download.mock.calls[0]?.[0]).toBe("CI-Results-orders-api-uat-a1b2c3d.json");
    expect(download.mock.calls[0]?.[1].type).toBe("application/json");
    expect(JSON.parse(await textOf(download.mock.calls[0]![1]))).toEqual(body);
    expect(vm().status).toBe("idle");
  });

  it("says the download failed, and downloads nothing, when the report is gone", async () => {
    repo.reportBody.mockRejectedValue(apiError(404));
    const vm = renderHook(() => useCiRunReportExportViewModel(CI_REF));
    await act(async () => {
      await vm().downloadJson();
    });
    expect(download).not.toHaveBeenCalled();
    expect(vm().status).toBe("failed");
    expect(vm().message).toMatch(/not available any more/);
  });
});

describe("useCiRunReportViewModel", () => {
  let print: jest.SpyInstance;

  beforeEach(() => {
    print = jest.spyOn(window, "print").mockImplementation(() => undefined);
  });

  afterEach(() => print.mockRestore());

  it("loads the report once and becomes ready", async () => {
    repo.report.mockResolvedValue(REPORT);
    const vm = renderHook(() => useCiRunReportViewModel({ run: CI_REF, autoPrint: false }));
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().report?.repoFullName).toBe("acme/orders-api");
    expect(repo.report).toHaveBeenCalledTimes(1);
    expect(repo.report).toHaveBeenCalledWith(CI_REF);
    expect(print).not.toHaveBeenCalled();
  });

  it("names the browser tab after the report, so Save as PDF uses it", async () => {
    repo.report.mockResolvedValue(REPORT);
    renderHook(() => useCiRunReportViewModel({ run: CI_REF, autoPrint: false }));
    await flush();
    expect(document.title).toBe("CI-Results-orders-api-uat-a1b2c3d");
  });

  it("opens the print dialog once when asked to", async () => {
    repo.report.mockResolvedValue(REPORT);
    renderHook(() => useCiRunReportViewModel({ run: CI_REF, autoPrint: true }));
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("does not print an error", async () => {
    repo.report.mockRejectedValue(apiError(500));
    renderHook(() => useCiRunReportViewModel({ run: CI_REF, autoPrint: true }));
    await flush();
    expect(print).not.toHaveBeenCalled();
  });

  it("says so, without fetching, when the link names no execution", async () => {
    const vm = renderHook(() => useCiRunReportViewModel({ run: null, autoPrint: true }));
    await flush();
    expect(repo.report).not.toHaveBeenCalled();
    expect(vm().status).toBe("error");
    expect(vm().error?.text).toMatch(/missing the repository, branch or commit/);
    expect(print).not.toHaveBeenCalled();
  });

  it("explains a missing report and loads again on reload", async () => {
    repo.report.mockRejectedValueOnce(apiError(404)).mockResolvedValueOnce(REPORT);
    const vm = renderHook(() => useCiRunReportViewModel({ run: CI_REF, autoPrint: false }));
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error?.title).toBe("This report is not available");
    act(() => vm().reload());
    await flush();
    expect(vm().status).toBe("ready");
    expect(repo.report).toHaveBeenCalledTimes(2);
  });
});
