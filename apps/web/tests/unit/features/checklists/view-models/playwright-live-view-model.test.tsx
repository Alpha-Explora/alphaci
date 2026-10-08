import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { playwrightLiveRepository } from "../../../../../src/features/checklists/data/playwright-live-repository";
import { normalizePlaywrightLive } from "../../../../../src/features/checklists/model/playwright-live-rules";
import type { PlaywrightLiveRun } from "../../../../../src/features/checklists/model/playwright-live-types";
import {
  usePlaywrightLiveViewModel,
  type LiveRepository,
  type PlaywrightLiveViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-playwright-live-view-model";
import { ApiError } from "../../../../../src/shared/api/request";
import { liveRun } from "../playwright-live-fixtures";

jest.mock("../../../../../src/features/checklists/data/playwright-live-repository", () => ({
  playwrightLiveRepository: { getPlaywrightLive: jest.fn() },
}));

const live = playwrightLiveRepository as jest.Mocked<typeof playwrightLiveRepository>;
const NOW = Date.parse("2026-10-08T02:00:40.000Z");
const WEB: LiveRepository = { projectId: "proj-fe", name: "storefront-web" };

function run(overrides: Record<string, unknown> = {}): PlaywrightLiveRun {
  return normalizePlaywrightLive({ run: liveRun(overrides) })!;
}

const RUNNING = run();
const QUEUED = run({ runId: 124, status: "queued", done: 0, passed: 0, failed: 0, tests: [], running: [], total: null });
const PASSED = run({ status: "passed", done: 12, passed: 12, failed: 0, finishedAt: "2026-10-08T02:01:01.000Z" });

let root: Root | null = null;
let visibility: DocumentVisibilityState = "visible";

beforeAll(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  visibility = "visible";
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
  jest.useRealTimers();
});

interface Props {
  repositories?: LiveRepository[];
  enabled?: boolean;
  startedAt?: number | null;
}

function renderVm(initial: Props = {}) {
  let latest: PlaywrightLiveViewModel | undefined;
  const record = (value: PlaywrightLiveViewModel) => {
    latest = value;
  };
  const onFinished = jest.fn();
  function Probe(props: Required<Props> & { onRender: (value: PlaywrightLiveViewModel) => void }) {
    props.onRender(
      usePlaywrightLiveViewModel({
        repositories: props.repositories,
        branch: "uat",
        enabled: props.enabled,
        startedAt: props.startedAt,
        onFinished,
      }),
    );
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  let current: Required<Props> = { repositories: [WEB], enabled: true, startedAt: null, ...initial };
  const draw = () => root!.render(<Probe {...current} onRender={record} />);
  act(draw);
  return {
    vm: () => latest as PlaywrightLiveViewModel,
    onFinished,
    rerender: async (next: Props) => {
      current = { ...current, ...next };
      act(draw);
      await flush();
    },
  };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function reads(): number {
  return live.getPlaywrightLive.mock.calls.length;
}

describe("usePlaywrightLiveViewModel — reading", () => {
  it("reads nothing while the Playwright tab is not showing", async () => {
    live.getPlaywrightLive.mockResolvedValue(RUNNING);
    renderVm({ enabled: false });
    await advance(10_000);
    expect(reads()).toBe(0);
  });

  it("reads once on open; a finished run is history: no refresh, no polling", async () => {
    live.getPlaywrightLive.mockResolvedValue(PASSED);
    const { vm, onFinished } = renderVm();
    await flush();
    expect(live.getPlaywrightLive).toHaveBeenCalledWith("proj-fe", "uat");
    expect(vm().runs).toEqual({ "proj-fe": PASSED });
    expect(vm().supported).toBe(true);
    await advance(30_000);
    expect(reads()).toBe(1);
    expect(onFinished).not.toHaveBeenCalled();
    expect(vm().announcement).toBe("");
  });

  it("reads one route per frontend repository", async () => {
    live.getPlaywrightLive.mockResolvedValue(null);
    renderVm({ repositories: [WEB, { projectId: "proj-admin", name: "admin-web" }] });
    await flush();
    expect(live.getPlaywrightLive.mock.calls.map(([id]) => id)).toEqual(["proj-fe", "proj-admin"]);
  });

  it("polls every 3 s while running, stops once finished and refreshes the run's results", async () => {
    live.getPlaywrightLive.mockResolvedValueOnce(RUNNING).mockResolvedValueOnce(RUNNING).mockResolvedValue(PASSED);
    const { vm, onFinished } = renderVm();
    await flush();
    expect(reads()).toBe(1);
    await advance(2_999);
    expect(reads()).toBe(1);
    await advance(1);
    expect(reads()).toBe(2);
    await advance(3_000);
    expect(reads()).toBe(3);
    expect(vm().runs["proj-fe"]?.status).toBe("passed");
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(vm().announcement).toBe("Playwright passed in storefront-web: 12 of 12 · 1m 01s.");
    await advance(30_000);
    expect(reads()).toBe(3);
  });

  it("announces milestones only: running on arrival, then each new failure", async () => {
    const more = run({
      done: 5,
      failed: 2,
      tests: [...(liveRun().tests as object[]), { id: "t6", title: "applies a coupon", status: "failed", file: "e2e/cart.spec.ts" }],
    });
    live.getPlaywrightLive.mockResolvedValueOnce(RUNNING).mockResolvedValueOnce(RUNNING).mockResolvedValue(more);
    const { vm } = renderVm();
    await flush();
    expect(vm().announcement).toBe("Playwright is running in storefront-web.");
    await advance(3_000);
    expect(vm().announcement).toBe("Playwright is running in storefront-web.");
    await advance(3_000);
    expect(vm().announcement).toBe("Failed in storefront-web: applies a coupon.");
  });

  it("pauses while the browser tab is hidden and reads at once when it shows again", async () => {
    live.getPlaywrightLive.mockResolvedValue(RUNNING);
    renderVm();
    await flush();
    setVisibility("hidden");
    await advance(15_000);
    expect(reads()).toBe(1);
    setVisibility("visible");
    await flush();
    expect(reads()).toBe(2);
    await advance(3_000);
    expect(reads()).toBe(3);
  });

  it("keeps polling through a failed read while the run was going", async () => {
    live.getPlaywrightLive
      .mockResolvedValueOnce(RUNNING)
      .mockRejectedValueOnce(new ApiError("down", 502))
      .mockResolvedValue(RUNNING);
    const { vm } = renderVm();
    await flush();
    await advance(3_000);
    expect(vm().runs["proj-fe"]).toEqual(RUNNING);
    await advance(3_000);
    expect(reads()).toBe(3);
  });
});

describe("usePlaywrightLiveViewModel — after Run Playwright", () => {
  it("reads at once and keeps reading until the new run shows up, then follows it to the end", async () => {
    live.getPlaywrightLive.mockResolvedValueOnce(PASSED);
    const { vm, rerender, onFinished } = renderVm();
    await flush();
    expect(vm().awaiting).toBe(false);
    expect(vm().confirmation).toBe("hidden");

    live.getPlaywrightLive.mockResolvedValueOnce(PASSED).mockResolvedValueOnce(PASSED).mockResolvedValueOnce(QUEUED);
    await rerender({ startedAt: Date.now() });
    expect(reads()).toBe(2);
    expect(vm().awaiting).toBe(true);
    expect(vm().confirmation).toBe("waiting");
    await advance(3_000);
    expect(reads()).toBe(3);
    expect(vm().awaiting).toBe(true);
    await advance(3_000);
    expect(reads()).toBe(4);
    expect(vm().runs["proj-fe"]?.status).toBe("queued");
    expect(vm().awaiting).toBe(false);
    expect(vm().confirmation).toBe("hidden");
    expect(vm().announcement).toBe("Playwright started in storefront-web.");

    live.getPlaywrightLive.mockResolvedValueOnce({ ...PASSED, runId: 124 });
    await advance(3_000);
    expect(onFinished).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(reads()).toBe(5);
  });

  it("refreshes when the new run is already finished by its first read", async () => {
    live.getPlaywrightLive.mockResolvedValueOnce(PASSED);
    const { rerender, onFinished } = renderVm();
    await flush();
    live.getPlaywrightLive.mockResolvedValueOnce({ ...PASSED, runId: 124 });
    await rerender({ startedAt: Date.now() });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("stops waiting after 3 minutes without a run", async () => {
    live.getPlaywrightLive.mockResolvedValue(null);
    const { vm, rerender } = renderVm();
    await flush();
    await rerender({ startedAt: Date.now() });
    expect(vm().awaiting).toBe(true);
    await advance(3 * 60_000);
    expect(vm().awaiting).toBe(false);
    const after = reads();
    await advance(30_000);
    expect(reads()).toBe(after);
    // No run ever showed: the confirmation stays as it was.
    expect(vm().confirmation).toBe("as-is");
  });
});

describe("usePlaywrightLiveViewModel — fallback and cancelling", () => {
  it("treats a 404 as an older backend: unsupported, and never asks again", async () => {
    live.getPlaywrightLive.mockRejectedValue(new ApiError("Cannot GET", 404));
    const { vm, rerender } = renderVm();
    await flush();
    expect(vm().supported).toBe(false);
    expect(vm().confirmation).toBe("as-is");
    await rerender({ startedAt: Date.now() });
    await advance(30_000);
    expect(reads()).toBe(1);
    expect(vm().awaiting).toBe(false);
  });

  it("stops on unmount, and drops an answer that arrives after", async () => {
    let answer: (value: PlaywrightLiveRun) => void = () => undefined;
    live.getPlaywrightLive.mockResolvedValueOnce(RUNNING).mockImplementationOnce(
      () => new Promise<PlaywrightLiveRun>((resolve) => {
        answer = resolve;
      }),
    );
    const { onFinished } = renderVm();
    await flush();
    await advance(3_000);
    expect(reads()).toBe(2);
    act(() => root?.unmount());
    root = null;
    await act(async () => {
      answer(PASSED);
      await Promise.resolve();
    });
    await advance(30_000);
    expect(reads()).toBe(2);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("starts over for another set of repositories (a project change)", async () => {
    live.getPlaywrightLive.mockResolvedValueOnce(RUNNING).mockResolvedValue(null);
    const { vm, rerender } = renderVm();
    await flush();
    expect(vm().runs).toEqual({ "proj-fe": RUNNING });
    await rerender({ repositories: [{ projectId: "proj-other", name: "other-web" }] });
    expect(live.getPlaywrightLive).toHaveBeenLastCalledWith("proj-other", "uat");
    expect(vm().runs).toEqual({ "proj-other": null });
    await advance(30_000);
    expect(live.getPlaywrightLive.mock.calls.filter(([id]) => id === "proj-fe")).toHaveLength(1);
  });

  it("pauses when the tab is switched away, and reads again on return", async () => {
    live.getPlaywrightLive.mockResolvedValue(RUNNING);
    const { rerender } = renderVm();
    await flush();
    await rerender({ enabled: false });
    await advance(15_000);
    expect(reads()).toBe(1);
    await rerender({ enabled: true });
    expect(reads()).toBe(2);
  });
});
