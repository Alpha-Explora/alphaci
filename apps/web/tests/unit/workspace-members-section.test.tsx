import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceMembersSection } from "../../src/features/settings/account/views/workspace-members-section";
import { getWorkspaceMembers } from "../../src/features/workspace/selection/data/workspaces-api";
import type * as workspacesApi from "../../src/features/workspace/selection/data/workspaces-api";

jest.mock("../../src/features/workspace/selection/data/workspaces-api", () => ({
  getMyWorkspaces: jest.fn(),
  getWorkspaceMembers: jest.fn(),
}));

const mockedGetMembers = getWorkspaceMembers as jest.MockedFunction<typeof getWorkspaceMembers>;

const leadWorkspace = {
  id: "workspace-1",
  name: "Design team",
  kind: "team" as const,
  role: "admin" as const,
};

const TONE = {
  id: "member-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin" as const,
  login: "tone",
  name: "Tone",
  email: "tone@example.test",
  avatarUrl: null,
  createdAt: "2026-06-15T00:00:00.000Z",
};

const DEV = {
  ...TONE,
  id: "member-2",
  userId: "user-2",
  role: "member" as const,
  login: "dev",
  name: "",
  email: null,
};

describe("WorkspaceMembersSection", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  async function render(workspace = leadWorkspace): Promise<HTMLElement> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<WorkspaceMembersSection workspace={workspace} />);
      await Promise.resolve();
    });
    return container;
  }

  it("lists the members with their role, read-only", async () => {
    mockedGetMembers.mockResolvedValue([TONE, DEV]);
    const container = await render();

    expect(mockedGetMembers).toHaveBeenCalledWith("workspace-1");
    const rows = [...container.querySelectorAll("li")];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Tone");
    expect(rows[0].textContent).toContain("@tone / tone@example.test");
    expect(rows[0].textContent).toContain("Lead");
    // A nameless member falls back to the login.
    expect(rows[1].textContent).toContain("dev");
    expect(rows[1].textContent).toContain("Member");
  });

  /* The backend is retiring the /workspaces/:id/members writes; the roster is
   * edited on /teams. Even a Lead gets no add, role or remove control here. */
  it("offers no add, role or remove control, even to a Lead", async () => {
    mockedGetMembers.mockResolvedValue([TONE, DEV]);
    const container = await render();

    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    // And the data layer no longer has the write functions to call.
    const actual = jest.requireActual<typeof workspacesApi>(
      "../../src/features/workspace/selection/data/workspaces-api",
    );
    expect(Object.keys(actual).sort()).toEqual(["getMyWorkspaces", "getWorkspaceMembers"]);
  });

  it("links to the team's Members page on /teams", async () => {
    mockedGetMembers.mockResolvedValue([TONE]);
    const container = await render();
    const link = [...container.querySelectorAll("a")].find(
      (anchor) => anchor.textContent === "Manage members in Teams",
    );
    expect(link?.getAttribute("href")).toBe("/teams?workspace=workspace-1");
  });

  it("says so when the members cannot be loaded, and still links to Teams", async () => {
    mockedGetMembers.mockRejectedValue(new Error("offline"));
    const container = await render({ ...leadWorkspace, role: "viewer" as never });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Workspace members are unavailable right now.");
    expect(container.querySelector("li")).toBeNull();
    expect(container.textContent).toContain("Manage members in Teams");
  });

  it("shows a loading line until the members arrive", async () => {
    mockedGetMembers.mockReturnValue(new Promise(() => undefined));
    const container = await render();
    expect(container.textContent).toContain("Loading members...");
  });
});
