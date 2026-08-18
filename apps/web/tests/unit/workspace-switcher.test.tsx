import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// The switcher reads the session to decide whether "+ Create workspace" is
// offered. Stubbed so the component never reaches the network here.
jest.mock("../../src/hooks/use-auth-session", () => ({
  useAuthSession: () => ({
    status: "signed-in",
    session: { authenticated: true, appRole: "lead" },
    error: null,
    refresh: jest.fn(),
  }),
}));

import { WorkspaceProvider } from "../../src/components/layout/workspace-context";
import { WorkspaceSwitcher } from "../../src/components/layout/workspace-switcher";

const workspaces = {
  enabled: true,
  items: [
    { id: "workspace-1", name: "Personal workspace", kind: "personal" as const, role: "admin" as const },
    { id: "workspace-2", name: "Team workspace", kind: "team" as const, role: "member" as const },
  ],
};

describe("WorkspaceSwitcher", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  // Deliberately a <select> even with ONE entry. Falling back to plain text
  // meant a lead with a single team learned the app had no switcher and never
  // looked again after joining a second.
  it("still renders a switcher when only one workspace is available", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher workspaces={{ enabled: true, items: [workspaces.items[0]] }} />
        </WorkspaceProvider>,
      );
    });

    expect(container.textContent).toContain("Personal workspace");
    expect(container.querySelector("select")).not.toBeNull();
  });

  it("offers create-workspace to a lead", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher workspaces={workspaces} />
        </WorkspaceProvider>,
      );
    });

    expect(container.textContent).toContain("+ Create workspace");
  });

  it("renders nothing when workspaces are disabled", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher workspaces={{ enabled: false, items: [] }} />
        </WorkspaceProvider>,
      );
    });

    expect(container.querySelector("select")).toBeNull();
  });

  it("persists selected workspace changes when multiple workspaces are available", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher workspaces={workspaces} />
        </WorkspaceProvider>,
      );
    });

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Active workspace"]')!;
    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      descriptor?.set?.call(select, "workspace-2");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-2");
  });
});
