import {
  deploymentLogsQueryString,
  getDeploymentTargetLogs,
  getDeploymentTargetLogsStreamUrl,
  openDeploymentLogStream,
} from "../../../../../../src/features/projects/deployment-logs/data/deployment-logs-api";
import { request } from "../../../../../../src/shared/api/request";
import { FakeEventSource } from "../log-fixtures";

jest.mock("../../../../../../src/shared/api/request", () => ({
  getApiBaseUrl: jest.fn(() => "http://api.test/api/v1"),
  request: jest.fn(),
}));

const mockRequest = request as jest.MockedFunction<typeof request>;

describe("deployment logs data", () => {
  beforeEach(() => {
    FakeEventSource.install();
    mockRequest.mockReset();
  });

  it("encodes the contract's query, lists comma-separated", () => {
    expect(
      deploymentLogsQueryString({
        mode: "append",
        startTime: "2026-09-24T10:00:00.000Z",
        endTime: null,
        direction: "backward",
        limit: 100,
        type: ["build", "app"],
        level: ["error"],
        text: "timeout",
        instance: [],
      }),
    ).toBe(
      "?mode=append&startTime=2026-09-24T10%3A00%3A00.000Z&direction=backward&limit=100&type=build%2Capp&level=error&text=timeout",
    );
    expect(deploymentLogsQueryString()).toBe("");
  });

  it("fetches a page and reads it through the tolerant reader", async () => {
    mockRequest.mockResolvedValue({ logs: [{ timestamp: "t", message: "m", level: "error" }], source: "live" });

    const response = await getDeploymentTargetLogs("p 1", "t/1", { endTime: "2026-09-24T11:00:00.000Z" });

    expect(mockRequest).toHaveBeenCalledWith(
      "/projects/p%201/deployment-targets/t%2F1/logs?endTime=2026-09-24T11%3A00%3A00.000Z",
    );
    expect(response.logs[0]).toMatchObject({ id: "t#m", level: "error" });
    expect(response.filters).toEqual(["type"]);
  });

  it("builds the stream URL on the API origin", () => {
    expect(getDeploymentTargetLogsStreamUrl("p", "t", { mode: "append" })).toBe(
      "http://api.test/api/v1/projects/p/deployment-targets/t/logs/stream?mode=append",
    );
  });

  it("opens the append stream with credentials and hands frames through", () => {
    const onEvent = jest.fn();
    const onError = jest.fn();
    const stream = openDeploymentLogStream("p", "t", { startTime: "s" }, { onEvent, onError });
    const source = FakeEventSource.latest();

    expect(source.withCredentials).toBe(true);
    expect(source.params.get("mode")).toBe("append");
    expect(source.params.get("startTime")).toBe("s");

    source.emit({ kind: "append", source: "live", logs: [] });
    expect(onEvent).toHaveBeenCalledWith({ kind: "append", source: "live", logs: [] });

    source.emitRaw("{not json");
    source.emitRaw("7");
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith("malformed");

    // A transient drop reconnects on its own and is not reported.
    source.fail(FakeEventSource.CONNECTING);
    expect(onError).toHaveBeenCalledTimes(2);
    source.fail(FakeEventSource.CLOSED);
    expect(onError).toHaveBeenLastCalledWith("closed");

    stream.close();
    expect(source.readyState).toBe(FakeEventSource.CLOSED);
  });
});
