import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceProvider } from "../../src/components/layout/workspace-context";
import { WorkspaceSwitcher } from "../../src/components/layout/workspace-switcher";

const workspaces = {
  enabled: true,
  items: [
    { id: "workspace-1", name: "Personal workspace", kind: "personal" as const, role: "owner" as const },
    { id: "workspace-2", name: "Team workspace", kind: "team" as const, role: "developer" as const },
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

  it("renders a static personal workspace when only one workspace is available", () => {
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
    expect(container.textContent).toContain("personal / owner");
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

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Current workspace"]')!;
    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      descriptor?.set?.call(select, "workspace-2");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-2");
  });
});
