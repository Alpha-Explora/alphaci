import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useCurrentProjectsViewModel } from "../../../../../../src/features/workflows/studio/view-models/use-current-projects-view-model";

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

type Vm = ReturnType<typeof useCurrentProjectsViewModel>;
let root: Root | null = null;
let rerender: () => Promise<void>;

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
    snapshot = useCurrentProjectsViewModel({ loadingProjects });
    return null;
  }
  root = createRoot(document.createElement("div"));
  rerender = async () => {
    await act(async () => root!.render(<Probe />));
  };
  await act(async () => {
    root!.render(<Probe />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return () => snapshot!;
}

describe("useCurrentProjectsViewModel", () => {
  it("is loading until the teams arrive, then ready", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mockedGetGroups.mockReturnValue(new Promise((r) => (resolve = r)));
    const get = await renderVm();
    expect(get().status).toBe("loading");

    await act(async () => {
      resolve(GROUPS);
    });
    expect(get().status).toBe("ready");
  });

  it("stays loading while the projects are still loading", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    const get = await renderVm(true);
    expect(get().status).toBe("loading");
  });

  it("shows the header's team", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    const get = await renderVm();
    expect(get().team?.id).toBe("g-old");
  });

  it("loads a newly selected workspace without showing the previous team's projects", async () => {
    mockedGetGroups.mockResolvedValueOnce(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    const get = await renderVm();
    expect(get().team?.id).toBe("g-old");

    let finish: (value: unknown) => void = () => undefined;
    mockedGetGroups.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mockHeader.selectedWorkspaceId = "g-created";
    await rerender();
    expect(get().status).toBe("loading");
    expect(get().team).toBeNull();

    await act(async () => finish([...GROUPS, { id: "g-created", name: "Empty team" }]));
    expect(get().status).toBe("ready");
    expect(get().team?.id).toBe("g-created");
  });

  it("ignores a previous workspace request completing after the new one", async () => {
    let finishOld: (value: unknown) => void = () => undefined;
    mockedGetGroups.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
    mockHeader.selectedWorkspaceId = "g-old";
    const get = await renderVm();
    mockedGetGroups.mockResolvedValueOnce([{ id: "g-created", name: "Empty team" }]);
    mockHeader.selectedWorkspaceId = "g-created";
    await rerender();
    expect(get().team?.id).toBe("g-created");

    await act(async () => finishOld(GROUPS));
    expect(get().status).toBe("ready");
    expect(get().team?.id).toBe("g-created");
  });

  it("falls back to the first team while the header has no selection it knows", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    const get = await renderVm();
    expect(get().team?.id).toBe("g-new");
  });

  /* ?group= no longer overrides: it seeds the HEADER (WorkflowStudioView),
   * and the page follows the header. The page never writes a selection. */
  it("follows the header, not ?group=, and never writes either", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    mockSearch = "group=g-new";
    const get = await renderVm();
    expect(get().team?.id).toBe("g-old");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockHeader.setSelectedWorkspaceId).not.toHaveBeenCalled();
  });

  it("opens a ?project= link on the team it names", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    mockSearch = "group=g-old&project=dp-1";
    const get = await renderVm();
    expect(get().linkedFolderId).toBe("dp-1");
  });

  it("does not open a Project linked for another team, or a wizard's target", async () => {
    mockedGetGroups.mockResolvedValue(GROUPS);
    mockHeader.selectedWorkspaceId = "g-old";
    mockSearch = "group=g-new&project=dp-1";
    const other = await renderVm();
    expect(other().linkedFolderId).toBeNull();

    act(() => root?.unmount());
    mockSearch = "tab=setup&group=g-old&project=dp-1";
    const wizard = await renderVm();
    expect(wizard().linkedFolderId).toBeNull();
  });

  it("reports an error when the teams fail to load, and retries", async () => {
    mockedGetGroups.mockRejectedValueOnce(new Error("offline"));
    const get = await renderVm();
    expect(get().status).toBe("error");
    expect(get().team).toBeNull();

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
