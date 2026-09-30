import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useCurrentProjectsViewModel } from "../../../../../../src/features/workflows/studio/view-models/use-current-projects-view-model";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

let mockSearch = "";
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => "/workflows",
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

const mockHeader = {
  selectedWorkspaceId: null as string | null,
  setSelectedWorkspaceId: jest.fn(),
};
jest.mock("../../../../../../src/features/workspace/selection", () => ({
  useWorkspaceSelection: () => mockHeader,
}));

jest.mock("../../../../../../src/features/groups/data/hierarchy-api", () => ({
  getGroups: jest.fn(),
}));

const mockedGetGroups = (
  jest.requireMock("../../../../../../src/features/groups/data/hierarchy-api") as {
    getGroups: jest.Mock;
  }
).getGroups;

const GROUPS = [
  { id: "g-new", name: "Johns Kitchen", description: null, status: "active" },
  { id: "g-old", name: "Team Blaine", description: "Blaine's team", status: "active" },
];

const PROJECTS = [
  { id: "p-1", workspaceId: "g-old" },
  { id: "p-2", workspaceId: "g-old" },
  { id: "p-3", workspaceId: "g-new" },
] as unknown as ProvisionedProject[];

type Vm = ReturnType<typeof useCurrentProjectsViewModel>;
let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  mockSearch = "";
  mockHeader.selectedWorkspaceId = null;
  jest.clearAllMocks();
});

async function renderVm(loadingProjects = false): Promise<() => Vm> {
  let snapshot: Vm | null = null;
  function Probe() {
    // A probe hands the hook's value back to the test; the write IS the read.
    // eslint-disable-next-line react-hooks/globals
    snapshot = useCurrentProjectsViewModel({ projects: PROJECTS, loadingProjects });
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root!.render(<Probe />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return () => snapshot!;
}

describe("useCurrentProjectsViewModel", () => {
  it("is loading until the groups arrive, then ready with repository counts", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mockedGetGroups.mockReturnValue(new Promise((r) => (resolve = r)));
    const get = await renderVm();
    expect(get().status).toBe("loading");

    await act(async () => {
      resolve(GROUPS);
    });
    expect(get().status).toBe("ready");
    expect(get().groups.map((g) => [g.id, g.repositoryCount])).toEqual([
      ["g-new", 1],
      ["g-old", 2],
    ]);
  });

  it("stays loading while the projects are still loading", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    const get = await renderVm(true);
    expect(get().status).toBe("loading");
  });

  it("opens on the first group with no link and no header choice", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    const get = await renderVm();
    expect(get().selectedGroup?.id).toBe("g-new");
  });

  it("opens on the header's workspace when it is one of the groups", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    const get = await renderVm();
    expect(get().selectedGroup?.id).toBe("g-old");
  });

  it("opens on a ?group= link ahead of the header", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    mockSearch = "group=g-new";
    const get = await renderVm();
    expect(get().selectedGroup?.id).toBe("g-new");
  });

  /* The settled decision: the page reads the header, never writes it. The
   * header lists only the caller's teams; an admin's groups list is every team. */
  it("mirrors a choice into ?group= and never into the header", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockSearch = "tour=2&tab=setup";
    const get = await renderVm();

    act(() => get().selectGroup("g-old"));

    expect(get().selectedGroup?.id).toBe("g-old");
    expect(mockReplace).toHaveBeenCalledWith("/workflows?tour=2&group=g-old", {
      scroll: false,
    });
    expect(mockHeader.setSelectedWorkspaceId).not.toHaveBeenCalled();
  });

  it("falls back to another group when the selected one is deleted", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    const get = await renderVm();
    act(() => get().selectGroup("g-old"));

    act(() => get().removeGroup("g-old"));
    expect(get().groups.map((g) => g.id)).toEqual(["g-new"]);
    expect(get().selectedGroup?.id).toBe("g-new");
  });

  it("reports an error when the groups fail to load, and retries", async () => {
    mockedGetGroups.mockRejectedValueOnce(new Error("offline"));
    const get = await renderVm();
    expect(get().status).toBe("error");
    expect(get().groups).toEqual([]);
    expect(get().selectedGroup).toBeNull();

    mockedGetGroups.mockResolvedValueOnce(GROUPS);
    await act(async () => {
      get().retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(get().status).toBe("ready");
    expect(mockedGetGroups).toHaveBeenCalledTimes(2);
  });
});
