import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { normalizeProjectMyItems, normalizeProjectRun, normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun } from "../../../../../src/features/checklists/model/project-run-types";
import { normalizeRequirementItem } from "../../../../../src/features/checklists/model/requirement-rules";
import { useProjectMyItemsViewModel } from "../../../../../src/features/checklists/returned/view-models/use-project-my-items-view-model";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import {
  useProjectReopenViewModel,
  useProjectSignoffViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-project-signoff-view-model";
import { useProjectVerificationViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-verification-view-model";
import { useStudioRunsViewModel } from "../../../../../src/features/checklists/studio/view-models/use-studio-runs-view-model";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { apiErrorWith, promotionWire } from "../qa-promotion-fixtures";
import { headWire, itemWire, projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: {
    current: jest.fn(),
    start: jest.fn(),
    get: jest.fn(),
    setVerification: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    myItems: jest.fn(),
  },
}));

jest.mock("../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { current: jest.fn().mockResolvedValue(null), mergeAll: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: { current: jest.fn(), promotion: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/checklists-repository", () => ({
  checklistsRepository: { listForProject: jest.fn().mockResolvedValue({ items: [], canManage: false }) },
}));

const repo = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const legacy = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const versions = iterationsRepository as jest.Mocked<typeof iterationsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

function renderHook<P, T>(useHook: (props: P) => T, initial: P) {
  let latest: T | undefined;
  const record = (value: T) => {
    latest = value;
  };
  function Probe({ props, onRender }: { props: P; onRender: (value: T) => void }) {
    onRender(useHook(props));
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Probe props={initial} onRender={record} />));
  return {
    current: () => latest as T,
    rerender: (props: P) => act(() => root!.render(<Probe props={props} onRender={record} />)),
  };
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function run(overrides: Record<string, unknown> = {}): ProjectQaRun {
  return normalizeProjectRun(projectRunWire(overrides))!;
}

const ALL = { canSetVerification: true, canSignOff: true, canReopen: true, canDispatch: true };

describe("useProjectRunViewModel", () => {
  const hook = (dp: string | null, enabled = true) =>
    renderHook((p: { dp: string | null }) => useProjectRunViewModel({ deliveryProjectId: p.dp, enabled }), { dp });

  it("stays idle without a Project", () => {
    const vm = hook(null);
    expect(vm.current().status).toBe("idle");
    expect(repo.current).not.toHaveBeenCalled();
  });

  it("loads the run on the current heads", async () => {
    repo.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire(), heads: [headWire()], stale: false, requirementsChanged: true }));
    const vm = hook("dp-1");
    expect(vm.current().status).toBe("loading");
    await flush();
    expect(vm.current().status).toBe("ready");
    expect(vm.current().run?.id).toBe("prun-1");
    expect(vm.current().heads).toHaveLength(1);
    expect(vm.current().requirementsChanged).toBe(true);
  });

  it("reads a 404 as unavailable (an older backend) and any other failure as an error", async () => {
    repo.current.mockRejectedValueOnce(apiErrorWith(404));
    const vm = hook("dp-1");
    await flush();
    expect(vm.current().status).toBe("unavailable");
    expect(vm.current().error).toBeNull();
    repo.current.mockRejectedValueOnce(apiErrorWith(500));
    act(() => vm.current().reload());
    await flush();
    expect(vm.current().status).toBe("error");
    expect(vm.current().error).toMatch(/could not be loaded/);
  });

  it("starts a run, and remembers whether the server created it or found one", async () => {
    repo.current.mockResolvedValue(normalizeProjectRunCurrent({ run: null, heads: [headWire()] }));
    repo.start.mockResolvedValue({ created: false, run: run() });
    const vm = hook("dp-1");
    await flush();
    expect(vm.current().run).toBeNull();
    await act(async () => vm.current().start());
    expect(repo.start).toHaveBeenCalledWith("dp-1");
    expect(vm.current().run?.id).toBe("prun-1");
    expect(vm.current().lastStart).toBe("existing");
    expect(vm.current().status).toBe("ready");
  });

  it("explains a refused start in product words", async () => {
    repo.current.mockResolvedValue(normalizeProjectRunCurrent({ run: null }));
    repo.start.mockRejectedValue(apiErrorWith(409, { code: "QA_NO_REQUIREMENTS" }));
    const vm = hook("dp-1");
    await flush();
    await act(async () => vm.current().start());
    expect(vm.current().startError?.message).toMatch(/no requirements yet/);
  });

  it("adopts a run a write returned, and ignores another run", async () => {
    repo.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire() }));
    const vm = hook("dp-1");
    await flush();
    act(() => vm.current().applyRun(run({ status: "signed_off", stale: true })));
    expect(vm.current().run?.status).toBe("signed_off");
    expect(vm.current().stale).toBe(true);
    act(() => vm.current().applyRun(run({ id: "other" })));
    expect(vm.current().run?.id).toBe("prun-1");
  });
});

describe("useProjectVerificationViewModel", () => {
  function hook(value: ProjectQaRun, permissions = ALL) {
    const onRun = jest.fn();
    const onReload = jest.fn();
    const vm = renderHook(
      () => useProjectVerificationViewModel({ deliveryProjectId: "dp-1", run: value, permissions, onRun, onReload }),
      undefined,
    );
    return { vm, onRun, onReload };
  }

  it("saves Passed at once on a Done item", async () => {
    const value = run();
    repo.setVerification.mockResolvedValue(value);
    const { vm, onRun } = hook(value);
    expect(vm.current().allowedStatuses(value.items[0])).toContain("passed");
    act(() => vm.current().chooseStatus(value.items[0], "passed"));
    await flush();
    expect(repo.setVerification).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1", { status: "passed", expectedRowVersion: 1 });
    expect(onRun).toHaveBeenCalledWith(value);
  });

  it("never sends Passed for an item a Developer has not marked Done", () => {
    const value = run();
    const { vm } = hook(value);
    expect(vm.current().allowedStatuses(value.items[1])).not.toContain("passed");
    act(() => vm.current().chooseStatus(value.items[1], "passed"));
    expect(repo.setVerification).not.toHaveBeenCalled();
  });

  it("asks for a severity before Failed (which sends it back to the Developers), then sends it", async () => {
    const value = run();
    repo.setVerification.mockResolvedValue(null);
    const { vm, onReload } = hook(value);
    act(() => vm.current().chooseStatus(value.items[0], "failed"));
    expect(vm.current().openItemId).toBe("run-item-1");
    expect(repo.setVerification).not.toHaveBeenCalled();
    await act(async () => vm.current().saveDraft(value.items[0]));
    expect(vm.current().draftError).toMatch(/severity/);
    act(() => vm.current().updateDraft({ defectSeverity: "major", notes: "Card declined" }));
    await act(async () => vm.current().saveDraft(value.items[0]));
    expect(repo.setVerification).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1", {
      status: "failed",
      expectedRowVersion: 1,
      notes: "Card declined",
      defectSeverity: "major",
    });
    // The reply carried no run: read it again.
    expect(onReload).toHaveBeenCalled();
    expect(vm.current().openItemId).toBeNull();
  });

  it("offers a developer nothing and shows a stale write as stale", async () => {
    const value = run();
    const readOnly = hook(value, { ...ALL, canSetVerification: false });
    expect(readOnly.vm.current().allowedStatuses(value.items[0])).toEqual([]);
    act(() => root?.unmount());
    root = null;

    repo.setVerification.mockRejectedValue(apiErrorWith(409, { code: "QA_ITEM_STALE", message: "changed" }));
    const { vm } = hook(value);
    act(() => vm.current().chooseStatus(value.items[0], "passed"));
    await flush();
    expect(vm.current().error).toMatchObject({ itemId: "run-item-1", stale: true });
    act(() => vm.current().dismissError());
    expect(vm.current().error).toBeNull();
    act(() => vm.current().openDetails(value.items[0]));
    act(() => vm.current().closeDetails());
    expect(vm.current().openItemId).toBeNull();
  });

  it("never sends Blocked or Returned to dev: QA picks Pending, Passed or Failed", async () => {
    const value = run();
    const { vm } = hook(value);
    expect(vm.current().allowedStatuses(value.items[0])).toEqual(["pending", "passed", "failed"]);
    act(() => vm.current().chooseStatus(value.items[0], "blocked"));
    act(() => vm.current().chooseStatus(value.items[0], "returned_to_dev"));
    await flush();
    expect(repo.setVerification).not.toHaveBeenCalled();
  });
});

describe("Project sign-off and reopen", () => {
  it("signs an open run off through the Project route", async () => {
    const value = run({ items: [runItemWire({ status: "passed" })] });
    repo.signoff.mockResolvedValue(run({ status: "signed_off" }));
    const onRun = jest.fn();
    const vm = renderHook(
      () => useProjectSignoffViewModel({ deliveryProjectId: "dp-1", run: value, permissions: ALL, onRun }),
      undefined,
    );
    expect(vm.current().canSignOff).toBe(true);
    act(() => vm.current().openDialog());
    expect(vm.current().verdict).toBe("APPROVED");
    await act(async () => vm.current().submit());
    expect(repo.signoff).toHaveBeenCalledWith("dp-1", "prun-1", { verdict: "APPROVED" });
    expect(onRun).toHaveBeenCalled();
    expect(vm.current().status).toBe("closed");
  });

  it("offers no sign-off without the permission, and reopens only a signed-off run", async () => {
    const open = run();
    const signoff = renderHook(
      () => useProjectSignoffViewModel({ deliveryProjectId: "dp-1", run: open, permissions: { canSignOff: false }, onRun: jest.fn() }),
      undefined,
    );
    expect(signoff.current().canSignOff).toBe(false);
    act(() => root?.unmount());
    root = null;

    const signed = run({ status: "signed_off" });
    repo.reopen.mockResolvedValue(run());
    const onRun = jest.fn();
    const reopen = renderHook(
      () => useProjectReopenViewModel({ deliveryProjectId: "dp-1", run: signed, permissions: ALL, onRun }),
      undefined,
    );
    expect(reopen.current().canReopen).toBe(true);
    await act(async () => reopen.current().reopen());
    expect(repo.reopen).toHaveBeenCalledWith("dp-1", "prun-1");
    expect(onRun).toHaveBeenCalled();
  });

  it("shows a refused reopen as a sentence", async () => {
    repo.reopen.mockRejectedValue(apiErrorWith(403));
    const reopen = renderHook(
      () => useProjectReopenViewModel({ deliveryProjectId: "dp-1", run: run({ status: "signed_off" }), permissions: ALL, onRun: jest.fn() }),
      undefined,
    );
    await act(async () => reopen.current().reopen());
    expect(reopen.current().error?.message).toBe("Your role cannot make this change.");
    expect(reopen.current().status).toBe("idle");
  });
});

describe("useProjectMyItemsViewModel", () => {
  const feed = { requirement: { id: "req-1", name: "Pay", kind: "functional" }, item: itemWire(), runId: null, runItem: null };

  it("loads the four buckets and re-reads after a Progress write", async () => {
    repo.myItems.mockResolvedValue(normalizeProjectMyItems({ todo: [feed] }));
    const vm = renderHook(() => useProjectMyItemsViewModel({ deliveryProjectId: "dp-1", enabled: true }), undefined);
    expect(vm.current().status).toBe("loading");
    await flush();
    expect(vm.current().status).toBe("ready");
    expect(vm.current().data.todo).toHaveLength(1);
    act(() => vm.current().applyItem({ ...normalizeRequirementItem(itemWire(), "req-1")!, progress: "in_progress" }));
    expect(vm.current().data.todo[0].item.progress).toBe("in_progress");
    await flush();
    expect(repo.myItems).toHaveBeenCalledTimes(2);
  });

  it("is idle without a Project, unavailable on a 404, an error otherwise", async () => {
    const idle = renderHook(() => useProjectMyItemsViewModel({ deliveryProjectId: null, enabled: true }), undefined);
    expect(idle.current().status).toBe("idle");
    act(() => root?.unmount());
    root = null;

    repo.myItems.mockRejectedValueOnce(apiErrorWith(404));
    const vm = renderHook(() => useProjectMyItemsViewModel({ deliveryProjectId: "dp-1", enabled: true }), undefined);
    await flush();
    expect(vm.current().status).toBe("unavailable");
    repo.myItems.mockRejectedValueOnce(apiErrorWith(500));
    act(() => vm.current().reload());
    await flush();
    expect(vm.current().status).toBe("error");
    expect(vm.current().error).toMatch(/could not be loaded/);
  });
});

describe("useStudioRunsViewModel", () => {
  const project: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "storefront", projectHref: null };

  function hook(scope: QaScope) {
    return renderHook(
      (p: { scope: QaScope }) => useStudioRunsViewModel({ projectId: "proj-fe", appRole: "qa", qaScope: p.scope, branch: "uat" }),
      { scope },
    );
  }

  it("uses the Project run for a repository filed under a Project, and loads no repository run", async () => {
    repo.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire() }));
    legacy.promotion.mockResolvedValue(promotionWire());
    const vm = hook(project);
    await flush();
    expect(vm.current().projectMode).toBe(true);
    expect(vm.current().status).toBe("ready");
    expect(legacy.current).not.toHaveBeenCalled();
    // The tab bar's Merge to main needs the Project's delivery.
    expect(iterations.current).toHaveBeenCalledWith("dp-1");
  });

  it("falls back to the repository run when the server has no Project runs", async () => {
    repo.current.mockRejectedValue(apiErrorWith(404));
    legacy.promotion.mockResolvedValue(promotionWire());
    const vm = hook(project);
    await flush();
    expect(vm.current().projectMode).toBe(false);
    expect(vm.current().status).toBe("unavailable");
    expect(vm.current().delivery.canMergeAll).toBe(false);
  });

  it("waits while the repository's Project is read, then keeps repository runs when it has none", async () => {
    legacy.promotion.mockResolvedValue(promotionWire());
    const vm = hook({ kind: "pending" });
    await flush();
    expect(vm.current().projectMode).toBe(false);
    expect(vm.current().checklists.status).toBe("loading");
    vm.rerender({ scope: { kind: "repository" } });
    await flush();
    expect(repo.current).not.toHaveBeenCalled();
    expect(vm.current().status).toBe("idle");
    expect(iterations.current).not.toHaveBeenCalled();
  });
});
