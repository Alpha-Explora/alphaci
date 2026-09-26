import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { useQaRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-run-view-model";
import { useQaItemEditorViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-item-editor-view-model";
import { useQaSignoffViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-signoff-view-model";
import { useQaReopenViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-reopen-view-model";
import { useMyQaItemsViewModel } from "../../../../../src/features/checklists/returned/view-models/use-my-qa-items-view-model";
import { useRequestRetestViewModel } from "../../../../../src/features/checklists/returned/view-models/use-request-retest-view-model";
import { apiError } from "../checklist-fixtures";
import { qaRun, runAs, runItem } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: {
    list: jest.fn(),
    current: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    updateItem: jest.fn(),
    requestRetest: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    returnedItems: jest.fn(),
    myItems: jest.fn(),
  },
}));

const repo = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
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
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useQaRunViewModel", () => {
  it("stays idle until there is a branch and a checklist", () => {
    const vm = renderHook(() =>
      useQaRunViewModel({ projectId: "p1", branch: null, checklistId: "cl-1", enabled: true }),
    );
    expect(vm().status).toBe("idle");
    expect(repo.current).not.toHaveBeenCalled();
  });

  it("loads the current run by branch and checklist", async () => {
    repo.current.mockResolvedValue({ commitSha: "abc1234", commitSource: "deployment", run: qaRun() });
    const vm = renderHook(() =>
      useQaRunViewModel({ projectId: "p1", branch: "main", checklistId: "cl-1", enabled: true }),
    );
    expect(vm().status).toBe("loading");
    await flush();
    expect(repo.current).toHaveBeenCalledWith("p1", { branch: "main", checklistId: "cl-1" });
    expect(vm().status).toBe("ready");
    expect(vm().run?.id).toBe("run-1");
    expect(vm().commitSource).toBe("deployment");
  });

  it("starts a run with the checklist and branch only, then shows it", async () => {
    repo.current.mockResolvedValue({ commitSha: "abc1234", commitSource: "branch_head", run: null });
    repo.create.mockResolvedValue(qaRun({ commitSource: "branch_head" }));
    const vm = renderHook(() =>
      useQaRunViewModel({ projectId: "p1", branch: "main", checklistId: "cl-1", enabled: true }),
    );
    await flush();
    expect(vm().run).toBeNull();
    await act(async () => vm().start());
    expect(repo.create).toHaveBeenCalledWith("p1", { checklistId: "cl-1", branch: "main" });
    expect(vm().run?.id).toBe("run-1");
    expect(vm().status).toBe("ready");
  });

  it("shows the server's reason when a run cannot start", async () => {
    repo.current.mockResolvedValue({ commitSha: "abc1234", commitSource: "deployment", run: null });
    repo.create.mockRejectedValue(apiError(409, "No commit found for branch main"));
    const vm = renderHook(() =>
      useQaRunViewModel({ projectId: "p1", branch: "main", checklistId: "cl-1", enabled: true }),
    );
    await flush();
    await act(async () => vm().start());
    expect(vm().startError).toEqual({ message: "No commit found for branch main", stale: false });
    expect(vm().run).toBeNull();
  });

  it("reports a load failure as a display string", async () => {
    repo.current.mockRejectedValue(apiError(500));
    const vm = renderHook(() =>
      useQaRunViewModel({ projectId: "p1", branch: "main", checklistId: "cl-1", enabled: true }),
    );
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error).toMatch(/could not be loaded/);
  });
});

describe("useQaItemEditorViewModel", () => {
  const run = runAs("qa", {
    items: [
      runItem(0, { targetPersona: "qa", rowVersion: 5 }),
      runItem(1, { targetPersona: "developer" }),
    ],
  });

  function editor(onRun = jest.fn()) {
    return renderHook(() => useQaItemEditorViewModel({ projectId: "p1", run, onRun }));
  }

  it("saves a plain status the moment it is picked, with the rowVersion read", async () => {
    const next = qaRun();
    repo.updateItem.mockResolvedValue(next);
    const onRun = jest.fn();
    const vm = editor(onRun);
    await act(async () => vm().chooseStatus(run.items[0], "passed"));
    await flush();
    expect(repo.updateItem).toHaveBeenCalledWith("p1", "run-1", "ri-0", {
      expectedRowVersion: 5,
      status: "passed",
    });
    expect(onRun).toHaveBeenCalledWith(next);
  });

  it("opens the details for Failed and refuses to send it without a severity", async () => {
    const vm = editor();
    act(() => vm().chooseStatus(run.items[0], "failed"));
    expect(repo.updateItem).not.toHaveBeenCalled();
    expect(vm().openItemId).toBe("ri-0");
    expect(vm().draft?.status).toBe("failed");

    await act(async () => vm().saveDraft(run.items[0]));
    expect(repo.updateItem).not.toHaveBeenCalled();
    expect(vm().draftError).toBe("Choose a severity before marking this item Failed.");

    repo.updateItem.mockResolvedValue(qaRun());
    act(() => vm().updateDraft({ defectSeverity: "major", notes: "Broken" }));
    await act(async () => vm().saveDraft(run.items[0]));
    expect(repo.updateItem).toHaveBeenCalledWith("p1", "run-1", "ri-0", {
      expectedRowVersion: 5,
      status: "failed",
      notes: "Broken",
      defectSeverity: "major",
    });
    expect(vm().openItemId).toBeNull();
  });

  it("never sends a status the viewer may not set", async () => {
    const vm = editor();
    await act(async () => vm().chooseStatus(run.items[1], "passed"));
    expect(repo.updateItem).not.toHaveBeenCalled();
  });

  it("flags a stale rowVersion so the view can offer a reload", async () => {
    repo.updateItem.mockRejectedValue(apiError(409, "rowVersion mismatch: item was modified"));
    const vm = editor();
    await act(async () => vm().chooseStatus(run.items[0], "passed"));
    await flush();
    expect(vm().error).toEqual({
      itemId: "ri-0",
      message: "rowVersion mismatch: item was modified",
      stale: true,
    });
    expect(vm().status).toBe("idle");
  });
});

describe("useQaSignoffViewModel", () => {
  it("opens on the best verdict available and validates Conditional", async () => {
    const run = runAs("qa", {
      items: [runItem(0, { status: "failed" }), runItem(1, { status: "passed" })],
    });
    repo.signoff.mockResolvedValue(qaRun({ status: "signed_off" }));
    const onRun = jest.fn();
    const vm = renderHook(() => useQaSignoffViewModel({ projectId: "p1", run, onRun }));
    expect(vm().status).toBe("closed");
    act(() => vm().openDialog());
    expect(vm().status).toBe("editing");
    expect(vm().verdict).toBe("CONDITIONAL");

    await act(async () => vm().submit());
    expect(repo.signoff).not.toHaveBeenCalled();
    expect(vm().validationError).toMatch(/conditions/);

    act(() => vm().setConditions("Fix the copy next release"));
    await act(async () => vm().submit());
    expect(repo.signoff).toHaveBeenCalledWith("p1", "run-1", {
      verdict: "CONDITIONAL",
      conditions: "Fix the copy next release",
    });
    expect(onRun).toHaveBeenCalled();
    expect(vm().status).toBe("closed");
  });

  it("refuses Approved while items are not passed, and is unavailable without permission", async () => {
    const run = runAs("qa", { items: [runItem(0), runItem(1, { status: "passed" })] });
    const vm = renderHook(() => useQaSignoffViewModel({ projectId: "p1", run, onRun: jest.fn() }));
    act(() => vm().openDialog());
    act(() => vm().setVerdict("APPROVED"));
    await act(async () => vm().submit());
    expect(repo.signoff).not.toHaveBeenCalled();
    expect(vm().validationError).toBe("1 item is not passed yet.");

    const member = renderHook(() =>
      useQaSignoffViewModel({ projectId: "p1", run: runAs("member"), onRun: jest.fn() }),
    );
    expect(member().canSignOff).toBe(false);
    act(() => member().openDialog());
    expect(member().status).toBe("closed");
  });

  it("shows the server's 409 message as it comes", async () => {
    const run = runAs("qa", { items: [runItem(0, { status: "passed" })] });
    repo.signoff.mockRejectedValue(apiError(409, "Not every item has passed"));
    const vm = renderHook(() => useQaSignoffViewModel({ projectId: "p1", run, onRun: jest.fn() }));
    act(() => vm().openDialog());
    await act(async () => vm().submit());
    expect(vm().error?.message).toBe("Not every item has passed");
    expect(vm().status).toBe("editing");
  });
});

describe("useQaReopenViewModel", () => {
  it("reopens only a signed-off run, and only with permission", async () => {
    const signed = runAs("lead", { status: "signed_off" });
    repo.reopen.mockResolvedValue(qaRun());
    const onRun = jest.fn();
    const vm = renderHook(() => useQaReopenViewModel({ projectId: "p1", run: signed, onRun }));
    expect(vm().canReopen).toBe(true);
    await act(async () => vm().reopen());
    expect(repo.reopen).toHaveBeenCalledWith("p1", "run-1");
    expect(onRun).toHaveBeenCalled();

    const qa = renderHook(() =>
      useQaReopenViewModel({ projectId: "p1", run: runAs("qa", { status: "signed_off" }), onRun }),
    );
    expect(qa().canReopen).toBe(false);
  });
});

describe("returned items and re-test", () => {
  it("loads the items QA returned and the developer items in one read", async () => {
    repo.myItems.mockResolvedValue({
      returned: [{ runId: "run-1", branch: "uat", commitSha: "abc", checklistName: "Smoke", item: runItem(0, { status: "returned_to_dev" }) }],
      developerItems: [{ runId: "run-1", branch: "uat", commitSha: "abc", checklistName: "Smoke", item: runItem(1) }],
    });
    const vm = renderHook(() => useMyQaItemsViewModel({ projectId: "p1", enabled: true }));
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().data.returned).toHaveLength(1);
    expect(vm().data.developerItems).toHaveLength(1);
    expect(repo.returnedItems).not.toHaveBeenCalled();
  });

  it("falls back to qa-returned-items when the backend has no qa-my-items route", async () => {
    repo.myItems.mockRejectedValue(apiError(404));
    repo.returnedItems.mockResolvedValue({
      items: [{ runId: "run-1", branch: "uat", commitSha: "abc", checklistName: "Smoke", item: runItem(0) }],
    });
    const vm = renderHook(() => useMyQaItemsViewModel({ projectId: "p1", enabled: true }));
    await flush();
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().data.returned).toHaveLength(1);
    expect(vm().data.developerItems).toEqual([]);
  });

  it("shows an error, not an empty card, when the read fails for another reason", async () => {
    repo.myItems.mockRejectedValue(apiError(500));
    const vm = renderHook(() => useMyQaItemsViewModel({ projectId: "p1", enabled: true }));
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error).toBe("Your QA items could not be loaded. Try again in a moment.");
    expect(repo.returnedItems).not.toHaveBeenCalled();
  });

  it("folds a write's run into the lists without a reload", async () => {
    repo.myItems.mockResolvedValue({
      returned: [],
      developerItems: [{ runId: "run-1", branch: "uat", commitSha: "abc", checklistName: "Smoke", item: runItem(1, { canUpdate: true }) }],
    });
    const vm = renderHook(() => useMyQaItemsViewModel({ projectId: "p1", enabled: true }));
    await flush();
    act(() => vm().applyRun(qaRun({ items: [runItem(1, { status: "passed", rowVersion: 2 })] })));
    expect(vm().data.developerItems[0].item.status).toBe("passed");
    expect(vm().data.developerItems[0].item.rowVersion).toBe(2);
    expect(repo.myItems).toHaveBeenCalledTimes(1);
  });

  it("does not load while the capability is off", () => {
    renderHook(() => useMyQaItemsViewModel({ projectId: "p1", enabled: false }));
    expect(repo.myItems).not.toHaveBeenCalled();
    expect(repo.returnedItems).not.toHaveBeenCalled();
  });

  it("requests a re-test with the trimmed note, then hands back the run", async () => {
    repo.requestRetest.mockResolvedValue(qaRun());
    const onDone = jest.fn();
    const vm = renderHook(() => useRequestRetestViewModel({ projectId: "p1", onDone }));
    const target = { runId: "run-1", itemId: "ri-0" };
    act(() => vm().open(target));
    expect(vm().openKey).toBe("run-1:ri-0");
    act(() => vm().setNote("  fixed in #12 "));
    await act(async () => vm().submit(target));
    expect(repo.requestRetest).toHaveBeenCalledWith("p1", "run-1", "ri-0", "fixed in #12");
    expect(onDone).toHaveBeenCalled();
    expect(vm().status).toBe("closed");
  });

  it("keeps the form open with the reason when the request fails", async () => {
    repo.requestRetest.mockRejectedValue(apiError(403));
    const vm = renderHook(() => useRequestRetestViewModel({ projectId: "p1", onDone: jest.fn() }));
    const target = { runId: "run-1", itemId: "ri-0" };
    act(() => vm().open(target));
    await act(async () => vm().submit(target));
    expect(vm().error?.message).toBe("Your role cannot make this change.");
    expect(vm().status).toBe("editing");
  });
});
