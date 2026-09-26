import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { GroupWorkspacePanel } from "../../../../../../src/features/teams/detail/views/group-workspace-panel";
import type { GroupSummary } from "../../../../../../src/features/groups/data/hierarchy-contracts";

jest.mock("../../../../../../src/features/auth/session", () => ({
  useAuthSession: () => ({ session: { appRole: "lead", user: { id: "u-1" } } }),
}));

const GROUP: GroupSummary = {
  id: "ws-1",
  name: "Checkout squad",
  description: null,
  businessUnit: null,
  status: "active",
  role: "admin",
  memberStatus: "active",
  memberCount: 3,
  systemCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
};

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
});

function render(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

function tab(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((el) =>
    el.textContent?.includes(name),
  );
}

describe("GroupWorkspacePanel with the project explorer", () => {
  it("shows Projects (n) and Checklist templates, and draws the explorer panel", () => {
    const container = render(
      <GroupWorkspacePanel
        group={GROUP}
        projects={[]}
        renderCreateProject={() => null}
        qaChecklists={<p>templates body</p>}
        projectExplorer={{ count: 4, panel: <p>explorer body</p> }}
      />,
    );
    expect(tab(container, "Repositories")).toBeUndefined();
    expect(tab(container, "Projects")?.textContent).toContain("4");
    expect(tab(container, "Checklist templates")).toBeDefined();

    act(() => tab(container, "Projects")!.click());
    expect(container.textContent).toContain("explorer body");
    act(() => tab(container, "Checklist templates")!.click());
    expect(container.textContent).toContain("templates body");
  });

  it("keeps the flat Repositories section when no explorer is given", () => {
    const container = render(
      <GroupWorkspacePanel group={GROUP} projects={[]} renderCreateProject={() => null} />,
    );
    expect(tab(container, "Repositories")).toBeDefined();
    expect(tab(container, "Checklist templates")).toBeUndefined();
  });
});
