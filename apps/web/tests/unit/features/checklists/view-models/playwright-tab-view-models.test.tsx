import { act, type KeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun } from "../../../../../src/features/checklists/model/project-run-types";
import { useProjectAutomationViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-automation-view-model";
import type { AutomationDispatchControls } from "../../../../../src/features/checklists/studio/view-models/use-qa-automation-view-model";
import {
  useStudioColumnTab,
  type StudioColumnTabViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-studio-column-tab";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { ApiError } from "../../../../../src/shared/api/request";
import { verifyFailure } from "../qa-automation-fixtures";
import { projectRunWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { get: jest.fn(), dispatchAutomation: jest.fn() },
}));

const repo = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const NOW = Date.parse("2026-09-25T07:00:00.000Z");

function run(overrides: Record<string, unknown> = {}): ProjectQaRun {
  const value = normalizeProjectRun(projectRunWire({ automation: { verify: null, quality: null }, ...overrides }));
  if (!value) throw new Error("fixture");
  return value;
}

const BOTH_STARTED = {
  dispatched: [
    { projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: "a1b2c3d", targetsRunCommit: true },
    { projectId: "proj-be", repoFullName: "tone/orders-api", ref: "uat", headSha: "fff0000", targetsRunCommit: false },
  ],
  failed: [],
};

function reported(at: string): ProjectQaRun {
  return run({
    automationByRepository: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: { verify: verifyFailure({ reportedAt: at }) } },
      { projectId: "proj-be", repoFullName: "tone/orders-api", automation: { verify: verifyFailure({ reportedAt: at }) } },
    ],
  });
}

let root: Root | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
  jest.clearAllMocks();
  jest.useRealTimers();
});

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(node));
}

function renderVm(options: { run?: ProjectQaRun; role?: AppRole | null } = {}) {
  let latest: AutomationDispatchControls | undefined;
  const record = (value: AutomationDispatchControls) => {
    latest = value;
  };
  const onRun = jest.fn();
  function Probe({ onRender }: { onRender: (value: AutomationDispatchControls) => void }) {
    onRender(
      useProjectAutomationViewModel({
        deliveryProjectId: "dp-1",
        run: options.run ?? run(),
        appRole: options.role === undefined ? "qa" : options.role,
        onRun,
        projectId: "project-1",
      }),
    );
    return null;
  }
  mount(<Probe onRender={record} />);
  return { vm: () => latest as AutomationDispatchControls, onRun };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Project run — Run Playwright", () => {
  it.each<[AppRole | null, boolean]>([
    ["qa", true],
    ["lead", true],
    ["admin", true],
    ["member", false],
    [null, false],
  ])("is offered to %s: %s", (role, offered) => {
    expect(renderVm({ role }).vm().canDispatch).toBe(offered);
  });

  it("is hidden when the server says this viewer may not dispatch on the open run", () => {
    expect(renderVm({ run: run({ permissions: { canSetVerification: true, canSignOff: true, canReopen: false, canDispatch: false } }) }).vm().canDispatch).toBe(false);
  });

  it("stays offered but blocked, with the reason, on a signed-off run", async () => {
    const signed = run({ status: "signed_off", permissions: { canSetVerification: false, canSignOff: false, canReopen: true, canDispatch: false } });
    const { vm } = renderVm({ run: signed });
    expect(vm().canDispatch).toBe(true);
    expect(vm().blockedReason).toMatch(/signed off/);
    await act(async () => vm().dispatch());
    expect(repo.dispatchAutomation).not.toHaveBeenCalled();
  });

  it("dispatches on the Project endpoint (not the repository one), confirms and warns", async () => {
    repo.dispatchAutomation.mockResolvedValue(BOTH_STARTED);
    const { vm } = renderVm();
    await act(async () => vm().dispatch());
    expect(repo.dispatchAutomation).toHaveBeenCalledWith("dp-1", "prun-1");
    expect(vm().status).toBe("watching");
    expect(vm().confirmation).toBe("Playwright started on uat in storefront-web and orders-api. Results appear here when the runs report.");
    expect(vm().warning).toMatch(/^uat moved in orders-api/);
  });

  it("re-reads the Project run every 20 seconds and hands it over", async () => {
    repo.dispatchAutomation.mockResolvedValue(BOTH_STARTED);
    repo.get.mockResolvedValue(run());
    const { vm, onRun } = renderVm();
    await act(async () => vm().dispatch());
    await advance(19_999);
    expect(repo.get).not.toHaveBeenCalled();
    await advance(1);
    await flush();
    expect(repo.get).toHaveBeenCalledWith("dp-1", "prun-1");
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(vm().status).toBe("watching");
  });

  it("stops once every repository it started in reported", async () => {
    repo.dispatchAutomation.mockResolvedValue(BOTH_STARTED);
    repo.get.mockResolvedValue(reported("2026-09-25T07:05:00.000Z"));
    const { vm } = renderVm();
    await act(async () => vm().dispatch());
    await advance(20_000);
    await flush();
    expect(vm().status).toBe("dispatched");
    await advance(60_000);
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it("keeps watching past reports from before the dispatch, and stops after 10 minutes", async () => {
    repo.dispatchAutomation.mockResolvedValue(BOTH_STARTED);
    repo.get.mockResolvedValue(reported("2026-09-25T06:00:00.000Z"));
    const { vm } = renderVm();
    await act(async () => vm().dispatch());
    for (let tick = 0; tick < 29; tick += 1) {
      await advance(20_000);
      await flush();
    }
    expect(vm().status).toBe("watching");
    await advance(20_000);
    await flush();
    expect(vm().status).toBe("dispatched");
  });

  it("does not watch when nothing could be started", async () => {
    repo.dispatchAutomation.mockResolvedValue({ dispatched: [], failed: [] });
    const { vm } = renderVm();
    await act(async () => vm().dispatch());
    expect(vm().status).toBe("dispatched");
    await advance(40_000);
    expect(repo.get).not.toHaveBeenCalled();
  });

  it("asks the viewer to sign in again on GITHUB_REAUTH", async () => {
    repo.dispatchAutomation.mockRejectedValue(new ApiError("x", 409, { code: "GITHUB_REAUTH" }));
    const { vm } = renderVm();
    await act(async () => vm().dispatch());
    expect(vm().status).toBe("failed");
    expect(vm().error?.signIn).toBe(true);
    expect(vm().signInHref).toBe("/login?next=/projects/project-1");
    act(() => vm().dismiss());
    expect(vm().error).toBeNull();
  });
});

function renderTabs(studio: "qa" | "po" = "qa") {
  let latest: StudioColumnTabViewModel | undefined;
  const record = (value: StudioColumnTabViewModel) => {
    latest = value;
  };
  function Probe({ onRender }: { onRender: (value: StudioColumnTabViewModel) => void }) {
    onRender(useStudioColumnTab(studio));
    return null;
  }
  mount(<Probe onRender={record} />);
  return () => latest as StudioColumnTabViewModel;
}

function key(name: string): KeyboardEvent<HTMLButtonElement> {
  return { key: name, preventDefault: jest.fn() } as unknown as KeyboardEvent<HTMLButtonElement>;
}

describe("Studio column tabs", () => {
  it("opens on the Checklist and remembers Playwright per studio", () => {
    let vm = renderTabs("qa");
    expect(vm().tab).toBe("checklist");
    expect(vm().playwrightOpened).toBe(false);
    act(() => vm().select("playwright"));
    expect(vm().tab).toBe("playwright");
    expect(vm().playwrightOpened).toBe(true);
    expect(window.localStorage.getItem("alphaci.qa-studio.column-tab")).toBe("playwright");
    act(() => root?.unmount());
    vm = renderTabs("qa");
    expect(vm().tab).toBe("playwright");
    expect(vm().playwrightOpened).toBe(true);
    act(() => root?.unmount());
    vm = renderTabs("po");
    expect(vm().tab).toBe("checklist");
  });

  it("still works when storage throws", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const vm = renderTabs();
    expect(vm().tab).toBe("checklist");
    act(() => vm().select("playwright"));
    expect(vm().tab).toBe("playwright");
    spy.mockRestore();
    set.mockRestore();
  });

  it("moves with the arrow keys (wrapping), Home and End, and ignores other keys", () => {
    const vm = renderTabs();
    const right = key("ArrowRight");
    act(() => vm().onKeyDown(right));
    expect(vm().tab).toBe("playwright");
    expect(right.preventDefault).toHaveBeenCalled();
    act(() => vm().onKeyDown(key("ArrowRight")));
    expect(vm().tab).toBe("checklist");
    act(() => vm().onKeyDown(key("ArrowLeft")));
    expect(vm().tab).toBe("playwright");
    act(() => vm().onKeyDown(key("Home")));
    expect(vm().tab).toBe("checklist");
    act(() => vm().onKeyDown(key("End")));
    expect(vm().tab).toBe("playwright");
    const other = key("Enter");
    act(() => vm().onKeyDown(other));
    expect(other.preventDefault).not.toHaveBeenCalled();
    expect(vm().tab).toBe("playwright");
  });
});
