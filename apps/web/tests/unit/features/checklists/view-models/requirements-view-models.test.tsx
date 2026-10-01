import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { requirementsRepository } from "../../../../../src/features/checklists/data/requirements-repository";
import { normalizeRequirement, normalizeRequirementItem } from "../../../../../src/features/checklists/model/requirement-rules";
import type { Requirement } from "../../../../../src/features/checklists/model/requirement-types";
import { normalizeProjectRequirements } from "../../../../../src/features/checklists/model/requirement-rules";
import { useProjectRequirementsViewModel } from "../../../../../src/features/checklists/requirements/view-models/use-project-requirements-view-model";
import { useRequirementDialogViewModel } from "../../../../../src/features/checklists/requirements/view-models/use-requirement-dialog-view-model";
import { useRequirementItemsViewModel } from "../../../../../src/features/checklists/requirements/view-models/use-requirement-items-view-model";
import { useItemProgressViewModel } from "../../../../../src/features/checklists/returned/view-models/use-item-progress-view-model";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { apiErrorWith } from "../qa-promotion-fixtures";
import { itemWire, projectRequirementsWire, requirementWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/requirements-repository", () => ({
  requirementsRepository: {
    listForProject: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    reorderItems: jest.fn(),
    setProgress: jest.fn(),
    countsByProject: jest.fn(),
  },
}));

const repo = requirementsRepository as jest.Mocked<typeof requirementsRepository>;

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
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function requirement(overrides = {}): Requirement {
  return normalizeRequirement(requirementWire(overrides))!;
}

describe("useProjectRequirementsViewModel", () => {
  type Props = { dp: string; role: AppRole; enabled?: boolean };
  const hook = (props: Props) =>
    renderHook(
      (p: Props) => useProjectRequirementsViewModel({ deliveryProjectId: p.dp, enabled: p.enabled ?? true, appRole: p.role }),
      props,
    );

  it("loads the Project's Features and System requirements with the server's permissions", async () => {
    repo.listForProject.mockResolvedValue(normalizeProjectRequirements(projectRequirementsWire({ permissions: { canManage: false, canSetProgress: true } })));
    const vm = hook({ dp: "dp-1", role: "lead" });
    expect(vm.current().status).toBe("loading");
    await flush();
    expect(vm.current().status).toBe("ready");
    expect(vm.current().functional.map((entry) => entry.id)).toEqual(["req-1"]);
    expect(vm.current().system.map((entry) => entry.id)).toEqual(["req-sys"]);
    // The server's "no" wins over the Product owner's role.
    expect(vm.current().permissions).toEqual({ canManage: false, canSetProgress: true });
  });

  it("falls back to the role when the server sends no flags, never to yes", async () => {
    repo.listForProject.mockResolvedValue(normalizeProjectRequirements({ requirements: [] }));
    const vm = hook({ dp: "dp-1", role: "qa" });
    await flush();
    expect(vm.current().permissions).toEqual({ canManage: false, canSetProgress: false });
  });

  it("folds saved requirements and items in place, and drops archived ones", async () => {
    repo.listForProject.mockResolvedValue(normalizeProjectRequirements(projectRequirementsWire()));
    const vm = hook({ dp: "dp-1", role: "lead" });
    await flush();
    act(() => vm.current().applyRequirement(requirement({ id: "req-new", name: "Wallet", createdAt: "2026-10-05T00:00:00Z" })));
    expect(vm.current().functional.map((entry) => entry.name)).toEqual(["Checkout with saved cards", "Wallet"]);
    act(() => vm.current().applyItem({ ...normalizeRequirementItem(itemWire(), "req-1")!, progress: "in_progress" }));
    expect(vm.current().functional[0].items[0].progress).toBe("in_progress");
    act(() => vm.current().removeItem("req-1", "item-2"));
    expect(vm.current().functional[0].items).toHaveLength(1);
    act(() => vm.current().applyRequirement(requirement({ archivedAt: "2026-10-02T00:00:00Z" })));
    expect(vm.current().functional.map((entry) => entry.id)).toEqual(["req-new"]);
  });

  it("separates a missing route (404) from a failure, and reloads", async () => {
    repo.listForProject.mockRejectedValueOnce(apiErrorWith(404));
    const vm = hook({ dp: "dp-1", role: "member" });
    await flush();
    expect(vm.current().status).toBe("unavailable");
    expect(vm.current().error).toMatch(/could not be found/);

    repo.listForProject.mockRejectedValueOnce(apiErrorWith(500));
    act(() => vm.current().reload());
    await flush();
    expect(vm.current().status).toBe("error");
    expect(vm.current().error).toMatch(/could not be loaded/);
  });

  it("does not load while disabled", () => {
    hook({ dp: "dp-1", role: "lead", enabled: false });
    expect(repo.listForProject).not.toHaveBeenCalled();
  });
});

describe("useRequirementDialogViewModel", () => {
  const hook = (onSaved = jest.fn()) =>
    renderHook(() => useRequirementDialogViewModel({ deliveryProjectId: "dp-1", onSaved }), undefined);

  it("validates, then creates a Feature with its first stories", async () => {
    const onSaved = jest.fn();
    const created = requirement({ id: "req-9" });
    repo.create.mockResolvedValue(created);
    const vm = hook(onSaved);
    act(() => vm.current().openCreate("functional"));
    expect(vm.current().status).toBe("editing");
    await act(async () => vm.current().submit());
    expect(vm.current().validationError).toBe("Give the Feature a name.");
    expect(repo.create).not.toHaveBeenCalled();

    act(() => vm.current().updateDraft({ name: "Wallet", stories: "Save a card\nPay with it" }));
    await act(async () => vm.current().submit());
    expect(repo.create).toHaveBeenCalledWith("dp-1", {
      kind: "functional",
      name: "Wallet",
      items: [{ title: "Save a card" }, { title: "Pay with it" }],
    });
    expect(onSaved).toHaveBeenCalledWith(created);
    expect(vm.current().status).toBe("closed");
  });

  it("edits with the version read, and closes without a write when nothing changed", async () => {
    const value = requirement();
    repo.update.mockResolvedValue(requirement({ name: "Renamed" }));
    const vm = hook();
    act(() => vm.current().openEdit(value));
    await act(async () => vm.current().submit());
    expect(repo.update).not.toHaveBeenCalled();
    expect(vm.current().status).toBe("closed");

    act(() => vm.current().openEdit(value));
    act(() => vm.current().updateDraft({ name: "Renamed" }));
    await act(async () => vm.current().submit());
    expect(repo.update).toHaveBeenCalledWith("req-1", { expectedVersion: 1, name: "Renamed" });
  });

  it("keeps the dialog open with the coded sentence when the server refuses", async () => {
    repo.create.mockRejectedValue(apiErrorWith(409, { code: "REQUIREMENT_NAME_TAKEN" }));
    const vm = hook();
    act(() => vm.current().openCreate("system"));
    act(() => vm.current().updateDraft({ name: "Security" }));
    await act(async () => vm.current().submit());
    expect(vm.current().status).toBe("editing");
    expect(vm.current().error?.message).toMatch(/already has a requirement with that name/);
  });

  it("asks before archiving, then archives", async () => {
    const onSaved = jest.fn();
    const value = requirement();
    repo.archive.mockResolvedValue(requirement({ archivedAt: "2026-10-02T00:00:00Z" }));
    const vm = hook(onSaved);
    act(() => vm.current().openArchive(value));
    expect(vm.current().status).toBe("confirm-archive");
    expect(vm.current().mode).toEqual({ kind: "edit", requirement: value });
    act(() => vm.current().close());
    expect(vm.current().status).toBe("closed");
    act(() => vm.current().openArchive(value));
    await act(async () => vm.current().confirmArchive());
    expect(repo.archive).toHaveBeenCalledWith("req-1");
    expect(onSaved).toHaveBeenCalled();
    expect(vm.current().status).toBe("closed");
  });
});

describe("useRequirementItemsViewModel", () => {
  function hook(value: Requirement, handlers = { onItem: jest.fn(), onRemoved: jest.fn(), onRequirement: jest.fn() }) {
    const vm = renderHook(
      (props: { requirement: Requirement }) =>
        useRequirementItemsViewModel({ requirement: props.requirement, itemLabel: "User story", ...handlers }),
      { requirement: value },
    );
    return { vm, handlers };
  }

  it("adds a story after validating it", async () => {
    const saved = normalizeRequirementItem(itemWire({ id: "item-3" }), "req-1")!;
    repo.addItem.mockResolvedValue(saved);
    const { vm, handlers } = hook(requirement());
    act(() => vm.current().startAdd());
    await act(async () => vm.current().submit());
    expect(vm.current().validationError).toBe("Give the user story a title.");
    act(() => vm.current().updateDraft({ title: "Pay later", acceptanceCriteria: "Given…" }));
    await act(async () => vm.current().submit());
    expect(repo.addItem).toHaveBeenCalledWith("req-1", {
      title: "Pay later",
      acceptanceCriteria: "Given…",
      verificationType: "manual",
      testIdentifier: null,
    });
    expect(handlers.onItem).toHaveBeenCalledWith(saved);
    expect(vm.current().editing).toBeNull();
  });

  it("edits a story by id with its row version, and skips an unchanged edit", async () => {
    const value = requirement();
    repo.updateItem.mockResolvedValue(value.items[0]);
    const { vm } = hook(value);
    act(() => vm.current().startEdit(value.items[0]));
    await act(async () => vm.current().submit());
    expect(repo.updateItem).not.toHaveBeenCalled();
    act(() => vm.current().startEdit(value.items[0]));
    act(() => vm.current().updateDraft({ title: "Pay with a saved card, fast" }));
    await act(async () => vm.current().submit());
    expect(repo.updateItem).toHaveBeenCalledWith("req-1", "item-1", { expectedRowVersion: 1, title: "Pay with a saved card, fast" });
  });

  it("deletes after a confirmation", async () => {
    const value = requirement();
    repo.deleteItem.mockResolvedValue(undefined);
    const { vm, handlers } = hook(value);
    act(() => vm.current().askDelete(value.items[1]));
    expect(vm.current().confirmDeleteId).toBe("item-2");
    act(() => vm.current().cancelDelete());
    expect(vm.current().confirmDeleteId).toBeNull();
    act(() => vm.current().askDelete(value.items[1]));
    await act(async () => vm.current().confirmDelete(value.items[1]));
    expect(repo.deleteItem).toHaveBeenCalledWith("req-1", "item-2");
    expect(handlers.onRemoved).toHaveBeenCalledWith("req-1", "item-2");
  });

  it("reorders with exactly the current set of ids and applies the new order", async () => {
    const value = requirement();
    repo.reorderItems.mockResolvedValue(undefined);
    const { vm, handlers } = hook(value);
    await act(async () => vm.current().move(value.items[0], -1));
    expect(repo.reorderItems).not.toHaveBeenCalled();
    await act(async () => vm.current().move(value.items[0], 1));
    expect(repo.reorderItems).toHaveBeenCalledWith("req-1", ["item-2", "item-1"]);
    expect(handlers.onRequirement.mock.calls[0][0].items.map((item: { id: string }) => item.id)).toEqual(["item-2", "item-1"]);
  });

  it("puts a failed write on its item, flagged stale when a reload fixes it", async () => {
    const value = requirement();
    repo.reorderItems.mockRejectedValue(apiErrorWith(400, { code: "REQUIREMENT_ORDER_MISMATCH" }));
    const { vm } = hook(value);
    await act(async () => vm.current().move(value.items[0], 1));
    expect(vm.current().error).toMatchObject({ itemId: "item-1", stale: true });
    expect(vm.current().status).toBe("idle");
    act(() => vm.current().dismissError());
    expect(vm.current().error).toBeNull();
  });
});

describe("useItemProgressViewModel", () => {
  it("moves Progress with the row version and says when QA was told", async () => {
    const item = normalizeRequirementItem(itemWire(), "req-1")!;
    const saved = { ...item, progress: "done" as const, rowVersion: 2 };
    repo.setProgress.mockResolvedValue({ item: saved, readyForQaNotified: true });
    const onSaved = jest.fn();
    const vm = renderHook(() => useItemProgressViewModel({ onSaved }), undefined);
    await act(async () => vm.current().setProgress(item, "done"));
    expect(repo.setProgress).toHaveBeenCalledWith(item, { progress: "done", expectedRowVersion: 1 });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(vm.current().notifiedItemId).toBe("item-1");
    expect(vm.current().status).toBe("idle");
  });

  it("sends nothing for the same value or an item without a row version", async () => {
    const item = normalizeRequirementItem(itemWire(), "req-1")!;
    const vm = renderHook(() => useItemProgressViewModel({ onSaved: jest.fn() }), undefined);
    await act(async () => vm.current().setProgress(item, "todo"));
    await act(async () => vm.current().setProgress({ ...item, rowVersion: null }, "done"));
    expect(repo.setProgress).not.toHaveBeenCalled();
  });

  it("explains a refusal on the item, never as an API object", async () => {
    const item = normalizeRequirementItem(itemWire(), "req-1")!;
    repo.setProgress.mockRejectedValue(apiErrorWith(403, { code: "PROGRESS_FORBIDDEN" }));
    const vm = renderHook(() => useItemProgressViewModel({ onSaved: jest.fn() }), undefined);
    await act(async () => vm.current().setProgress(item, "done"));
    expect(vm.current().error).toMatchObject({ itemId: "item-1", stale: false });
    expect(vm.current().error?.message).toMatch(/QA Team records Verification/);
    act(() => vm.current().dismissError());
    expect(vm.current().error).toBeNull();
  });
});
