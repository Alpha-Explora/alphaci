import type {
  DeploymentLogLine,
  DeploymentLogsResponse,
} from "../../../../../src/features/projects/deployment-logs/model/deployment-logs-types";

/**
 * A stand-in for the browser's EventSource. jsdom has none, so tests install
 * this on globalThis and drive the stream by hand.
 */
export class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readonly withCredentials: boolean;
  readyState = FakeEventSource.OPEN;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  emitRaw(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  fail(state: number) {
    this.readyState = state;
    this.onerror?.();
  }

  get params(): URLSearchParams {
    return new URL(this.url).searchParams;
  }

  static open(): FakeEventSource[] {
    return FakeEventSource.instances.filter(
      (source) => source.readyState !== FakeEventSource.CLOSED,
    );
  }

  static latest(): FakeEventSource {
    const source = FakeEventSource.instances[FakeEventSource.instances.length - 1];
    if (!source) throw new Error("no EventSource was opened");
    return source;
  }

  static install() {
    FakeEventSource.instances = [];
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  }
}

/** A line at `2026-09-24T10:00:<second>Z`. */
export function line(
  id: string,
  second: number,
  overrides: Partial<DeploymentLogLine> = {},
): DeploymentLogLine {
  return {
    id,
    timestamp: `2026-09-24T10:00:${String(second).padStart(2, "0")}.000Z`,
    message: `message ${id}`,
    level: "info",
    type: "app",
    instance: "srv-d1abc-5d8f9c7b6-x2k4j",
    labels: {},
    ...overrides,
  };
}

export function page(
  logs: DeploymentLogLine[],
  overrides: Partial<DeploymentLogsResponse> = {},
): DeploymentLogsResponse {
  return {
    source: "live",
    logs,
    hasMore: false,
    next: null,
    filters: ["level", "type", "text", "instance"],
    ...overrides,
  };
}
