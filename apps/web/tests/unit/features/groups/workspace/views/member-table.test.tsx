import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { MemberTable } from "../../../../../../src/features/groups/workspace/views/member-table";
import type { GroupMember } from "../../../../../../src/features/groups";

jest.mock("../../../../../../src/features/groups/data/hierarchy-api", () => ({
  ...jest.requireActual("../../../../../../src/features/groups/data/hierarchy-api"),
  removeGroupMember: jest.fn(),
}));

function member(over: Partial<GroupMember>): GroupMember {
  return {
    id: "m1",
    groupId: "g1",
    userId: "u1",
    role: "member",
    memberStatus: "active",
    login: "ana",
    name: "Ana",
    email: null,
    avatarUrl: null,
    invitedBy: null,
    invitedAt: null,
    removedAt: null,
    removedBy: null,
    removalReason: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(members: GroupMember[], canManage: boolean): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <MemberTable
        groupId="g1"
        members={members}
        canManage={canManage}
        currentUserId="someone-else"
        onMembersChange={jest.fn()}
      />,
    ),
  );
  return container;
}

function hasRemove(container: HTMLElement): boolean {
  return [...container.querySelectorAll("button")].some((b) => b.textContent === "Remove");
}

describe("MemberTable roles", () => {
  it("shows a read-only role badge, never a role picker, even to a manager", () => {
    const container = render(
      [member({ id: "a", role: "admin" }), member({ id: "b", userId: "u2", login: "bo", role: "member" })],
      true,
    );
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).toContain("Lead");
    expect(container.textContent).not.toContain("Delegated lead");
  });

  it("derives the badge from the app role when the row carries it", () => {
    const container = render(
      [
        member({ id: "a", login: "l", appRole: "lead" }),
        member({ id: "b", userId: "u2", login: "q", appRole: "qa" }),
        member({ id: "c", userId: "u3", login: "d", appRole: "member" }),
      ],
      true,
    );
    expect(container.textContent).toContain("Product owner");
    expect(container.textContent).toContain("QA Team");
    expect(container.textContent).toContain("Developer");
    expect(container.querySelector("select")).toBeNull();
  });

  it("offers Remove to managers only", () => {
    const rows = [member({ id: "a" }), member({ id: "b", userId: "u2", login: "bo" })];
    expect(hasRemove(render(rows, true))).toBe(true);
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    expect(hasRemove(render(rows, false))).toBe(false);
  });
});
