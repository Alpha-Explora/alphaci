import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectFoldersRepository } from "../../../../../../src/features/teams/project-folders/data/project-folders-repository";
import { MOVE_CONFLICT_MESSAGE } from "../../../../../../src/features/teams/project-folders/model/project-folder-rules";
import { useProjectFoldersViewModel } from "../../../../../../src/features/teams/project-folders/view-models/use-project-folders-view-model";
import { useMoveRepositoryViewModel } from "../../../../../../src/features/teams/project-folders/view-models/use-move-repository-view-model";
import { useFolderChecklistsViewModel } from "../../../../../../src/features/teams/project-folders/view-models/use-folder-checklists-view-model";
import { useCreateProjectFolderViewModel } from "../../../../../../src/features/teams/project-folders/view-models/use-create-project-folder-view-model";
import { apiError, folderChecklist, foldersSnapshot, GROUP_ID } from "../folder-fixtures";

jest.mock("../../../../../../src/features/teams/project-folders/data/project-folders-repository", () => ({
  projectFoldersRepository: {
    list: jest.fn(),
    create: jest.fn(),
    moveRepository: jest.fn(),
    archive: jest.fn(),
    listChecklists: jest.fn(),
    updateChecklistShares: jest.fn(),
  },
}));

const mockSession = { appRole: "lead" as string | undefined };
jest.mock("../../../../../../src/features/auth/session", () => ({
  useAuthSession: () => ({ session: { appRole: mockSession.appRole } }),
}));

const repo = projectFoldersRepository as jest.Mocked<typeof projectFoldersRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
  mockSession.appRole = "lead";
});

function renderHook<T>(useHook: () => T): () => T {
  let latest: T | undefined;
  function Probe({ onRender }: { onRender: (value: T) => void }) {
    onRender(useHook());
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <Probe
        onRender={(value) => {
          latest = value;
        }}
      />,
    ),
  );
  return () => latest as T;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useProjectFoldersViewModel", () => {
  it("loads the team's Projects and checklists", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([folderChecklist()]);
    const vm = renderHook(() =>
      useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "Checkout", qaChecklistsEnabled: true }),
    );
    expect(vm().status).toBe("loading");
    expect(vm().count).toBeNull();
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().count).toBe(2);
    expect(vm().unfiled).toHaveLength(1);
    expect(vm().canManage).toBe(true);
    expect(vm().canCreateRepository).toBe(true);
    expect(vm().canVerifyInQaStudio).toBe(true);
    expect(vm().checklists).toEqual([folderChecklist()]);
    expect(repo.list).toHaveBeenCalledWith(GROUP_ID);
    expect(repo.listChecklists).toHaveBeenCalledWith(GROUP_ID);

    act(() => vm().openFolder("dp-1"));
    expect(vm().selected?.name).toBe("testfinals");
    act(() => vm().closeFolder());
    expect(vm().selected).toBeNull();
  });

  it("never asks for checklists when the capability is off", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    mockSession.appRole = "qa";
    const vm = renderHook(() =>
      useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "Checkout", qaChecklistsEnabled: false }),
    );
    await flush();
    expect(repo.listChecklists).not.toHaveBeenCalled();
    expect(vm().checklists).toBeNull();
    expect(vm().canVerifyInQaStudio).toBe(false);
    expect(vm().canCreateRepository).toBe(false);
  });

  it("gives QA Team QA Studio but not a Developer", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([]);
    mockSession.appRole = "qa";
    let vm = renderHook(() =>
      useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "C", qaChecklistsEnabled: true }),
    );
    await flush();
    expect(vm().canVerifyInQaStudio).toBe(true);
    act(() => root?.unmount());
    mockSession.appRole = "member";
    vm = renderHook(() => useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "C", qaChecklistsEnabled: true }));
    await flush();
    expect(vm().canVerifyInQaStudio).toBe(false);
  });

  it("reports a display string when the load fails, and recovers on reload", async () => {
    repo.list.mockRejectedValueOnce(apiError(404));
    const vm = renderHook(() =>
      useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "C", qaChecklistsEnabled: false }),
    );
    await flush();
    expect(vm().status).toBe("error");
    expect(vm().error).toBe("This team's Projects are not available.");

    repo.list.mockResolvedValueOnce(foldersSnapshot());
    act(() => vm().reload());
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().error).toBeNull();
  });

  it("keeps the Projects usable when only the checklist read fails", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockRejectedValue(apiError(500));
    const vm = renderHook(() =>
      useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "C", qaChecklistsEnabled: true }),
    );
    await flush();
    expect(vm().status).toBe("ready");
    expect(vm().checklists).toEqual([]);
  });

  it("merges a saved checklist in place", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([folderChecklist(), folderChecklist({ id: "cl-2" })]);
    const vm = renderHook(() =>
      useProjectFoldersViewModel({ groupId: GROUP_ID, groupName: "C", qaChecklistsEnabled: true }),
    );
    await flush();
    act(() => vm().applyChecklist(folderChecklist({ sharedProjectIds: [] })));
    expect(vm().checklists?.[0].sharedProjectIds).toEqual([]);
    expect(vm().checklists?.[1].id).toBe("cl-2");
  });
});

describe("useMoveRepositoryViewModel", () => {
  const { folders } = foldersSnapshot();
  const source = folders[0];
  const repository = source.repositories[0];

  it("moves, refetches, and reports an emptied source Project", async () => {
    repo.moveRepository.mockResolvedValue({ moved: true, sourceDeliveryProjectId: "dp-1", sourceDeliveryProjectEmpty: true });
    repo.archive.mockResolvedValue(undefined);
    const onChanged = jest.fn();
    const vm = renderHook(() => useMoveRepositoryViewModel({ onChanged }));
    act(() => vm().openFor(repository, source));
    expect(vm().repository?.repositoryId).toBe("repo-fe");
    await act(async () => vm().submit(folders));
    expect(repo.moveRepository).not.toHaveBeenCalled(); // no target picked yet

    act(() => vm().setTargetId("dp-2"));
    await act(async () => vm().submit(folders));
    expect(repo.moveRepository).toHaveBeenCalledWith("repo-fe", "dp-2");
    expect(vm().repository).toBeNull();
    expect(vm().notice).toEqual({
      text: "Moved testfinals-frontend to wallet.",
      emptied: { deliveryProjectId: "dp-1", name: "testfinals" },
    });
    expect(onChanged).toHaveBeenCalledTimes(1);

    await act(async () => vm().archiveEmptied());
    expect(repo.archive).toHaveBeenCalledWith("dp-1");
    expect(vm().notice).toEqual({ text: "Archived testfinals.", emptied: null });
    expect(onChanged).toHaveBeenCalledTimes(2);

    act(() => vm().dismissNotice());
    expect(vm().notice).toBeNull();
  });

  it("explains a concurrent move (409) and refetches", async () => {
    repo.moveRepository.mockRejectedValue(apiError(409));
    const onChanged = jest.fn();
    const vm = renderHook(() => useMoveRepositoryViewModel({ onChanged }));
    act(() => vm().openFor(repository, source));
    act(() => vm().setTargetId("dp-2"));
    await act(async () => vm().submit(folders));
    expect(vm().status).toBe("error");
    expect(vm().error).toBe(MOVE_CONFLICT_MESSAGE);
    expect(vm().repository).not.toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open without refetching on other failures", async () => {
    repo.moveRepository.mockRejectedValue(apiError(400));
    const onChanged = jest.fn();
    const vm = renderHook(() => useMoveRepositoryViewModel({ onChanged }));
    act(() => vm().openFor(repository, source));
    act(() => vm().setTargetId("dp-2"));
    await act(async () => vm().submit(folders));
    expect(vm().error).toMatch(/Archived/);
    expect(onChanged).not.toHaveBeenCalled();
    act(() => vm().close());
    expect(vm().repository).toBeNull();
  });
});

describe("useFolderChecklistsViewModel", () => {
  const folder = foldersSnapshot().folders[0];

  it("attaches with PATCH add of every folder project", async () => {
    const saved = folderChecklist();
    repo.updateChecklistShares.mockResolvedValue(saved);
    const onSaved = jest.fn();
    const vm = renderHook(() => useFolderChecklistsViewModel({ folder, onSaved }));
    await act(async () => vm().attach(folderChecklist({ sharedProjectIds: ["elsewhere"] })));
    expect(repo.updateChecklistShares).toHaveBeenCalledWith("cl-1", { add: ["proj-fe", "proj-be"] });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(vm().status).toBe("idle");
  });

  it("detaches with PATCH remove of exactly the folder projects", async () => {
    repo.updateChecklistShares.mockResolvedValue(folderChecklist({ sharedProjectIds: ["elsewhere"] }));
    const vm = renderHook(() => useFolderChecklistsViewModel({ folder, onSaved: jest.fn() }));
    await act(async () => vm().detach(folderChecklist()));
    expect(repo.updateChecklistShares).toHaveBeenCalledWith("cl-1", { remove: ["proj-fe", "proj-be"] });
  });

  it("reports a failed attach as a display string", async () => {
    repo.updateChecklistShares.mockRejectedValue(apiError(403));
    const onSaved = jest.fn();
    const vm = renderHook(() => useFolderChecklistsViewModel({ folder, onSaved }));
    await act(async () => vm().attach(folderChecklist()));
    expect(vm().status).toBe("error");
    expect(vm().error).toMatch(/Team lead/);
    expect(vm().pendingId).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("useCreateProjectFolderViewModel", () => {
  it("validates, creates, closes and tells the explorer", async () => {
    repo.create.mockResolvedValue(undefined);
    const onCreated = jest.fn();
    const vm = renderHook(() => useCreateProjectFolderViewModel({ groupId: GROUP_ID, onCreated }));
    act(() => vm().openDialog());
    expect(vm().open).toBe(true);
    expect(vm().canSubmit).toBe(false);
    await act(async () => vm().submit());
    expect(vm().error).toMatch(/name/);
    expect(repo.create).not.toHaveBeenCalled();

    act(() => vm().setName("  checkout  "));
    act(() => vm().setDescription("  Pay flows "));
    await act(async () => vm().submit());
    expect(repo.create).toHaveBeenCalledWith(GROUP_ID, { name: "checkout", description: "Pay flows" });
    expect(vm().open).toBe(false);
    expect(onCreated).toHaveBeenCalledWith("checkout");
  });

  it("omits an empty description and surfaces a server refusal", async () => {
    repo.create.mockRejectedValue(apiError(409));
    const vm = renderHook(() => useCreateProjectFolderViewModel({ groupId: GROUP_ID, onCreated: jest.fn() }));
    act(() => vm().openDialog());
    act(() => vm().setName("checkout"));
    await act(async () => vm().submit());
    expect(repo.create).toHaveBeenCalledWith(GROUP_ID, { name: "checkout" });
    expect(vm().status).toBe("error");
    expect(vm().error).toMatch(/already exists/);
    expect(vm().open).toBe(true);
    act(() => vm().closeDialog());
    expect(vm().open).toBe(false);
  });
});
