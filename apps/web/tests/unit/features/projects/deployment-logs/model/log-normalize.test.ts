import {
  normalizeLogLine,
  normalizeLogsResponse,
  normalizeStreamEvent,
} from "../../../../../../src/features/projects/deployment-logs/model/log-normalize";

describe("log payload readers", () => {
  it("reads a v1 line as it is", () => {
    const raw = {
      id: "log_1",
      timestamp: "2026-09-24T10:00:00.000Z",
      message: "==> Deploying",
      level: "warn",
      type: "build",
      instance: null,
      labels: { level: "warning", type: "build", ignored: 3 },
    };
    expect(normalizeLogLine(raw)).toEqual({
      id: "log_1",
      timestamp: "2026-09-24T10:00:00.000Z",
      message: "==> Deploying",
      level: "warn",
      type: "build",
      instance: null,
      labels: { level: "warning", type: "build" },
    });
  });

  it("gives an older backend's id-less line a stable id and a known level", () => {
    const line = normalizeLogLine({
      timestamp: "2026-09-24T10:00:00.000Z",
      message: "Server started",
      level: "system",
    });
    expect(line.id).toBe("2026-09-24T10:00:00.000Z#Server started");
    expect(line.level).toBe("info");
    expect(line.type).toBeNull();
  });

  it("fills an older backend's page with empty paging and its one filter", () => {
    const response = normalizeLogsResponse({ logs: [], source: "simulated", reason: "mock" });
    expect(response).toEqual({
      source: "simulated",
      reason: "mock",
      logs: [],
      hasMore: false,
      next: null,
      filters: ["type"],
    });
  });

  it("keeps the paging cursor and the provider's filters", () => {
    const response = normalizeLogsResponse({
      source: "live",
      logs: [],
      hasMore: true,
      next: { startTime: "a", endTime: "b" },
      filters: ["level", "text"],
    });
    expect(response.next).toEqual({ startTime: "a", endTime: "b" });
    expect(response.filters).toEqual(["level", "text"]);
    expect(normalizeLogsResponse({ next: { startTime: 1 } }).next).toBeNull();
  });

  it("reads each stream frame kind, and a kind-less frame as a snapshot", () => {
    expect(normalizeStreamEvent({ kind: "append", source: "live", logs: [] })).toEqual({
      kind: "append",
      source: "live",
      logs: [],
    });
    expect(
      normalizeStreamEvent({ kind: "status", source: "unavailable", reason: "429" }),
    ).toEqual({ kind: "status", source: "unavailable", reason: "429" });
    expect(normalizeStreamEvent({ logs: [], source: "live" }).kind).toBe("snapshot");
  });

  it("treats an unknown source as unavailable, never as live", () => {
    expect(normalizeLogsResponse({ source: "weird" }).source).toBe("unavailable");
  });
});
