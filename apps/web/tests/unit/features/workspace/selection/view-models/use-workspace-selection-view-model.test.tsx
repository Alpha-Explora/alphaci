import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceProvider } from "../../../../../../src/features/workspace/selection/views/workspace-selection-context";
import { useWorkspaceSelectionViewModel } from "../../../../../../src/features/workspace/selection/view-models/use-workspace-selection-view-model";

jest.mock("../../../../../../src/features/workspace/selection/data/workspace-repository", () => ({
  getWorkspaces: jest.fn(),
  getVisibleTeams: jest.fn(),
}));

import {
  getVisibleTeams,
  getWorkspaces,
} from "../../../../../../src/features/workspace/selection/data/workspace-repository";
import { useWorkspaceSelection } from "../../../../../../src/features/workspace/selection/views/workspace-selection-context";

const mockedGetWorkspaces = getWorkspaces as jest.MockedFunction<typeof getWorkspaces>;
const mockedGetVisibleTeams = getVisibleTeams as jest.MockedFunction<typeof getVisibleTeams>;

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

  describe("for a platform admin", () => {
    const mine = {
      enabled: true,
      items: [{ id: "workspace-1", name: "Workspace", kind: "team" as const, role: "admin" as const }],
    };

    type Captured = {
      vm: ReturnType<typeof useWorkspaceSelectionViewModel> | null;
      selectedId: string | null;
    };

    async function renderAdmin(includeOtherTeams: boolean): Promise<Captured> {
      const captured: Captured = { vm: null, selectedId: null };
      function Probe() {
        // eslint-disable-next-line react-hooks/immutability
        captured.vm = useWorkspaceSelectionViewModel({ enabled: true, includeOtherTeams });
        // eslint-disable-next-line react-hooks/immutability
        captured.selectedId = useWorkspaceSelection().selectedWorkspaceId;
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
      return captured;
    }

    it("also lists the teams they are not a member of", async () => {
      mockedGetWorkspaces.mockResolvedValue(mine);
      mockedGetVisibleTeams.mockResolvedValue([
        { id: "workspace-1", name: "Workspace" },
        { id: "workspace-9", name: "Johns Kitchen" },
      ]);
      const captured = await renderAdmin(true);
      expect(mockedGetVisibleTeams).toHaveBeenCalledTimes(1);
      expect(captured.vm?.otherTeams).toEqual([
        { id: "workspace-9", name: "Johns Kitchen", kind: "team", role: "admin" },
      ]);
    });

    /* Both lists are published in one update, so a remembered selection of a
     * team the admin is not in is not reset to their first own team. */
    it("keeps a remembered other-team selection", async () => {
      window.localStorage.setItem("flowci.workspaceId", "workspace-9");
      mockedGetWorkspaces.mockResolvedValue(mine);
      mockedGetVisibleTeams.mockResolvedValue([{ id: "workspace-9", name: "Johns Kitchen" }]);
      const captured = await renderAdmin(true);
      expect(captured.selectedId).toBe("workspace-9");
      expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-9");
    });

    it("still loads the admin's own teams when the full list fails", async () => {
      mockedGetWorkspaces.mockResolvedValue(mine);
      mockedGetVisibleTeams.mockRejectedValue(new Error("offline"));
      const captured = await renderAdmin(true);
      expect(captured.vm?.status).toBe("ready");
      expect(captured.vm?.workspaces).toEqual(mine);
      expect(captured.vm?.otherTeams).toEqual([]);
    });

    it("never asks for the full list for anyone else", async () => {
      window.localStorage.setItem("flowci.workspaceId", "workspace-9");
      mockedGetWorkspaces.mockResolvedValue(mine);
      const captured = await renderAdmin(false);
      expect(mockedGetVisibleTeams).not.toHaveBeenCalled();
      expect(captured.vm?.otherTeams).toEqual([]);
      // A non-member team is not selectable: the selection falls back.
      expect(captured.selectedId).toBe("workspace-1");
    });
  });
});
