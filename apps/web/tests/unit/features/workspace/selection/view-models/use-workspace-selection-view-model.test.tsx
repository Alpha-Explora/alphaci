import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceProvider } from "../../../../../../src/features/workspace/selection/views/workspace-selection-context";
import { useWorkspaceSelectionViewModel } from "../../../../../../src/features/workspace/selection/view-models/use-workspace-selection-view-model";

jest.mock("../../../../../../src/features/workspace/selection/data/workspace-repository", () => ({
  getWorkspaces: jest.fn(),
}));

import { getWorkspaces } from "../../../../../../src/features/workspace/selection/data/workspace-repository";

const mockedGetWorkspaces = getWorkspaces as jest.MockedFunction<typeof getWorkspaces>;

describe("useWorkspaceSelectionViewModel", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("loads and publishes the mapped workspaces through the selection context", async () => {
    const response = {
      enabled: true,
      items: [
        { id: "workspace-1", name: "Workspace", kind: "team" as const, role: "admin" as const },
      ],
    };
    mockedGetWorkspaces.mockResolvedValue(response);

    const captured: {
      snapshot: ReturnType<typeof useWorkspaceSelectionViewModel> | null;
    } = { snapshot: null };
    function Probe() {
      /* A probe component exists to hand the hook's return value back to the
       * test, which is the one case this rule cannot model: the write is the
       * point, and there is no effect to move it into without changing what is
       * being asserted. */
      // eslint-disable-next-line react-hooks/immutability
      captured.snapshot = useWorkspaceSelectionViewModel({ enabled: true });
      return null;
    }

    const container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>,
      );
    });

    expect(mockedGetWorkspaces).toHaveBeenCalledTimes(1);
    expect(captured.snapshot?.status).toBe("ready");
    expect(captured.snapshot?.workspaces).toEqual(response);
    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-1");
  });

  it("does not probe when the route is guest-only", async () => {
    function Probe() {
      useWorkspaceSelectionViewModel({ enabled: false });
      return null;
    }

    const container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>,
      );
    });

    expect(mockedGetWorkspaces).not.toHaveBeenCalled();
  });
});
