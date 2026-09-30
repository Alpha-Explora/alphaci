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

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(name),
  );
}

describe("WorkspaceChecklistsSection", () => {
  it("gives a lead New checklist, and Edit / Share / Archive on a checklist", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [checklist()], canManage: true });
    const container = await render(
      <WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} />,
    );
    expect(container.textContent).toContain("Release smoke test");
    expect(buttonNamed(container, "New checklist")).toBeDefined();

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

  it("tells a reader who writes checklists when there are none", async () => {
    repo.listForWorkspace.mockResolvedValue({ items: [], canManage: false });
    const container = await render(<WorkspaceChecklistsSection workspaceId="ws-1" projects={PROJECTS} />);
    expect(container.textContent).toContain("No QA checklists yet");
    expect(container.textContent).toContain("team lead");
    expect(buttonNamed(container, "Create the first checklist")).toBeUndefined();
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

  it("gives a reader no manage link", async () => {
    repo.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
    const container = await render(<ProjectChecklistsPanel projectId="project-1" workspaceId="ws-1" />);
    expect(container.querySelector("a.qa-project-card__manage")).toBeNull();
  });
});

describe("project Checklists tab gating", () => {
  // "lead", not "qa": this describes the Checklists capability flag's own
  // effect in isolation. Environment is a separate, role-only gate
  // (ENV_VARS_LEAD_ONLY) that a Team Lead clears regardless of the flag, so
  // it stays out of this count; QA's narrower tab set has its own coverage
  // in project-detail-tab-visibility.test.ts.
  async function renderTabs(qaChecklistsEnabled: boolean) {
    const visible = visibleProjectDetailTabs("lead", { qaChecklistsEnabled });
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
    expect(labels.slice(0, 4)).toEqual(["Overview", "Code", "Pull requests", "Checklists"]);
  });

  it("hides the tab — and only that tab — when the capability is off", async () => {
    const container = await renderTabs(false);
    const labels = [...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    expect(labels).not.toContain("Checklists");
    expect(labels).toHaveLength(9);
  });
});
