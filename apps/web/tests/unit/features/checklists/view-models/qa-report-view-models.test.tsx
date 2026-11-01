import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { useQaReportViewModel } from "../../../../../src/features/checklists/report/view-models/use-qa-report-view-model";
import {
  COPIED_RESET_MS,
  useQaExportViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-qa-export-view-model";
import { downloadBlob } from "../../../../../src/shared/browser/download-blob";
import { apiError } from "../checklist-fixtures";
import { frozenReport } from "../qa-report-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: { report: jest.fn(), reportMarkdown: jest.fn() },
}));
jest.mock("../../../../../src/shared/browser/download-blob", () => ({ downloadBlob: jest.fn() }));

const repo = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const download = downloadBlob as jest.MockedFunction<typeof downloadBlob>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
  jest.useRealTimers();
});

function renderHook<T>(useHook: () => T): () => T {
  let latest: T | undefined;
  const record = (value: T) => {
    latest = value;
  };
  function Probe({ onRender }: { onRender: (value: T) => void }) {
    onRender(useHook());
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Probe onRender={record} />));
  return () => latest as T;
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("useQaReportViewModel", () => {
  let print: jest.SpyInstance;

  beforeEach(() => {
    print = jest.spyOn(window, "print").mockImplementation(() => undefined);
    window.history.replaceState(null, "", "/projects/project-1/qa/report/run-1?print=1");
  });

  afterEach(() => print.mockRestore());

  it("loads, then is ready with the report and names the tab for Save as PDF", async () => {
    repo.report.mockResolvedValue(frozenReport());
    const vm = renderHook(() => useQaReportViewModel({ projectId: "project-1", runId: "run-1", autoPrint: false }));
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().report?.project.repoFullName).toBe("tone/orders-api");
    expect(repo.report).toHaveBeenCalledWith("project-1", "run-1");
    expect(document.title).toBe("QA-Report-orders-api-feat-checkout-a1b2c3d");
    expect(print).not.toHaveBeenCalled();
  });

  it("turns a 404 into 'This report is not available', and reload retries", async () => {
    repo.report.mockRejectedValueOnce(apiError(404));
    const vm = renderHook(() => useQaReportViewModel({ projectId: "p", runId: "gone", autoPrint: true }));
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error?.title).toBe("This report is not available");
    expect(print).not.toHaveBeenCalled();

    repo.report.mockResolvedValueOnce(frozenReport());
    act(() => vm().reload());
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
  });

  it("with autoPrint, prints exactly once after the report is ready and drops ?print=1", async () => {
    let resolve: (value: ReturnType<typeof frozenReport>) => void = () => undefined;
    repo.report.mockReturnValue(new Promise((done) => (resolve = done)));
    const vm = renderHook(() => useQaReportViewModel({ projectId: "project-1", runId: "run-1", autoPrint: true }));
    await flush();
    expect(print).not.toHaveBeenCalled();

    await act(async () => resolve(frozenReport()));
    await flush();
    expect(vm().status).toBe("ready");
    expect(print).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");

    // Re-renders do not print again.
    act(() => vm().print());
    expect(print).toHaveBeenCalledTimes(2);
    await flush();
    expect(print).toHaveBeenCalledTimes(2);
  });

  it("ignores a slow earlier response once a reload has been asked for", async () => {
    let first: (value: ReturnType<typeof frozenReport>) => void = () => undefined;
    repo.report.mockReturnValueOnce(new Promise((done) => (first = done)));
    repo.report.mockResolvedValueOnce(frozenReport({ generatedAt: "2026-09-25T09:00:00.000Z" }));
    const vm = renderHook(() => useQaReportViewModel({ projectId: "p", runId: "r", autoPrint: false }));
    act(() => vm().reload());
    await flush();
    await act(async () => first(frozenReport({ generatedAt: "2020-01-01T00:00:00.000Z" })));
    await flush();
    expect(vm().report?.generatedAt).toBe("2026-09-25T09:00:00.000Z");
  });
});

describe("useQaExportViewModel", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockReset().mockResolvedValue(undefined);
  });

  it("points Download PDF at the print page with ?print=1", () => {
    const vm = renderHook(() => useQaExportViewModel({ projectId: "project-1", runId: "run-1" }));
    expect(vm().pdfHref).toBe("/projects/project-1/qa/report/run-1?print=1");
    expect(vm().status).toBe("idle");
  });

  it("copies the Markdown, shows Copied, then settles back", async () => {
    jest.useFakeTimers();
    repo.reportMarkdown.mockResolvedValue("# QA Report");
    const vm = renderHook(() => useQaExportViewModel({ projectId: "p1", runId: "r1" }));
    await act(async () => {
      await vm().copyMarkdown();
    });
    expect(repo.reportMarkdown).toHaveBeenCalledWith("p1", "r1");
    expect(writeText).toHaveBeenCalledWith("# QA Report");
    expect(vm().status).toBe("copied");
    expect(vm().message).toBe("PR Markdown copied to the clipboard.");
    act(() => jest.advanceTimersByTime(COPIED_RESET_MS));
    expect(vm().status).toBe("idle");
    expect(vm().message).toBeNull();
  });

  it("says the fetch failed when the Markdown cannot be read, without touching the clipboard", async () => {
    repo.reportMarkdown.mockRejectedValue(apiError(500));
    const vm = renderHook(() => useQaExportViewModel({ projectId: "p1", runId: "r1" }));
    await act(async () => {
      await vm().copyMarkdown();
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(vm().status).toBe("failed");
    expect(vm().message).toMatch(/could not be fetched/);
  });

  it("says the browser blocked the clipboard when writeText rejects, and dismiss clears it", async () => {
    repo.reportMarkdown.mockResolvedValue("# QA Report");
    writeText.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const vm = renderHook(() => useQaExportViewModel({ projectId: "p1", runId: "r1" }));
    await act(async () => {
      await vm().copyMarkdown();
    });
    expect(vm().status).toBe("failed");
    expect(vm().message).toMatch(/blocked clipboard access/);
    act(() => vm().dismiss());
    expect(vm().status).toBe("idle");
  });

  it("treats a missing Clipboard API as blocked", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    repo.reportMarkdown.mockResolvedValue("# QA Report");
    const vm = renderHook(() => useQaExportViewModel({ projectId: "p1", runId: "r1" }));
    await act(async () => {
      await vm().copyMarkdown();
    });
    expect(vm().message).toMatch(/blocked clipboard access/);
  });

  it("downloads the JSON under the report's own file name", async () => {
    repo.report.mockResolvedValue(frozenReport());
    const vm = renderHook(() => useQaExportViewModel({ projectId: "project-1", runId: "run-1" }));
    await act(async () => {
      await vm().downloadJson();
    });
    expect(repo.report).toHaveBeenCalledWith("project-1", "run-1");
    expect(download).toHaveBeenCalledTimes(1);
    const [filename, blob] = download.mock.calls[0];
    expect(filename).toBe("QA-Report-orders-api-feat-checkout-a1b2c3d.json");
    expect(blob.type).toBe("application/json");
    // jsdom's Blob has no .text(); FileReader reads it the old way.
    const body = await new Promise<string>((done) => {
      const reader = new FileReader();
      reader.onload = () => done(String(reader.result));
      reader.readAsText(blob);
    });
    expect(body.endsWith("\n")).toBe(true);
    const saved = JSON.parse(body);
    expect(saved.schemaVersion).toBe("qa-report/v1");
    expect(vm().status).toBe("idle");
  });

  it("reports a failed download and ignores a second click while one is running", async () => {
    let reject: (cause: unknown) => void = () => undefined;
    repo.report.mockReturnValue(new Promise((_, fail) => (reject = fail)));
    const vm = renderHook(() => useQaExportViewModel({ projectId: "p1", runId: "r1" }));
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = vm().downloadJson();
      void vm().downloadJson();
    });
    expect(repo.report).toHaveBeenCalledTimes(1);
    expect(vm().status).toBe("downloading");
    await act(async () => {
      reject(apiError(500));
      await first;
    });
    expect(vm().status).toBe("failed");
    expect(vm().message).toMatch(/could not be downloaded/);
    expect(download).not.toHaveBeenCalled();
  });
});
