import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkspaceProvider } from "../../../../../../src/features/workspace/selection/views/workspace-selection-context";
import { WorkspaceSwitcher } from "../../../../../../src/features/workspace/selection/views/workspace-switcher";

const workspaces = {
  enabled: true,
  items: [
    { id: "workspace-1", name: "Design team", kind: "team" as const, role: "admin" as const },
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

    expect(container.textContent).toContain("Design team");
    expect(container.querySelector("select")).not.toBeNull();
  });

  it("offers create-workspace to a lead", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher workspaces={workspaces} appRole="lead" />
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

  /* A Lead signing in for the first time belongs to no workspace. The action
   * that resolves that has to be a button: a <select> whose only entry is an
   * action is not a picker, and reads as an empty control rather than
   * something to press. */
  it("offers a create BUTTON, not a picker, to a lead with no workspace", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: true, items: [] }}
            appRole="lead"
          />
        </WorkspaceProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="create-workspace-button"]',
    );
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Create workspace");
    // No empty picker alongside it.
    expect(container.querySelector("select")).toBeNull();
  });

  it("shows the picker, not the button, once a workspace exists", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: true, items: [workspaces.items[0]] }}
            appRole="lead"
          />
        </WorkspaceProvider>,
      );
    });

    expect(
      container.querySelector('[data-testid="create-workspace-button"]'),
    ).toBeNull();
    expect(container.querySelector("select")).not.toBeNull();
  });

  /* A Developer cannot create one, so there is no button to offer — but the
   * slot still says where they stand instead of disappearing. */
  it("tells a developer with no workspace, rather than vanishing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: true, items: [] }}
            appRole="member"
          />
        </WorkspaceProvider>,
      );
    });

    expect(
      container.querySelector('[data-testid="create-workspace-button"]'),
    ).toBeNull();
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).toContain("No team yet");
  });

  /* A failed request used to render exactly like a disabled feature: nothing
   * at all. That is what made a team lead report the control as "missing"
   * when the server was in fact returning 500. */
  it("reports a failed load in place, with a retry", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onRetry = jest.fn();

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: false, items: [] }}
            appRole="lead"
            status="error"
            onRetry={onRetry}
          />
        </WorkspaceProvider>,
      );
    });

    expect(container.textContent).toContain("Workspaces unavailable");
    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Retry"),
    );
    expect(retry).toBeDefined();
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalled();
  });

  /* Switched off by configuration is the one case that SHOULD render nothing:
   * there is no workspace concept to show, which is different from having
   * none of them. */
  it("renders nothing when workspaces are disabled by configuration", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: false, items: [] }}
            appRole="lead"
            status="ready"
          />
        </WorkspaceProvider>,
      );
    });

    expect(container.textContent).toBe("");
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
