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

let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
});

function renderSwitcher(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<WorkspaceProvider>{node}</WorkspaceProvider>);
  });
  return container;
}

function trigger(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init }));
  });
}

function click(target: Element) {
  act(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function listbox(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[role="listbox"]');
}

function options(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="option"]')];
}

function createAction(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Create workspace",
  );
}

describe("WorkspaceSwitcher", () => {
  // Deliberately a picker even with ONE entry. Falling back to plain text
  // meant a lead with a single team learned the app had no switcher and never
  // looked again after joining a second.
  it("still renders a switcher when only one workspace is available", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher workspaces={{ enabled: true, items: [workspaces.items[0]] }} />,
    );

    expect(container.textContent).toContain("Design team");
    expect(trigger(container)).not.toBeNull();
  });

  it("names the trigger after the active workspace, closed until pressed", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
    const button = trigger(container)!;

    const name = (button.getAttribute("aria-labelledby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(name).toBe("Active workspace: Design team");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(listbox(container)).toBeNull();
  });

  it("offers create-workspace to a lead, as an action after the list", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} appRole="lead" />);
    click(trigger(container)!);

    const action = createAction(container);
    expect(action).toBeDefined();
    // A button beside the listbox, not a fake option inside it.
    expect(listbox(container)!.contains(action!)).toBe(false);
    expect(options(container).map((option) => option.textContent)).toEqual(["Design team", "Team workspace"]);
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
  });

  it("opens the create dialog from the action and closes the panel", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} appRole="lead" />);
    click(trigger(container)!);
    click(createAction(container)!);

    expect(listbox(container)).toBeNull();
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Create group");
  });

  it("never offers create-workspace to a Developer with a team", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} appRole="member" />);
    click(trigger(container)!);

    expect(createAction(container)).toBeUndefined();
    expect(container.querySelector('[role="separator"]')).toBeNull();
  });

  it("renders nothing when workspaces are disabled", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={{ enabled: false, items: [] }} />);

    expect(trigger(container)).toBeNull();
  });

  /* A Lead signing in for the first time belongs to no workspace. The action
   * that resolves that has to be a button: a picker whose only entry is an
   * action is not a picker, and reads as an empty control rather than
   * something to press. */
  it("offers a create BUTTON, not a picker, to a lead with no workspace", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher workspaces={{ enabled: true, items: [] }} appRole="lead" />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="create-workspace-button"]',
    );
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Create workspace");
    // No empty picker alongside it.
    expect(trigger(container)).toBeNull();
  });

  it("shows the picker, not the button, once a workspace exists", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher workspaces={{ enabled: true, items: [workspaces.items[0]] }} appRole="lead" />,
    );

    expect(container.querySelector('[data-testid="create-workspace-button"]')).toBeNull();
    expect(trigger(container)).not.toBeNull();
  });

  /* A Developer cannot create one, so there is no button to offer — but the
   * slot still says where they stand instead of disappearing. */
  it("tells a developer with no workspace, rather than vanishing", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher workspaces={{ enabled: true, items: [] }} appRole="member" />,
    );

    expect(container.querySelector('[data-testid="create-workspace-button"]')).toBeNull();
    expect(trigger(container)).toBeNull();
    expect(container.textContent).toContain("No team yet");
    /* The role it thinks you have is the whole point of this state: it is what
     * separates "you really have no team" from "your role was misjudged". */
    expect(container.textContent).toContain("Developer");
  });

  /* QA Team members verify work; they never create workspaces. The notice
   * names their role so a misjudged tester is as visible as a misjudged lead. */
  it("never offers create-workspace to QA Team, and names the role", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher workspaces={{ enabled: true, items: [] }} appRole="qa" />,
    );

    expect(container.querySelector('[data-testid="create-workspace-button"]')).toBeNull();
    expect(container.textContent).not.toContain("Create workspace");
    expect(container.textContent).toContain("Signed in as QA Team");
  });

  /* The reason this state exists at all. A Lead who is misidentified as a
   * Developer lands here instead of on the create button, and the two are
   * indistinguishable unless the notice says which role it acted on. */
  it("names the role it acted on, so a misjudged lead is visible", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher
        workspaces={{ enabled: true, items: [] }}
        appRole="member"
        onRetry={() => undefined}
      />,
    );

    expect(container.textContent).toContain("Signed in as Developer");
  });

  /* An admin adding you to a team is the common exit from this state, and it
   * happens on someone else's screen. Re-reading the list in place beats
   * telling the user to reload a page they have no reason to suspect. */
  it("offers a re-check that re-reads the team list", () => {
    const onRetry = jest.fn();
    const container = renderSwitcher(
      <WorkspaceSwitcher
        workspaces={{ enabled: true, items: [] }}
        appRole="member"
        onRetry={onRetry}
      />,
    );

    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Check again",
    );
    expect(button).toBeDefined();
    click(button!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /* A Lead must still get the button, never this notice. */
  it("never shows the no-team notice to a lead", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher
        workspaces={{ enabled: true, items: [] }}
        appRole="lead"
        onRetry={() => undefined}
      />,
    );

    expect(container.textContent).not.toContain("No team yet");
    expect(container.querySelector('[data-testid="create-workspace-button"]')).not.toBeNull();
  });

  /* A failed request used to render exactly like a disabled feature: nothing
   * at all. */
  it("reports a failed load in place, with a retry", () => {
    const onRetry = jest.fn();
    const container = renderSwitcher(
      <WorkspaceSwitcher
        workspaces={{ enabled: false, items: [] }}
        appRole="lead"
        status="error"
        onRetry={onRetry}
      />,
    );

    expect(container.textContent).toContain("Workspaces unavailable");
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Retry"));
    expect(retry).toBeDefined();
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalled();
  });

  /* Switched off by configuration is the one case that SHOULD render nothing. */
  it("renders nothing when workspaces are disabled by configuration", () => {
    const container = renderSwitcher(
      <WorkspaceSwitcher workspaces={{ enabled: false, items: [] }} appRole="lead" status="ready" />,
    );

    expect(container.textContent).toBe("");
  });

  it("persists a workspace picked with the mouse", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
    click(trigger(container)!);
    click(options(container)[1]);

    expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-2");
    expect(listbox(container)).toBeNull();
    expect(trigger(container)!.textContent).toContain("Team workspace");
  });

  it("marks the current team selected, and only it", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
    click(trigger(container)!);

    expect(options(container).map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    expect(trigger(container)!.getAttribute("aria-expanded")).toBe("true");
    expect(trigger(container)!.getAttribute("aria-controls")).toBe(listbox(container)!.id);
  });

  it("carries the full name as a tooltip, for a name the row truncates", () => {
    const long = { id: "w-long", name: "The very long platform engineering and release team", kind: "team" as const, role: "admin" as const };
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={{ enabled: true, items: [long] }} />);
    click(trigger(container)!);

    expect(options(container)[0].getAttribute("title")).toBe(long.name);
    expect(trigger(container)!.getAttribute("title")).toBe(long.name);
  });

  describe("keyboard", () => {
    it("opens with ArrowDown on the current team, moves with the arrows and picks with Enter", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
      const button = trigger(container)!;

      key(button, "ArrowDown");
      expect(document.activeElement).toBe(options(container)[0]);

      key(document.activeElement!, "ArrowDown");
      expect(document.activeElement).toBe(options(container)[1]);

      key(document.activeElement!, "Enter");
      expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-2");
      expect(listbox(container)).toBeNull();
      expect(document.activeElement).toBe(trigger(container));
    });

    it.each(["Enter", " "])("opens with %p too", (name) => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
      key(trigger(container)!, name);
      expect(listbox(container)).not.toBeNull();
    });

    it("picks with Space", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
      key(trigger(container)!, "ArrowDown");
      key(document.activeElement!, "End");
      key(document.activeElement!, " ");
      expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-2");
    });

    it("reaches the create action after the last team, and wraps", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} appRole="lead" />);
      key(trigger(container)!, "ArrowDown");
      key(document.activeElement!, "End");
      expect(document.activeElement).toBe(createAction(container));

      key(document.activeElement!, "ArrowDown");
      expect(document.activeElement).toBe(options(container)[0]);
      key(document.activeElement!, "ArrowUp");
      expect(document.activeElement).toBe(createAction(container));
      key(document.activeElement!, "Home");
      expect(document.activeElement).toBe(options(container)[0]);
    });

    it("opens the create dialog with Enter on the action", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} appRole="admin" />);
      key(trigger(container)!, "ArrowUp");
      key(document.activeElement!, "ArrowDown");
      expect(document.activeElement).toBe(createAction(container));
      key(document.activeElement!, "Enter");

      expect(listbox(container)).toBeNull();
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it("closes with Escape and hands focus back to the trigger", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
      key(trigger(container)!, "ArrowDown");
      key(document.activeElement!, "Escape");

      expect(listbox(container)).toBeNull();
      expect(document.activeElement).toBe(trigger(container));
      expect(trigger(container)!.getAttribute("aria-expanded")).toBe("false");
      // Nothing was picked.
      expect(window.localStorage.getItem("flowci.workspaceId")).not.toBe("workspace-2");
    });

    it("closes with Tab, from the trigger, so Tab moves on past it", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
      key(trigger(container)!, "ArrowDown");
      key(document.activeElement!, "Tab");

      expect(listbox(container)).toBeNull();
      expect(document.activeElement).toBe(trigger(container));
    });
  });

  it("closes on a press outside, without moving focus there", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
    click(trigger(container)!);
    expect(listbox(container)).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(listbox(container)).toBeNull();
  });

  it("toggles closed when the trigger is pressed again", () => {
    const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} />);
    click(trigger(container)!);
    click(trigger(container)!);
    expect(listbox(container)).toBeNull();
  });

  /* A platform admin sees every team through /groups, but /workspaces/me only
   * lists the ones they belong to. The header is the only way to reach the rest. */
  describe("a platform admin's other teams", () => {
    const otherTeams = [
      { id: "workspace-9", name: "Johns Kitchen", kind: "team" as const, role: "admin" as const },
    ];

    function groups(container: HTMLElement) {
      return [...container.querySelectorAll<HTMLElement>('[role="group"]')].map((group) => ({
        label: document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
        options: [...group.querySelectorAll('[role="option"]')].map((option) => option.textContent),
      }));
    }

    it("lists them under 'Other teams (admin)', after the admin's own teams", () => {
      const container = renderSwitcher(
        <WorkspaceSwitcher workspaces={workspaces} otherTeams={otherTeams} appRole="admin" />,
      );
      click(trigger(container)!);

      expect(groups(container)).toEqual([
        { label: "Your teams", options: ["Design team", "Team workspace"] },
        { label: "Other teams (admin)", options: ["Johns Kitchen"] },
      ]);
      expect(createAction(container)).toBeDefined();
    });

    it("skips the group headings with the arrow keys and selects one like any other team", () => {
      const container = renderSwitcher(
        <WorkspaceSwitcher workspaces={workspaces} otherTeams={otherTeams} appRole="admin" />,
      );
      key(trigger(container)!, "ArrowDown");
      key(document.activeElement!, "ArrowDown");
      key(document.activeElement!, "ArrowDown");
      expect(document.activeElement?.textContent).toBe("Johns Kitchen");

      key(document.activeElement!, "Enter");
      expect(window.localStorage.getItem("flowci.workspaceId")).toBe("workspace-9");
      expect(trigger(container)!.textContent).toContain("Johns Kitchen");
    });

    it("offers a picker to an admin who belongs to no team", () => {
      const container = renderSwitcher(
        <WorkspaceSwitcher workspaces={{ enabled: true, items: [] }} otherTeams={otherTeams} appRole="admin" />,
      );
      click(trigger(container)!);

      expect(groups(container).map((group) => group.label)).toEqual(["Other teams (admin)"]);
    });

    it("leaves everyone else's picker a flat list, as before", () => {
      const container = renderSwitcher(<WorkspaceSwitcher workspaces={workspaces} appRole="lead" />);
      click(trigger(container)!);

      expect(container.querySelector('[role="group"]')).toBeNull();
      expect(container.textContent).not.toContain("Other teams");
    });
  });
});
