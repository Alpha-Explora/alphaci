import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceMembersSection } from "../../src/features/settings/account/views/workspace-members-section";
import {
  addWorkspaceMember,
  getWorkspaceMembers,
  removeWorkspaceMember,
} from "../../src/features/workspace/selection/data/workspaces-api";

jest.mock("../../src/features/workspace/selection/data/workspaces-api", () => ({
  addWorkspaceMember: jest.fn(),
  getWorkspaceMembers: jest.fn(),
  removeWorkspaceMember: jest.fn(),
  updateWorkspaceMemberRole: jest.fn(),
}));

const mockedAddMember = addWorkspaceMember as jest.MockedFunction<typeof addWorkspaceMember>;
const mockedGetMembers = getWorkspaceMembers as jest.MockedFunction<typeof getWorkspaceMembers>;
const mockedRemoveMember = removeWorkspaceMember as jest.MockedFunction<typeof removeWorkspaceMember>;

const leadWorkspace = {
  id: "workspace-1",
  name: "Design team",
  kind: "team" as const,
  role: "admin" as const,
};

describe("WorkspaceMembersSection", () => {
  let root: Root | null = null;

  beforeEach(() => {
    mockedGetMembers.mockResolvedValue([
      {
        id: "member-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        role: "admin",
        login: "tone",
        name: "Tone",
        email: "tone@example.test",
        avatarUrl: null,
        createdAt: "2026-06-15T00:00:00.000Z",
      },
    ]);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("loads members and prevents removing the last lead", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<WorkspaceMembersSection workspace={leadWorkspace} currentUserId="user-2" />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Tone");
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Role for tone"]')?.disabled).toBe(true);
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Remove")?.disabled).toBe(true);
  });

  it("adds registered users when the viewer can manage the workspace", async () => {
    mockedAddMember.mockResolvedValue({
      id: "member-2",
      workspaceId: "workspace-1",
      userId: "user-2",
      role: "member",
      login: "dev",
      name: "Dev User",
      email: null,
      avatarUrl: null,
      createdAt: "2026-06-15T00:00:00.000Z",
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<WorkspaceMembersSection workspace={leadWorkspace} currentUserId="user-1" />);
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[aria-label="GitHub login or email"]')!;
    await act(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(input, "dev");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add")!
        .click();
      await Promise.resolve();
    });

    expect(mockedAddMember).toHaveBeenCalledWith("workspace-1", {
      loginOrEmail: "dev",
      role: "member",
    });
    expect(container.textContent).toContain("Dev User");
  });

  it("renders member controls read-only for non-admin roles", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <WorkspaceMembersSection
          workspace={{ ...leadWorkspace, role: "viewer" }}
          currentUserId="user-2"
        />,
      );
      await Promise.resolve();
    });

    expect(container.querySelector<HTMLInputElement>('input[aria-label="GitHub login or email"]')).toBeNull();
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Role for tone"]')?.disabled).toBe(true);
    expect(mockedRemoveMember).not.toHaveBeenCalled();
  });
});
