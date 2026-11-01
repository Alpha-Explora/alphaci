import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import {
  useQaAutomationViewModel,
  type QaAutomationViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-qa-automation-view-model";
import {
  useRememberedChoice,
  useRememberedFlag,
} from "../../../../../src/features/checklists/studio/view-models/use-remembered-flag";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { ApiError } from "../../../../../src/shared/api/request";
import { automation, verifyFailure } from "../qa-automation-fixtures";
import { qaRun } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: { get: jest.fn(), dispatchAutomation: jest.fn() },
}));

const repo = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const NOW = Date.parse("2026-09-25T07:00:00.000Z");

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

function renderVm(options: { run?: QaRun; role?: AppRole | null; onRun?: (run: QaRun) => void } = {}) {
  let latest: QaAutomationViewModel | undefined;
  const record = (value: QaAutomationViewModel) => {
    latest = value;
  };
  const onRun = options.onRun ?? jest.fn();
  function Probe({ onRender }: { onRender: (value: QaAutomationViewModel) => void }) {
    onRender(
      useQaAutomationViewModel({
        projectId: "p1",
        run: options.run ?? qaRun(),
        appRole: options.role === undefined ? "qa" : options.role,
        onRun,
      }),
    );
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Probe onRender={record} />));
  return { vm: () => latest as QaAutomationViewModel, onRun };
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
    await Promise.resolve();
  });
}

async function dispatch(vm: () => QaAutomationViewModel) {
  await act(async () => {
    await vm().dispatch();
  });
}

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("useQaAutomationViewModel — results", () => {
  it("shows no results, without failing, for a run from an older backend", () => {
    const { vm } = renderVm({ run: qaRun() });
    expect(vm().status).toBe("idle");
    expect(vm().automation).toEqual({ verify: null, quality: null });
    expect(vm().hasResults).toBe(false);
  });

  it("normalises the run's automation", () => {
    const { vm } = renderVm({ run: qaRun({ automation: automation() }) });
    expect(vm().hasResults).toBe(true);
    expect(vm().automation.verify?.tests?.failed).toBe(2);
    expect(vm().automation.quality?.status).toBe("success");
  });

  it("offers Run Playwright only to QA Team, Team leads and Admins", () => {
    expect(renderVm({ role: "qa" }).vm().canDispatch).toBe(true);
    act(() => root?.unmount());
    expect(renderVm({ role: "admin" }).vm().canDispatch).toBe(true);
    act(() => root?.unmount());
    expect(renderVm({ role: "member" }).vm().canDispatch).toBe(false);
    act(() => root?.unmount());
    expect(renderVm({ role: null }).vm().canDispatch).toBe(false);
  });
});

describe("useQaAutomationViewModel — dispatch", () => {
  it("starts Playwright and confirms on the ref, with no warning on the run's own commit", async () => {
    repo.dispatchAutomation.mockResolvedValue({ workflowFile: "verify.yml", ref: "main", headSha: "abc1234def5678", targetsRunCommit: true });
    const { vm } = renderVm();
    await dispatch(vm);
    expect(repo.dispatchAutomation).toHaveBeenCalledWith("p1", "run-1");
    expect(vm().status).toBe("watching");
    expect(vm().confirmation).toBe("Playwright started on main. Results appear here when the run reports.");
    expect(vm().warning).toBeNull();
    expect(vm().error).toBeNull();
  });

  it("warns when the branch has moved past the run's commit", async () => {
    repo.dispatchAutomation.mockResolvedValue({ ref: "main", headSha: "9f8e7d6c5b4a", targetsRunCommit: false });
    const { vm } = renderVm();
    await dispatch(vm);
    expect(vm().warning).toBe(
      "The branch has moved to 9f8e7d6 — results will attach to that commit, not this run's abc1234.",
    );
  });

  it("shows Starting while the request is in flight and ignores a second click", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    repo.dispatchAutomation.mockReturnValue(new Promise((done) => (resolve = done)) as never);
    const { vm } = renderVm();
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = vm().dispatch();
      void vm().dispatch();
    });
    expect(vm().status).toBe("dispatching");
    expect(repo.dispatchAutomation).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ ref: "main", targetsRunCommit: true });
      await first;
    });
    expect(vm().status).toBe("watching");
  });

  it("does nothing on a signed-off run, and says why", async () => {
    const { vm } = renderVm({ run: qaRun({ status: "signed_off" }) });
    expect(vm().blockedReason).toMatch(/signed off/);
    await dispatch(vm);
    expect(repo.dispatchAutomation).not.toHaveBeenCalled();
    expect(vm().status).toBe("idle");
  });

  it("does nothing for a Developer", async () => {
    const { vm } = renderVm({ role: "member" });
    await dispatch(vm);
    expect(repo.dispatchAutomation).not.toHaveBeenCalled();
  });

  it("asks the viewer to sign in again on GITHUB_REAUTH, and can be dismissed", async () => {
    repo.dispatchAutomation.mockRejectedValue(new ApiError("x", 409, { code: "GITHUB_REAUTH" }));
    const { vm } = renderVm();
    await dispatch(vm);
    expect(vm().status).toBe("failed");
    expect(vm().error).toEqual({ message: expect.stringMatching(/sign in again/), signIn: true, failures: [] });
    expect(vm().signInHref).toBe("/login?next=/projects/p1");
    act(() => vm().dismiss());
    expect(vm().status).toBe("idle");
    expect(vm().error).toBeNull();
  });

  it("shows GitHub's own refusal for a 403 instead of blaming the role", async () => {
    repo.dispatchAutomation.mockRejectedValue(
      new ApiError("x", 403, { message: "Resource not accessible by personal access token" }),
    );
    const { vm } = renderVm();
    await dispatch(vm);
    expect(vm().status).toBe("failed");
    expect(vm().error?.message).toBe("Resource not accessible by personal access token");
    expect(vm().failures).toEqual([]);
  });

  it("falls back to a generic GitHub line when a 403 carries no message", async () => {
    repo.dispatchAutomation.mockRejectedValue(new ApiError("x", 403, {}));
    const { vm } = renderVm();
    await dispatch(vm);
    expect(vm().error?.message).toBe("GitHub refused to start Playwright.");
  });

  it("explains a missing verify workflow", async () => {
    repo.dispatchAutomation.mockRejectedValue(new ApiError("x", 409, { code: "VERIFY_WORKFLOW_MISSING" }));
    const { vm } = renderVm();
    await dispatch(vm);
    expect(vm().error).toEqual({ message: expect.stringMatching(/no verify workflow/), signIn: false, failures: [] });
    expect(vm().confirmation).toBeNull();
  });

  it("keeps a started workflow's confirmation when dismiss is pressed", async () => {
    repo.dispatchAutomation.mockResolvedValue({ ref: "main", targetsRunCommit: true });
    const { vm } = renderVm();
    await dispatch(vm);
    act(() => vm().dismiss());
    expect(vm().confirmation).not.toBeNull();
  });
});

describe("useQaAutomationViewModel — polling after a dispatch", () => {
  beforeEach(() => {
    repo.dispatchAutomation.mockResolvedValue({ ref: "main", headSha: "abc1234", targetsRunCommit: true });
  });

  it("does not poll before anything was started", async () => {
    renderVm();
    await advance(60_000);
    expect(repo.get).not.toHaveBeenCalled();
  });

  it("re-reads the run every 20 seconds and hands it over", async () => {
    const polled = qaRun({ automation: automation() });
    repo.get.mockResolvedValue(polled);
    const { vm, onRun } = renderVm();
    await dispatch(vm);
    await advance(19_999);
    expect(repo.get).not.toHaveBeenCalled();
    await advance(1);
    expect(repo.get).toHaveBeenCalledWith("p1", "run-1");
    expect(onRun).toHaveBeenCalledWith(polled);
    await advance(20_000);
    expect(repo.get).toHaveBeenCalledTimes(2);
  });

  it("stops after 10 minutes", async () => {
    repo.get.mockResolvedValue(qaRun());
    const { vm } = renderVm();
    await dispatch(vm);
    await advance(10 * 60_000);
    // Ticks at 20 s … 580 s fetch; the 600 s tick closes the window instead.
    expect(repo.get).toHaveBeenCalledTimes(29);
    expect(vm().status).toBe("dispatched");
    await advance(5 * 60_000);
    expect(repo.get).toHaveBeenCalledTimes(29);
  });

  it("stops early once the verify stage has reported for this run", async () => {
    repo.get.mockResolvedValue(
      qaRun({ automation: { verify: verifyFailure({ reportedAt: "2026-09-25T07:00:15.000Z" }) } }),
    );
    const { vm } = renderVm();
    await dispatch(vm);
    await advance(20_000);
    await flush();
    expect(vm().status).toBe("dispatched");
    await advance(60_000);
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it("keeps polling past a report from before the dispatch, and past a failed poll", async () => {
    repo.get
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(qaRun({ automation: automation() }));
    const { vm } = renderVm();
    await dispatch(vm);
    await advance(40_000);
    expect(repo.get).toHaveBeenCalledTimes(2);
    expect(vm().status).toBe("watching");
  });

  it("pauses while the tab is hidden and resumes when it is visible again", async () => {
    repo.get.mockResolvedValue(qaRun());
    const { vm } = renderVm();
    await dispatch(vm);
    setVisibility("hidden");
    await advance(120_000);
    expect(repo.get).not.toHaveBeenCalled();
    setVisibility("visible");
    await advance(20_000);
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it("does not resume a hidden tab after the window closed", async () => {
    repo.get.mockResolvedValue(qaRun());
    const { vm } = renderVm();
    await dispatch(vm);
    setVisibility("hidden");
    await advance(11 * 60_000);
    setVisibility("visible");
    await advance(20_000);
    expect(repo.get).not.toHaveBeenCalled();
    expect(vm().status).toBe("dispatched");
  });

  it("stops on unmount", async () => {
    repo.get.mockResolvedValue(qaRun());
    const { vm } = renderVm();
    await dispatch(vm);
    act(() => root?.unmount());
    root = null;
    await advance(60_000);
    expect(repo.get).not.toHaveBeenCalled();
  });
});

describe("useRememberedFlag", () => {
  function renderFlag() {
    let latest: [boolean, () => void] | undefined;
    const record = (value: [boolean, () => void]) => {
      latest = value;
    };
    function Probe({ onRender }: { onRender: (value: [boolean, () => void]) => void }) {
      onRender(useRememberedFlag("test.flag", false));
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Probe onRender={record} />));
    return () => latest as [boolean, () => void];
  }

  afterEach(() => window.localStorage.clear());

  it("remembers the choice in this browser", () => {
    const flag = renderFlag();
    expect(flag()[0]).toBe(false);
    act(() => flag()[1]());
    expect(flag()[0]).toBe(true);
    expect(window.localStorage.getItem("test.flag")).toBe("1");
    act(() => root?.unmount());
    expect(renderFlag()()[0]).toBe(true);
  });

  it("still works when storage throws", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const flag = renderFlag();
    expect(flag()[0]).toBe(false);
    act(() => flag()[1]());
    expect(flag()[0]).toBe(true);
    get.mockRestore();
    set.mockRestore();
  });
});

describe("useRememberedChoice", () => {
  type Pick3 = "a" | "b" | "c";
  const resolve = (stored: string | null): Pick3 => (stored === "b" || stored === "c" ? stored : "a");

  function renderChoice() {
    let latest: [Pick3, (next: Pick3) => void] | undefined;
    const record = (value: [Pick3, (next: Pick3) => void]) => {
      latest = value;
    };
    function Probe({ onRender }: { onRender: (value: [Pick3, (next: Pick3) => void]) => void }) {
      onRender(useRememberedChoice("test.choice", resolve));
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Probe onRender={record} />));
    return () => latest as [Pick3, (next: Pick3) => void];
  }

  afterEach(() => window.localStorage.clear());

  it("resolves what storage holds, and stores the value chosen", () => {
    window.localStorage.setItem("test.choice", "c");
    const choice = renderChoice();
    expect(choice()[0]).toBe("c");
    act(() => choice()[1]("b"));
    expect(choice()[0]).toBe("b");
    expect(window.localStorage.getItem("test.choice")).toBe("b");
  });

  it("hands resolve null when nothing is stored, and the fallback reaches the UI", () => {
    expect(renderChoice()()[0]).toBe("a");
    act(() => root?.unmount());
    window.localStorage.setItem("test.choice", "zzz");
    expect(renderChoice()()[0]).toBe("a");
  });
});

describe("useRememberedFlag storage format", () => {
  afterEach(() => window.localStorage.clear());

  it("reads anything but \"1\" as off once something is stored", () => {
    let value: boolean | undefined;
    const record = (next: boolean) => {
      value = next;
    };
    function Probe({ onRender }: { onRender: (next: boolean) => void }) {
      onRender(useRememberedFlag("test.flag", true)[0]);
      return null;
    }
    window.localStorage.setItem("test.flag", "yes");
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Probe onRender={record} />));
    expect(value).toBe(false);
  });
});
