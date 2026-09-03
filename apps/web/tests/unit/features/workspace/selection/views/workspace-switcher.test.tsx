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
    /* The role it thinks you have is the whole point of this state: it is what
     * separates "you really have no team" from "your role was misjudged". */
    expect(container.textContent).toContain("Developer");
  });

  /* The reason this state exists at all. A Lead who is misidentified as a
   * Developer lands here instead of on the create button, and the two are
   * indistinguishable unless the notice says which role it acted on. This is
   * the exact shape of the "cannot see the workspace dropdown" report. */
  it("names the role it acted on, so a misjudged lead is visible", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: true, items: [] }}
            appRole="member"
            onRetry={() => undefined}
          />
        </WorkspaceProvider>,
      );
    });

    expect(container.textContent).toContain("Signed in as Developer");
  });

  /* An admin adding you to a team is the common exit from this state, and it
   * happens on someone else's screen. Re-reading the list in place beats
   * telling the user to reload a page they have no reason to suspect. */
  it("offers a re-check that re-reads the team list", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onRetry = jest.fn();

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: true, items: [] }}
            appRole="member"
            onRetry={onRetry}
          />
        </WorkspaceProvider>,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Check again",
    );
    expect(button).toBeDefined();

    act(() => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /* A Lead must still get the button, never this notice — that is the
   * behaviour the whole fix exists to protect. */
  it("never shows the no-team notice to a lead", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <WorkspaceProvider>
          <WorkspaceSwitcher
            workspaces={{ enabled: true, items: [] }}
            appRole="lead"
            onRetry={() => undefined}
          />
        </WorkspaceProvider>,
      );
    });

    expect(container.textContent).not.toContain("No team yet");
    expect(
      container.querySelector('[data-testid="create-workspace-button"]'),
    ).not.toBeNull();
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
