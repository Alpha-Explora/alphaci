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

function render(canCreateProjects: boolean): HTMLElement {
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
        onCreateProject={jest.fn()}
      />,
    ),
  );
  return container;
}

function hasButton(container: HTMLElement, label: string): boolean {
  return [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === label);
}

describe("Projects empty state", () => {
  it("offers Create a project to a Lead or Admin", () => {
    expect(hasButton(render(true), "Create a project")).toBe(true);
  });

  it("does not offer Create a project to a Developer or QA", () => {
    const container = render(false);
    expect(hasButton(container, "Create a project")).toBe(false);
    expect(container.textContent).toContain("No groups or projects yet.");
  });
});
