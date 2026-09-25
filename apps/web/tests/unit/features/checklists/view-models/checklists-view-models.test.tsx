import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { STALE_CHECKLIST_MESSAGE } from "../../../../../src/features/checklists/model/checklist-rules";
import type { QaChecklist } from "../../../../../src/features/checklists/model/checklist-types";
import {
  useWorkspaceChecklistsViewModel,
  type WorkspaceChecklistsViewModel,
} from "../../../../../src/features/checklists/manage/view-models/use-workspace-checklists-view-model";
import {
  useChecklistEditorViewModel,
  type ChecklistEditorViewModel,
} from "../../../../../src/features/checklists/manage/view-models/use-checklist-editor-view-model";
import {
  useShareChecklistViewModel,
  type ShareChecklistViewModel,
} from "../../../../../src/features/checklists/manage/view-models/use-share-checklist-view-model";
import {
  useArchiveChecklistViewModel,
  type ArchiveChecklistViewModel,
} from "../../../../../src/features/checklists/manage/view-models/use-archive-checklist-view-model";
import {
  useProjectChecklistsViewModel,
  type ProjectChecklistsViewModel,
} from "../../../../../src/features/checklists/project/view-models/use-project-checklists-view-model";
import { apiError, checklist } from "../checklist-fixtures";

jest.mock("../../../../../src/features/checklists/data/checklists-repository", () => ({
  checklistsRepository: {
    listForWorkspace: jest.fn(),
    listForProject: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    replaceItems: jest.fn(),
    archive: jest.fn(),
    share: jest.fn(),
  },
}));

const repo = checklistsRepository as jest.Mocked<typeof checklistsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

/** Render a hook and hand back a getter for its latest value. */
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

describe("useWorkspaceChecklistsViewModel", () => {
  it("loads the team's checklists and reports canManage from the server", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: true });
    const vm = renderHook<WorkspaceChecklistsViewModel>(() =>
      useWorkspaceChecklistsViewModel({ workspaceId: "ws-1", enabled: true }),
    );
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().checklists).toHaveLength(1);
    expect(vm().canManage).toBe(true);
    expect(repo.listForWorkspace).toHaveBeenCalledWith("ws-1", { includeArchived: false });
  });

  it("surfaces a display string when the list fails", async () => {
    repo.listForWorkspace.mockRejectedValue(apiError(500));
    const vm = renderHook(() => useWorkspaceChecklistsViewModel({ workspaceId: "ws-1", enabled: true }));
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error).toMatch(/could not be loaded/);
  });

  it("opens a deep-linked checklist, and falls back to the list when it is not there", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: false });
    const vm = renderHook(() =>
      useWorkspaceChecklistsViewModel({ workspaceId: "ws-1", enabled: true, initialChecklistId: "cl-1" }),
    );
    await flush();
    expect(vm().screen).toEqual({ kind: "view", checklistId: "cl-1" });
    expect(vm().selected?.id).toBe("cl-1");

    act(() => vm().openChecklist("missing"));
    expect(vm().screen).toEqual({ kind: "list" });
  });

  it("never lets a reader onto the create or edit screens", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: false });
    const vm = renderHook(() => useWorkspaceChecklistsViewModel({ workspaceId: "ws-1", enabled: true }));
    await flush();
    act(() => vm().startCreate());
    expect(vm().screen.kind).toBe("list");
    act(() => vm().editChecklist("cl-1"));
    expect(vm().screen).toEqual({ kind: "view", checklistId: "cl-1" });
  });

  it("keeps the list in step with saves, shares and archives", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: true });
    const vm = renderHook(() => useWorkspaceChecklistsViewModel({ workspaceId: "ws-1", enabled: true }));
    await flush();

    act(() => vm().applySaved(checklist({ id: "cl-2", name: "New one" })));
    expect(vm().checklists.map((item) => item.id)).toContain("cl-2");
    expect(vm().screen).toEqual({ kind: "view", checklistId: "cl-2" });

    act(() => vm().applyShared(checklist({ id: "cl-2", sharedProjectIds: ["p1", "p2"] })));
    expect(vm().selected?.sharedProjectIds).toEqual(["p1", "p2"]);

    act(() => vm().applyArchived(checklist({ id: "cl-2", archivedAt: "2026-09-25T00:00:00.000Z" })));
    expect(vm().checklists.map((item) => item.id)).toEqual(["cl-1"]);
    expect(vm().screen.kind).toBe("list");
  });

  it("re-reads with archived checklists when asked", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [], canManage: true });
    const vm = renderHook(() => useWorkspaceChecklistsViewModel({ workspaceId: "ws-1", enabled: true }));
    await flush();
    act(() => vm().setShowArchived(true));
    expect(vm().status).toBe("loading");
    await flush();
    expect(repo.listForWorkspace).toHaveBeenLastCalledWith("ws-1", { includeArchived: true });
    expect(vm().status).toBe("ready");
  });
});

describe("useChecklistEditorViewModel", () => {
  it("holds validation back until the first save, then blocks an invalid draft", async () => {
    const onSaved = jest.fn();
    const vm = renderHook<ChecklistEditorViewModel>(() =>
      useChecklistEditorViewModel({ workspaceId: "ws-1", checklist: null, onSaved }),
    );
    act(() => vm().addItem());
    expect(vm().validation.valid).toBe(true);
    await act(async () => vm().save());
    expect(vm().validation.nameError).not.toBeNull();
    expect(Object.keys(vm().validation.itemErrors)).toHaveLength(1);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates a checklist with its ordered items", async () => {
    const created = checklist({ id: "cl-new" });
    repo.create.mockResolvedValue(created);
    const onSaved = jest.fn();
    const vm = renderHook(() =>
      useChecklistEditorViewModel({ workspaceId: "ws-1", checklist: null, onSaved }),
    );
    act(() => vm().setName("Smoke"));
    act(() => vm().addItem());
    act(() => vm().addItem());
    const [first, second] = vm().draft.items;
    act(() => vm().updateItem(first.key, { title: "First" }));
    act(() => vm().updateItem(second.key, { title: "Second", verificationType: "unit_test", testIdentifier: "a.test.ts" }));
    act(() => vm().moveItem(1, -1));
    await act(async () => vm().save());

    expect(repo.create).toHaveBeenCalledWith("ws-1", {
      name: "Smoke",
      description: null,
      items: [
        { title: "Second", description: null, targetPersona: "all", verificationType: "unit_test", testIdentifier: "a.test.ts" },
        { title: "First", description: null, targetPersona: "all", verificationType: "manual", testIdentifier: null },
      ],
    });
    expect(onSaved).toHaveBeenCalledWith(created);
    expect(vm().status).toBe("ready");
  });

  it("writes only the half that changed, carrying the version forward", async () => {
    const saved = checklist({ version: 3 });
    repo.update.mockResolvedValue({ ...saved, name: "Renamed", version: 4 });
    repo.replaceItems.mockResolvedValue({ ...saved, name: "Renamed", version: 5, items: [] });
    const onSaved = jest.fn();
    const vm = renderHook(() =>
      useChecklistEditorViewModel({ workspaceId: "ws-1", checklist: saved, onSaved }),
    );
    expect(vm().dirty).toBe(false);
    act(() => vm().setName("Renamed"));
    act(() => vm().removeItem(vm().draft.items[1].key));
    expect(vm().dirty).toBe(true);
    await act(async () => vm().save());

    expect(repo.update).toHaveBeenCalledWith("cl-1", {
      expectedVersion: 3,
      name: "Renamed",
      description: "Before every promotion.",
    });
    expect(repo.replaceItems).toHaveBeenCalledWith("cl-1", 4, [
      expect.objectContaining({ title: "Checkout works" }),
    ]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 5 }));
  });

  it("reports a stale version as a reloadable conflict", async () => {
    repo.update.mockRejectedValue(apiError(409, "version mismatch"));
    const vm = renderHook(() =>
      useChecklistEditorViewModel({ workspaceId: "ws-1", checklist: checklist(), onSaved: jest.fn() }),
    );
    act(() => vm().setName("Other"));
    await act(async () => vm().save());
    expect(vm().status).toBe("error");
    expect(vm().stale).toBe(true);
    expect(vm().error).toBe(STALE_CHECKLIST_MESSAGE);
  });
});

describe("useShareChecklistViewModel", () => {
  it("seeds from the checklist on open and saves the new set", async () => {
    const shared: QaChecklist = checklist({ sharedProjectIds: ["project-1", "project-2"] });
    repo.share.mockResolvedValue(shared);
    const onShared = jest.fn();
    const vm = renderHook<ShareChecklistViewModel>(() =>
      useShareChecklistViewModel({ checklist: checklist(), onShared }),
    );
    act(() => vm().openDialog());
    expect(vm().selectedIds).toEqual(["project-1"]);
    expect(vm().dirty).toBe(false);
    act(() => vm().toggle("project-2"));
    expect(vm().dirty).toBe(true);
    await act(async () => vm().submit());
    expect(repo.share).toHaveBeenCalledWith("cl-1", ["project-1", "project-2"]);
    expect(onShared).toHaveBeenCalledWith(shared);
    expect(vm().open).toBe(false);
  });

  it("keeps the dialog open with a message when sharing fails", async () => {
    repo.share.mockRejectedValue(apiError(403));
    const vm = renderHook(() => useShareChecklistViewModel({ checklist: checklist(), onShared: jest.fn() }));
    act(() => vm().openDialog());
    act(() => vm().setAll([]));
    await act(async () => vm().submit());
    expect(vm().status).toBe("error");
    expect(vm().open).toBe(true);
    expect(vm().error).toMatch(/team leads/);
  });
});

describe("useArchiveChecklistViewModel", () => {
  it("archives and closes", async () => {
    const archived = checklist({ archivedAt: "2026-09-25T00:00:00.000Z" });
    repo.archive.mockResolvedValue(archived);
    const onArchived = jest.fn();
    const vm = renderHook<ArchiveChecklistViewModel>(() =>
      useArchiveChecklistViewModel({ checklist: checklist(), onArchived }),
    );
    act(() => vm().openDialog());
    await act(async () => vm().confirm());
    expect(onArchived).toHaveBeenCalledWith(archived);
    expect(vm().open).toBe(false);
  });

  it("explains a failed archive", async () => {
    repo.archive.mockRejectedValue(apiError(409, "already archived"));
    const vm = renderHook(() => useArchiveChecklistViewModel({ checklist: checklist(), onArchived: jest.fn() }));
    act(() => vm().openDialog());
    await act(async () => vm().confirm());
    expect(vm().status).toBe("error");
    expect(vm().error).toMatch(/archived/);
    act(() => vm().closeDialog());
    expect(vm().open).toBe(false);
  });
});

describe("useProjectChecklistsViewModel", () => {
  it("loads the checklists shared to a project", async () => {
    repo.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
    const vm = renderHook<ProjectChecklistsViewModel>(() =>
      useProjectChecklistsViewModel({ projectId: "project-1", enabled: true }),
    );
    expect(vm().status).toBe("loading");
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().checklists).toHaveLength(1);
    expect(vm().canManage).toBe(false);
  });

  it("reports an error and retries on reload", async () => {
    repo.listForProject.mockRejectedValueOnce(apiError(404));
    repo.listForProject.mockResolvedValueOnce({ items: [], canManage: true });
    const vm = renderHook(() => useProjectChecklistsViewModel({ projectId: "project-1", enabled: true }));
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error).toMatch(/no longer exists/);
    act(() => vm().reload());
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().canManage).toBe(true);
  });

  it("does not fetch while disabled", () => {
    renderHook(() => useProjectChecklistsViewModel({ projectId: "project-1", enabled: false }));
    expect(repo.listForProject).not.toHaveBeenCalled();
  });
});
