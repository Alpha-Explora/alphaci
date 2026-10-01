import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkflowCurrentTab } from "../../../../../../src/features/workflows/studio/views/workflow-current-tab";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("../../../../../../src/features/workflows/studio/view-models/use-current-projects-view-model", () => ({
  GROUPS_LOAD_ERROR: "Could not load teams.",
  useCurrentProjectsViewModel: () => ({
    status: "ready",
    team: null,
    linkedFolderId: null,
    retry: jest.fn(),
  }),
}));

let root: Root | null = null;

beforeAll(() => {
  // framer-motion's whileInView observes visibility; jsdom has no observer.
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(canCreateProjects: boolean, guest = false): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <WorkflowCurrentTab
        latestResult={null}
        loadingProjects={false}
        onOpenSetup={jest.fn()}
        canCreateProjects={canCreateProjects}
        guest={guest}
        onGuestCreate={guest ? jest.fn() : undefined}
      />,
    ),
  );
  return container;
}

function hasButton(container: HTMLElement, label: string): boolean {
  return [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === label);
}

describe("Projects empty state", () => {
  /* With no team there is nowhere to put a Project yet: a Product owner or
   * admin is told to make a team first, and nobody gets the wizard. */
  it("asks a Product owner or admin for a team, then its first Project", () => {
    const container = render(true);
    expect(container.textContent).toContain("then create its first Project.");
    expect(hasButton(container, "Create a project")).toBe(false);
    expect(container.querySelector("[data-testid='create-project-button']")).toBeNull();
  });

  it("tells a Developer or QA that Product owners create Projects", () => {
    const container = render(false);
    expect(hasButton(container, "Create a project")).toBe(false);
    expect(container.textContent).toContain("No groups or projects yet.");
    expect(container.textContent).toContain("Projects are created by Product owners.");
  });

  it("keeps the signup nudge for a guest", () => {
    const container = render(false, true);
    expect(hasButton(container, "Create a project")).toBe(true);
    expect(container.querySelector("[data-testid='create-project-button']")).not.toBeNull();
  });
});
