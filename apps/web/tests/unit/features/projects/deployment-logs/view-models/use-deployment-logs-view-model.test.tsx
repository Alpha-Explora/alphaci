import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { getDeploymentTargetLogs } from "../../../../../../src/features/projects/deployment-logs/data/deployment-logs-api";
import type {
  LogQueryFilters,
  LogWindow,
} from "../../../../../../src/features/projects/deployment-logs/model/deployment-logs-types";
import {
  LOG_SEARCH_DEBOUNCE_MS,
  useDeploymentLogsViewModel,
  type DeploymentLogsViewModel,
} from "../../../../../../src/features/projects/deployment-logs/view-models/use-deployment-logs-view-model";
import { FakeEventSource, line, page } from "../log-fixtures";

jest.mock(
  "../../../../../../src/features/projects/deployment-logs/data/deployment-logs-api",
  () => ({
    ...jest.requireActual(
      "../../../../../../src/features/projects/deployment-logs/data/deployment-logs-api",
    ),
    getDeploymentTargetLogs: jest.fn(),
  }),
);

const mockFetch = getDeploymentTargetLogs as jest.MockedFunction<
  typeof getDeploymentTargetLogs
>;

const LIVE: LogWindow = { startTime: "2026-09-24T09:59:00.000Z", endTime: null };
const CLOSED: LogWindow = {
  startTime: "2026-09-24T09:00:00.000Z",
  endTime: "2026-09-24T09:30:00.000Z",
};

let vm: DeploymentLogsViewModel | null = null;

function Probe(props: Readonly<{ window: LogWindow | null; filters?: LogQueryFilters }>) {
  const model = useDeploymentLogsViewModel({
    projectId: "proj-1",
    targetId: "target-1",
    window: props.window,
    filters: props.filters,
  });
  useLayoutEffect(() => {
    vm = model;
  }, [model]);
  return null;
}

function current(): DeploymentLogsViewModel {
  if (!vm) throw new Error("the ViewModel has not rendered");
  return vm;
}

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useDeploymentLogsViewModel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });

  beforeEach(() => {
    FakeEventSource.install();
    mockFetch.mockReset();
    visibility = "visible";
    vm = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  function render(window: LogWindow | null, filters?: LogQueryFilters) {
    act(() => {
      root.render(<Probe filters={filters} window={window} />);
    });
  }

  it("tails a live window: snapshot, then only the new lines", () => {
    render(LIVE);
    const stream = FakeEventSource.latest();

    expect(current().status).toBe("loading");
    expect(current().tail).toBe("connecting");
    expect(stream.params.get("mode")).toBe("append");
    expect(stream.params.get("startTime")).toBe(LIVE.startTime);
    expect(stream.params.get("limit")).toBe("100");

    act(() => stream.emit({ kind: "snapshot", ...page([line("a", 1), line("b", 2, { level: "error" })]) }));
    expect(current().status).toBe("ready");
    expect(current().tail).toBe("live");
    expect(current().source).toBe("live");
    expect(current().lines.map((l) => l.id)).toEqual(["a", "b"]);
    expect(current().errorCount).toBe(1);

    act(() => stream.emit({ kind: "append", source: "live", logs: [line("b", 2), line("c", 3)] }));
    expect(current().lines.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps real lines and shows the reason when the provider stops answering", () => {
    render(LIVE);
    const stream = FakeEventSource.latest();
    act(() => stream.emit({ kind: "snapshot", ...page([line("a", 1)]) }));
    act(() => stream.emit({ kind: "status", source: "unavailable", reason: "Render returned 503" }));

    expect(current().source).toBe("unavailable");
    expect(current().reason).toBe("Render returned 503");
    expect(current().lines).toHaveLength(1);

    act(() => stream.emit({ kind: "append", source: "live", logs: [line("b", 2)] }));
    expect(current().source).toBe("live");
    expect(current().reason).toBeNull();
  });

  it("closes the stream while hidden and resumes from the newest line held", () => {
    render(LIVE);
    const first = FakeEventSource.latest();
    act(() => first.emit({ kind: "snapshot", ...page([line("a", 1), line("b", 2)]) }));

    setVisibility("hidden");
    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(FakeEventSource.open()).toHaveLength(0);
    expect(current().tail).toBe("paused");
    expect(current().lines).toHaveLength(2);

    setVisibility("visible");
    const resumed = FakeEventSource.latest();
    expect(resumed).not.toBe(first);
    expect(resumed.params.get("startTime")).toBe(line("b", 2).timestamp);

    // The overlap at the boundary is deduped.
    act(() => resumed.emit({ kind: "snapshot", ...page([line("b", 2), line("c", 3)]) }));
    expect(current().lines.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(current().tail).toBe("live");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pages in the gap a long pause left", async () => {
    render(LIVE);
    const first = FakeEventSource.latest();
    act(() => first.emit({ kind: "snapshot", ...page([line("a", 1)]) }));
    setVisibility("hidden");
    setVisibility("visible");

    mockFetch.mockResolvedValueOnce(page([line("a", 1), line("b", 5)], { hasMore: true, next: { startTime: "s", endTime: "e" } }));
    act(() =>
      FakeEventSource.latest().emit({
        kind: "snapshot",
        ...page([line("y", 30), line("z", 31)], {
          hasMore: true,
          next: { startTime: line("a", 1).timestamp, endTime: line("y", 30).timestamp },
        }),
      }),
    );
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[2]).toMatchObject({
      direction: "backward",
      startTime: line("a", 1).timestamp,
      endTime: line("y", 30).timestamp,
    });
    expect(current().lines.map((l) => l.id)).toEqual(["a", "b", "y", "z"]);
  });

  it("reopens the stream with level=error for errors only", () => {
    render(LIVE);
    const first = FakeEventSource.latest();
    act(() => first.emit({ kind: "snapshot", ...page([line("a", 1)]) }));

    act(() => current().toggleErrorsOnly());
    const filtered = FakeEventSource.latest();

    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(filtered.params.get("level")).toBe("error");
    // A new query: its first page replaces the old lines.
    expect(current().status).toBe("loading");
    expect(current().lines).toHaveLength(0);
    act(() => filtered.emit({ kind: "snapshot", ...page([line("e", 4, { level: "error" })]) }));
    expect(current().lines.map((l) => l.id)).toEqual(["e"]);
    expect(current().errorsOnly).toBe(true);
  });

  it("debounces the server-side search into the stream query", () => {
    jest.useFakeTimers();
    render(LIVE, { type: "build" });
    const first = FakeEventSource.latest();
    expect(first.params.get("type")).toBe("build");

    act(() => current().setSearch(" timeout "));
    expect(FakeEventSource.latest()).toBe(first);
    act(() => {
      jest.advanceTimersByTime(LOG_SEARCH_DEBOUNCE_MS);
    });
    expect(FakeEventSource.latest().params.get("text")).toBe("timeout");
  });

  it("loads older lines backward through the provider's cursor", async () => {
    render(LIVE);
    const stream = FakeEventSource.latest();
    const next = { startTime: LIVE.startTime, endTime: line("c", 3).timestamp };
    act(() => stream.emit({ kind: "snapshot", ...page([line("c", 3), line("d", 4)], { hasMore: true, next }) }));
    expect(current().older).toBe("available");

    mockFetch.mockResolvedValueOnce(page([line("a", 1), line("b", 2)]));
    act(() => current().loadOlder());
    expect(current().older).toBe("loading");
    await flush();

    expect(mockFetch).toHaveBeenCalledWith("proj-1", "target-1", expect.objectContaining({ ...next, direction: "backward" }));
    expect(current().lines.map((l) => l.id)).toEqual(["a", "b", "c", "d"]);
    expect(current().older).toBe("none");
  });

  it("says so when an older page fails, and keeps the lines", async () => {
    render(LIVE);
    act(() =>
      FakeEventSource.latest().emit({
        kind: "snapshot",
        ...page([line("c", 3)], { hasMore: true, next: { startTime: "s", endTime: "e" } }),
      }),
    );
    mockFetch.mockRejectedValueOnce(new Error("boom"));
    act(() => current().loadOlder());
    await flush();

    expect(current().error).toBe("Could not load older logs. Please retry.");
    expect(current().status).toBe("ready");
    expect(current().lines).toHaveLength(1);
  });

  it("fetches a closed window once, without a stream", async () => {
    mockFetch.mockResolvedValueOnce(page([line("a", 1)], { source: "simulated", reason: "Live providers are off" }));
    render(CLOSED);
    await flush();

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "proj-1",
      "target-1",
      expect.objectContaining({ startTime: CLOSED.startTime, endTime: CLOSED.endTime, direction: "backward" }),
    );
    expect(current().tail).toBe("closed");
    expect(current().source).toBe("simulated");
    expect(current().reason).toBe("Live providers are off");
  });

  it("reports a closed window that could not load", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    render(CLOSED);
    await flush();
    expect(current().status).toBe("error");
    expect(current().error).toBe("Could not load logs. Please retry.");
  });

  it("stops and says so when the browser closes the stream", () => {
    render(LIVE);
    act(() => FakeEventSource.latest().fail(FakeEventSource.CLOSED));
    expect(current().status).toBe("error");

    act(() => current().restart());
    expect(FakeEventSource.open()).toHaveLength(1);
    expect(current().status).toBe("loading");
  });

  it("does nothing without a window", () => {
    render(null);
    expect(current().status).toBe("idle");
    expect(current().tail).toBe("off");
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("falls back to an older backend's one filter until the provider says", () => {
    render(LIVE);
    expect(current().supportedFilters).toEqual(["type"]);
    act(() => FakeEventSource.latest().emit({ kind: "snapshot", ...page([], { filters: ["level"] }) }));
    expect(current().supportedFilters).toEqual(["level"]);
  });
});
