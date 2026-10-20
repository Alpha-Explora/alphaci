import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { useDeveloperItemEditorViewModel } from "../../../../../src/features/checklists/returned/view-models/use-developer-item-editor-view-model";
import { useQaPromotionViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-promotion-view-model";
import type { QaDeveloperItem } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { apiErrorWith, HEAD_SHA, promotionWire, readyWire } from "../qa-promotion-fixtures";
import { qaRun, runItem } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: {
    promotion: jest.fn(),
    mergePromotion: jest.fn(),
    updateItem: jest.fn(),
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

/** Renders a hook; `rerender` re-renders it with new props. */
function renderHook<P, T>(useHook: (props: P) => T, initial: P) {
  let latest: T | undefined;
  // Recorded through a prop so the component never reassigns an outer variable.
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
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

type PromotionProps = { role: AppRole; watch: string | null; enabled?: boolean };

function promotionHook(props: PromotionProps) {
  return renderHook(
    (p: PromotionProps) =>
      useQaPromotionViewModel({ projectId: "p1", enabled: p.enabled ?? true, appRole: p.role, watch: p.watch }),
    props,
  );
}

describe("useQaPromotionViewModel — status", () => {
  it("loads and normalises the status; a lead the server allows is offered a disabled button with the reason", async () => {
    repo.promotion.mockResolvedValue(promotionWire());
    const vm = promotionHook({ role: "lead", watch: null });
    expect(vm.current().status).toBe("loading");
    await flush();
    expect(vm.current().status).toBe("ready");
    expect(vm.current().data?.checklists).toHaveLength(2);
    expect(vm.current().canMerge).toBe(true);
    expect(vm.current().disabledReason).toBe(
      "Merging opens once every shared checklist is signed off Approved on uat @ 9f8e7d6.",
    );
  });

  it("offers QA Team no button even if the server said canMerge", async () => {
    repo.promotion.mockResolvedValue(readyWire());
    const vm = promotionHook({ role: "qa", watch: null });
    await flush();
    expect(vm.current().canMerge).toBe(false);
  });

  it("treats a backend without the route (404) as no card, and a failure as an error to retry", async () => {
    repo.promotion.mockRejectedValue(apiErrorWith(404));
    const missing = promotionHook({ role: "lead", watch: null });
    await flush();
    expect(missing.current().status).toBe("unavailable");

    repo.promotion.mockRejectedValue(apiErrorWith(500));
    const failing = promotionHook({ role: "lead", watch: null });
    await flush();
    expect(failing.current().status).toBe("error");
    expect(failing.current().error).toBe("Production readiness could not be loaded. Try again in a moment.");
  });

  it("does not load while disabled", () => {
    promotionHook({ role: "lead", watch: null, enabled: false });
    expect(repo.promotion).not.toHaveBeenCalled();
  });

  it("re-reads when the watched run is signed off or reopened, but not when a run first appears", async () => {
    repo.promotion.mockResolvedValue(promotionWire());
    const vm = promotionHook({ role: "lead", watch: null });
    await flush();
    expect(repo.promotion).toHaveBeenCalledTimes(1);
    vm.rerender({ role: "lead", watch: "run-1|open|" });
    await flush();
    expect(repo.promotion).toHaveBeenCalledTimes(1);
    repo.promotion.mockResolvedValue(readyWire());
    vm.rerender({ role: "lead", watch: "run-1|signed_off|signoff-1" });
    await flush();
    expect(repo.promotion).toHaveBeenCalledTimes(2);
    expect(vm.current().data?.eligible).toBe(true);
    vm.rerender({ role: "lead", watch: "run-1|open|" });
    await flush();
    expect(repo.promotion).toHaveBeenCalledTimes(3);
  });
});

describe("useQaPromotionViewModel — merge", () => {
  async function readyLead() {
    repo.promotion.mockResolvedValue(readyWire());
    const vm = promotionHook({ role: "lead", watch: null });
    await flush();
    act(() => vm.current().openConfirm());
    expect(vm.current().mergeState).toBe("confirming");
    return vm;
  }

  it("will not open the confirmation while not eligible", async () => {
    repo.promotion.mockResolvedValue(promotionWire());
    const vm = promotionHook({ role: "lead", watch: null });
    await flush();
    act(() => vm.current().openConfirm());
    expect(vm.current().mergeState).toBe("idle");
    await act(async () => vm.current().confirmMerge());
    expect(repo.mergePromotion).not.toHaveBeenCalled();
  });

  it("merged: shows the merge commit, refreshes the status, and does not offer the same head again", async () => {
    const vm = await readyLead();
    let resolve!: (value: unknown) => void;
    repo.mergePromotion.mockReturnValue(new Promise((r) => (resolve = r)) as never);
    let pending!: Promise<void>;
    act(() => {
      pending = vm.current().confirmMerge();
    });
    expect(vm.current().mergeState).toBe("merging");
    await act(async () => {
      resolve({ merged: true, sha: "5555555abcdef", message: "Pull Request successfully merged", pullRequest: { number: 42, url: "https://github.com/t/s/pull/42" } });
      await pending;
    });
    await flush();
    expect(vm.current().mergeState).toBe("idle");
    expect(vm.current().outcome).toEqual({
      kind: "merged",
      headSha: HEAD_SHA,
      result: { merged: true, sha: "5555555abcdef", message: "Pull Request successfully merged", pullRequest: { number: 42, url: "https://github.com/t/s/pull/42" }, alreadyInMain: false },
    });
    expect(repo.promotion).toHaveBeenCalledTimes(2);
    expect(vm.current().disabledReason).toBe("uat @ 9f8e7d6 is already merged into main.");
  });

  it("refused: keeps GitHub's words verbatim and refreshes", async () => {
    const vm = await readyLead();
    repo.mergePromotion.mockResolvedValue({ merged: false, sha: null, message: "At least 1 approving review is required by reviewers with write access.", pullRequest: { number: 42, url: "https://github.com/t/s/pull/42" } });
    await act(async () => vm.current().confirmMerge());
    await flush();
    const outcome = vm.current().outcome;
    expect(outcome?.kind).toBe("refused");
    expect(outcome?.kind === "refused" && outcome.result.message).toBe("At least 1 approving review is required by reviewers with write access.");
    expect(vm.current().mergeState).toBe("idle");
    expect(repo.promotion).toHaveBeenCalledTimes(2);
    // Not merged, so the button stays available to try again once GitHub allows it.
    expect(vm.current().disabledReason).toBeNull();
  });

  it.each([
    ["QA_UAT_MOVED", "moved", true],
    ["QA_PROMOTION_BLOCKED", "blocked", true],
    ["GITHUB_REAUTH", "reauth", false],
  ])("%s closes the dialog with the explanation (refresh: %s)", async (code, kind, refreshes) => {
    const vm = await readyLead();
    repo.mergePromotion.mockRejectedValue(apiErrorWith(409, { code, message: "server says", reasons: ["Smoke moved"] }));
    await act(async () => vm.current().confirmMerge());
    await flush();
    const outcome = vm.current().outcome;
    expect(outcome?.kind).toBe("error");
    expect(outcome?.kind === "error" && outcome.error.kind).toBe(kind);
    expect(vm.current().mergeState).toBe("idle");
    expect(repo.promotion).toHaveBeenCalledTimes(refreshes ? 2 : 1);
    expect(vm.current().signInHref).toBe("/login?next=/projects/p1");
  });

  it("a transient failure stays in the dialog to retry", async () => {
    const vm = await readyLead();
    repo.mergePromotion.mockRejectedValue(new Error("network down"));
    await act(async () => vm.current().confirmMerge());
    expect(vm.current().mergeState).toBe("confirming");
    expect(vm.current().dialogError).toBe("The merge could not be completed. Try again in a moment.");
    expect(vm.current().outcome).toBeNull();
    act(() => vm.current().cancelConfirm());
    expect(vm.current().mergeState).toBe("idle");
    expect(vm.current().dialogError).toBeNull();
  });
});

describe("useDeveloperItemEditorViewModel", () => {
  const entry: QaDeveloperItem = {
    runId: "run-1",
    branch: "uat",
    commitSha: "9f8e7d6",
    checklistName: "Smoke",
    item: runItem(1, { targetPersona: "developer", rowVersion: 3, canUpdate: true }),
  };

  function editorHook(onRun = jest.fn()) {
    return { vm: renderHook(() => useDeveloperItemEditorViewModel({ projectId: "p1", onRun }), undefined), onRun };
  }

  it("never offers or sends Returned to dev", async () => {
    const { vm } = editorHook();
    expect(vm.current().allowedStatuses(entry)).not.toContain("returned_to_dev");
    act(() => vm.current().chooseStatus(entry, "returned_to_dev"));
    expect(repo.updateItem).not.toHaveBeenCalled();
    expect(vm.current().openKey).toBeNull();
  });

  it("saves a plain status at once, with the row version read, and hands back the run", async () => {
    const run = qaRun({ items: [runItem(1, { status: "passed", rowVersion: 4 })] });
    repo.updateItem.mockResolvedValue(run);
    const { vm, onRun } = editorHook();
    await act(async () => vm.current().chooseStatus(entry, "passed"));
    await flush();
    expect(repo.updateItem).toHaveBeenCalledWith("p1", "run-1", "ri-1", { expectedRowVersion: 3, status: "passed" });
    expect(onRun).toHaveBeenCalledWith(run);
  });

  it("Failed opens the details form and refuses to send without a severity", async () => {
    repo.updateItem.mockResolvedValue(qaRun());
    const { vm } = editorHook();
    act(() => vm.current().chooseStatus(entry, "failed"));
    expect(vm.current().openKey).toBe("run-1:ri-1");
    expect(vm.current().draft?.status).toBe("failed");
    await act(async () => vm.current().saveDraft(entry));
    expect(vm.current().draftError).toBe("Choose a severity before marking this item Failed.");
    expect(repo.updateItem).not.toHaveBeenCalled();
    act(() => vm.current().updateDraft({ defectSeverity: "minor", notes: " totals off by 1 " }));
    await act(async () => vm.current().saveDraft(entry));
    expect(repo.updateItem).toHaveBeenCalledWith("p1", "run-1", "ri-1", {
      expectedRowVersion: 3,
      status: "failed",
      notes: "totals off by 1",
      defectSeverity: "minor",
    });
  });

  it("flags a stale row version so the card can offer a reload", async () => {
    repo.updateItem.mockRejectedValue(apiErrorWith(409, { code: "QA_ITEM_STALE", message: "This item has changed" }));
    const { vm } = editorHook();
    await act(async () => vm.current().chooseStatus(entry, "passed"));
    await flush();
    expect(vm.current().error).toMatchObject({ key: "run-1:ri-1", stale: true });
  });

  it("does nothing for an item the server did not give this viewer", async () => {
    const { vm } = editorHook();
    const theirs = { ...entry, item: { ...entry.item, canUpdate: false } };
    expect(vm.current().allowedStatuses(theirs)).toEqual([]);
    act(() => vm.current().chooseStatus(theirs, "passed"));
    expect(repo.updateItem).not.toHaveBeenCalled();
  });
});
