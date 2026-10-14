import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { WorkspaceChecklistsSection } from "../../../../../src/features/checklists/manage/views/workspace-checklists-section";
import { ProjectChecklistsPanel } from "../../../../../src/features/checklists/project/views/project-checklists-panel";
import { ProjectDetailTopTabs } from "../../../../../src/features/projects/detail/views/project-detail-top-tabs";
import { projectDetailTabGroups } from "../../../../../src/features/projects/detail/views/project-detail-tab-config";
import { visibleProjectDetailTabs } from "../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import { checklist } from "../checklist-fixtures";

jest.mock("../../../../../src/features/checklists/data/checklists-repository", () => ({
  checklistsRepository: {
    listForWorkspace: jest.fn(),
    listForProject: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    replaceItems: jest.fn(),
    archive: jest.fn(),
    share: jest.fn(),
  },
}));

const repo = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const PROJECTS = [{ id: "project-1", name: "tone/orders-api", detail: "orders-api" }];

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
    await Promise.resolve();
    await Promise.resolve();
  });
  return container;
}

function linkNamed(container: HTMLElement, name: string): HTMLAnchorElement | undefined {
  return [...container.querySelectorAll("a")].find((link) => link.textContent?.includes(name));
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(name),
  );
}

describe("WorkspaceChecklistsSection", () => {
  it("points a lead to the Projects for new requirements, and keeps Edit / Share / Archive on an older checklist", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: true });
    const container = await render(
      <WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} />,
    );
    expect(container.textContent).toContain("Release smoke test");
    expect(buttonNamed(container, "New checklist")).toBeUndefined();
    expect(linkNamed(container, "Add requirements in a Project")?.getAttribute("href")).toBe("/workflows?group=ws-1");

    await act(async () => buttonNamed(container, "Release smoke test")!.click());
    expect(buttonNamed(container, "Edit checklist")).toBeDefined();
    expect(buttonNamed(container, "Share")).toBeDefined();
    expect(buttonNamed(container, "Archive")).toBeDefined();
    expect(container.textContent).toContain("tone/orders-api");
    expect(container.textContent).toContain("Playwright E2E");

    await act(async () => buttonNamed(container, "Edit checklist")!.click());
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Item 1 title"]')?.value).toBe(
      "Checkout works",
    );
  });

  it.each(["qa", "member"])("shows a %s the same checklist read-only", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: false });
    const container = await render(
      <WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} initialChecklistId="cl-1" />,
    );
    expect(container.textContent).toContain("Checkout works");
    expect(container.textContent).toContain("QA Team");
    expect(buttonNamed(container, "Edit checklist")).toBeUndefined();
    expect(buttonNamed(container, "Share")).toBeUndefined();
    expect(buttonNamed(container, "Archive")).toBeUndefined();

    await act(async () => buttonNamed(container, "All checklists")!.click());
    expect(buttonNamed(container, "New checklist")).toBeUndefined();
  });

  it("tells a reader that requirements now belong to Projects when there are none", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [], canManage: false });
    const container = await render(<WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} />);
    expect(container.textContent).toContain("No QA checklists yet");
    expect(container.textContent).toContain("Your Product owner writes them on each Project.");
    expect(linkNamed(container, "Open Projects")).toBeUndefined();
  });

  it("offers a lead the Projects page instead of creating a checklist when there are none", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [], canManage: true });
    const container = await render(<WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} />);
    expect(buttonNamed(container, "Create the first checklist")).toBeUndefined();
    expect(linkNamed(container, "Open Projects")?.getAttribute("href")).toBe("/workflows?group=ws-1");
  });

  it("shows a checklist that moved to a Project read-only, with a way to the Project", async () => {
    const moved = { ...checklist(), kind: "system", deliveryProjectId: "dp-1", legacyChecklistId: null };
    repo.listForWorkspace.mockResolvedValue({ items: [moved], canManage: true });
    const container = await render(
      <WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} initialChecklistId="cl-1" />,
    );
    expect(container.textContent).toContain("now a System requirement of a Project");
    expect(buttonNamed(container, "Edit checklist")).toBeUndefined();
    expect(buttonNamed(container, "Share")).toBeUndefined();
    expect(buttonNamed(container, "Archive")).toBeUndefined();
    expect(linkNamed(container, "Open the Project")?.getAttribute("href")).toBe("/workflows?group=ws-1&project=dp-1");
  });

  it("drops repository sharing once the backend describes Project requirements", async () => {
    const unassigned = { ...checklist(), kind: "system", deliveryProjectId: null };
    repo.listForWorkspace.mockResolvedValue({ items: [unassigned], canManage: true });
    const container = await render(
      <WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} initialChecklistId="cl-1" />,
    );
    expect(buttonNamed(container, "Edit checklist")).toBeDefined();
    expect(buttonNamed(container, "Share")).toBeUndefined();
  });
});

describe("ProjectChecklistsPanel", () => {
  it("lists shared checklists and links a lead to the team's Checklists page", async () => {
    repo.listForProject.mockResolvedValue({ items: [checklist()], canManage: true });
    const container = await render(<ProjectChecklistsPanel projectId="project-1" workspaceId="ws-1" />);
    expect(container.textContent).toContain("Release smoke test");
    const manage = container.querySelector<HTMLAnchorElement>("a.qa-project-card__manage");
    expect(manage?.getAttribute("href")).toBe("/checklists?workspace=ws-1&checklist=cl-1");
  });

  it("points a repository in a Project at the Project's requirements, without a team manage link", async () => {
    repo.listForProject.mockResolvedValue({ items: [checklist()], canManage: true });
    const container = await render(
      <ProjectChecklistsPanel
        projectId="project-1"
        workspaceId="ws-1"
        qaScope={{ kind: "project", deliveryProjectId: "dp-1", projectName: "storefront", projectHref: "/workflows?group=ws-1&project=dp-1" }}
      />,
    );
    expect(container.textContent).toContain("Requirements belong to the Project storefront");
    expect(linkNamed(container, "Open the Project's requirements")?.getAttribute("href")).toBe(
      "/workflows?group=ws-1&project=dp-1",
    );
    expect(linkNamed(container, "Manage in team")).toBeUndefined();
  });

  it("tells a repository in a Project with no requirements who writes them", async () => {
    repo.listForProject.mockResolvedValue({ items: [], canManage: true });
    const container = await render(
      <ProjectChecklistsPanel
        projectId="project-1"
        workspaceId="ws-1"
        qaScope={{ kind: "project", deliveryProjectId: "dp-1", projectName: "storefront", projectHref: null }}
      />,
    );
    expect(container.textContent).toContain("No requirements yet");
    expect(linkNamed(container, "Open team checklists")).toBeUndefined();
  });

  it("gives a reader no manage link", async () => {
    repo.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
    const container = await render(<ProjectChecklistsPanel projectId="project-1" workspaceId="ws-1" />);
    expect(container.querySelector("a.qa-project-card__manage")).toBeNull();
  });
});

describe("project Checklists tab gating", () => {
  // "admin": every tab, so this describes the Checklists capability flag's
  // own effect in isolation. The per-role tab sets have their own coverage in
  // project-detail-tab-visibility.test.ts.
  async function renderTabs(qaChecklistsEnabled: boolean) {
    const visible = visibleProjectDetailTabs("admin", { qaChecklistsEnabled });
    return render(
      <ProjectDetailTopTabs
        groups={projectDetailTabGroups(visible)}
        value="overview"
        onChange={() => undefined}
        label="Project sections"
        idPrefix="project-detail"
      />,
    );
  }

  it("shows Checklists in the Work group when the capability is on", async () => {
    const container = await renderTabs(true);
    const labels = [...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    expect(labels.slice(0, 5)).toEqual(["Overview", "Code", "Commits", "Pull requests", "Checklists"]);
  });

  it("hides the tab — and only that tab — when the capability is off", async () => {
    const container = await renderTabs(false);
    const labels = [...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    expect(labels).not.toContain("Checklists");
    // Hosting carries the old Environment tab's variables, and Pipeline both
    // Pipeline runs and Workflow, so eight remain.
    expect(labels).toHaveLength(8);
    expect(labels).not.toContain("Environment");
    expect(labels).toContain("Pipeline");
  });
});
