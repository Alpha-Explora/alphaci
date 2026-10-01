import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectFoldersRepository } from "../../../../../../src/features/teams/project-folders/data/project-folders-repository";
import {
  ProjectExplorerHost,
  type ProjectExplorerActions,
} from "../../../../../../src/features/teams/project-folders/views/project-explorer";
import { normaliseProjectFolders } from "../../../../../../src/features/teams/project-folders/model/project-folder-rules";
import { apiError, foldersSnapshot, foldersWire, GROUP_ID } from "../folder-fixtures";

jest.mock("../../../../../../src/features/teams/project-folders/data/project-folders-repository", () => ({
  projectFoldersRepository: {
    list: jest.fn(),
    create: jest.fn(),
    moveRepository: jest.fn(),
    archive: jest.fn(),
    requirementCounts: jest.fn(),
    deleteProject: jest.fn(),
  },
}));

/* The Project QA workspace owns its own view-models (tested in the checklists
 * domain); here it only has to be mounted with the right Project and role. */
jest.mock("../../../../../../src/features/checklists/requirements", () => ({
  ProjectQaWorkspace: ({ deliveryProjectId, appRole }: { deliveryProjectId: string; appRole: string | null }) => (
    <div data-testid="qa-workspace" data-project={deliveryProjectId} data-role={appRole ?? ""} />
  ),
}));

const mockSession = { appRole: "lead" as string };
jest.mock("../../../../../../src/features/auth/session", () => ({
  useAuthSession: () => ({ session: { appRole: mockSession.appRole } }),
}));

const repo = projectFoldersRepository as jest.Mocked<typeof projectFoldersRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
  mockSession.appRole = "lead";
});

async function settle() {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

/** Polls until `check` stops throwing: for UI that leaves through an exit animation. */
async function waitFor(check: () => void, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 16));
      });
    }
  }
}

let lastCount: number | null | undefined;
let lastActions: ProjectExplorerActions | undefined;

async function renderExplorer(
  qaChecklistsEnabled = true,
  initialFolderId: string | null = null,
  openNewProjectOnArrival = false,
): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <ProjectExplorerHost
        groupId={GROUP_ID}
        groupName="Checkout squad"
        qaChecklistsEnabled={qaChecklistsEnabled}
        initialFolderId={initialFolderId}
        openNewProjectOnArrival={openNewProjectOnArrival}
      >
        {(explorer) => {
          lastCount = explorer.count;
          lastActions = explorer.actions;
          return explorer.panel;
        }}
      </ProjectExplorerHost>,
    );
  });
  await settle();
  return container;
}

function button(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((el) => el.textContent?.includes(name));
}

/** A card's "Manage" control: the Project detail, beside the card's own link. */
function manage(container: HTMLElement, folderName: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`button.pf-card__manage[aria-label="Manage ${folderName}"]`);
}

function link(container: HTMLElement, name: string): HTMLAnchorElement | undefined {
  return [...container.querySelectorAll("a")].find((el) => el.textContent?.includes(name));
}

/** A card's "Add repository": the wizard filed in that Project, beside Manage. */
function addToCard(container: HTMLElement, folderName: string): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>(`a.pf-card__add[aria-label="Add repository to ${folderName}"]`);
}

describe("ProjectExplorer", () => {
  it("lists Project cards with repository and requirement counts, then the unfiled group", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({ "dp-1": 1 });
    const container = await renderExplorer();
    expect(lastCount).toBe(2);
    const cards = container.querySelectorAll("li.pf-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("testfinals");
    expect(cards[0].textContent).toContain("2 repositories");
    expect(cards[0].textContent).toContain("1 requirement");
    // No BACKEND/FRONTEND chips on a card: the card is the Project.
    expect(cards[0].querySelector(".pf-chip, .pf-chips")).toBeNull();
    expect(cards[0].textContent).not.toMatch(/Frontend|Backend/);
    expect(cards[1].textContent).toContain("0 repositories");
    expect(cards[1].textContent).toContain("No requirements");
    expect(container.querySelector(".pf-unfiled")?.textContent).toContain("blaine");
    // The create actions moved to the page heading; the explorer draws none.
    expect(container.querySelector(".group-section-head")).toBeNull();
    expect(button(container, "New Project")).toBeUndefined();
    expect(link(container, "Create repository")).toBeUndefined();
    // A Product owner creates Projects and never adds repositories.
    expect(lastActions?.createEmptyProject).toEqual(expect.any(Function));
    expect(lastActions?.addRepositoryHref).toBeNull();
    expect(container.querySelector("a.pf-card__add")).toBeNull();
    expect(link(container, "Add repository")).toBeUndefined();
  });

  it("opens the Empty project dialog from the heading's action", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => lastActions!.createEmptyProject!());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("New Project");
  });

  it("hides lead actions, requirement counts and QA from a Developer without the capability", async () => {
    mockSession.appRole = "member";
    repo.list.mockResolvedValue(foldersSnapshot({ canManage: false }));
    const container = await renderExplorer(false);
    expect(lastActions).toEqual({ createEmptyProject: null, addRepositoryHref: null });
    expect(button(container, "New Project")).toBeUndefined();
    expect(container.textContent).not.toContain("requirement");
    expect(repo.requirementCounts).not.toHaveBeenCalled();

    await act(async () => manage(container, "testfinals")!.click());
    expect(container.textContent).not.toContain("Verify in QA Studio");
    expect(button(container, "Move")).toBeUndefined();
    expect(container.querySelector('[data-testid="qa-workspace"]')).toBeNull();
    expect(container.textContent).not.toContain("Danger zone");
  });

  it("gives a Developer Add repository on each card and in the detail, filed in that Project", async () => {
    mockSession.appRole = "member";
    repo.list.mockResolvedValue(foldersSnapshot({ canManage: false }));
    const container = await renderExplorer(false);

    const add = addToCard(container, "testfinals")!;
    expect(add.getAttribute("href")).toBe("/workflows?tab=setup&group=ws-1&project=dp-1");
    expect(add.textContent).toBe("Add repository");
    // A sibling of the card's link and of Manage, never nested inside the link.
    expect(add.closest("a.pf-card__open")).toBeNull();
    expect(add.parentElement).toBe(manage(container, "testfinals")!.parentElement);
    expect(addToCard(container, "wallet")?.getAttribute("href")).toBe(
      "/workflows?tab=setup&group=ws-1&project=dp-2",
    );

    await act(async () => manage(container, "testfinals")!.click());
    expect(container.querySelector(".pf-detail__actions a")?.textContent).toBe("Add repository");
    expect(container.querySelector<HTMLAnchorElement>(".pf-detail__actions a")?.getAttribute("href")).toBe(
      "/workflows?tab=setup&group=ws-1&project=dp-1",
    );

    await act(async () => button(container, "All Projects")!.click());
    await act(async () => manage(container, "wallet")!.click());
    expect(container.querySelector(".pf-empty-folder")?.textContent).toContain("Add the first one");
    expect(link(container, "Add repository")?.getAttribute("href")).toBe("/workflows?tab=setup&group=ws-1&project=dp-2");
  });

  it("follows the server's canCreateRepository over the app role", async () => {
    mockSession.appRole = "member";
    repo.list.mockResolvedValue(foldersSnapshot({ canManage: false, canCreateRepository: false }));
    const container = await renderExplorer(false);
    expect(container.querySelector("a.pf-card__add")).toBeNull();
  });

  it("gives an admin both: Create project, the unfiled Add repository, and per-Project Add repository", async () => {
    mockSession.appRole = "admin";
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    expect(lastActions?.createEmptyProject).toEqual(expect.any(Function));
    expect(lastActions?.addRepositoryHref).toBe("/workflows?tab=setup&group=ws-1");
    expect(addToCard(container, "testfinals")).not.toBeNull();
  });

  it("gives QA Team neither Create project nor Add repository", async () => {
    mockSession.appRole = "qa";
    repo.list.mockResolvedValue(foldersSnapshot({ canManage: false }));
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    expect(lastActions).toEqual({ createEmptyProject: null, addRepositoryHref: null });
    expect(container.querySelector("a.pf-card__add")).toBeNull();
    await act(async () => manage(container, "wallet")!.click());
    expect(link(container, "Add repository")).toBeUndefined();
    expect(container.querySelector(".pf-empty-folder")?.textContent).toContain("Developers add them.");
  });

  it.each([
    ["lead", "Create the first Project for this team.", true],
    ["member", "Your Product owner hasn't created a Project yet.", false],
    ["qa", null, false],
  ] as const)("words the empty list for %s", async (role, line, offersCreate) => {
    mockSession.appRole = role;
    repo.list.mockResolvedValue(foldersSnapshot({ folders: [], unfiled: [], canManage: role === "lead" }));
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    const text = container.querySelector(".hier-state-text")?.textContent ?? "";
    expect(text).toContain("A Project groups the repositories that ship together");
    if (line) expect(text).toContain(line);
    else expect(text).not.toMatch(/Create the first|Product owner/);
    expect(button(container, "Create the first Project") !== undefined).toBe(offersCreate);
  });

  it("opens the New Project dialog on arrival for a Product owner, never for a Developer", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    let container = await renderExplorer(true, null, true);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("New Project");
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";

    mockSession.appRole = "member";
    container = await renderExplorer(true, null, true);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows loading, then the error state with a retry", async () => {
    repo.list.mockRejectedValueOnce(apiError(404)).mockResolvedValueOnce(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    expect(container.textContent).toContain("Projects did not load");
    expect(container.textContent).toContain("This team's Projects are not available.");
    await act(async () => button(container, "Try again")!.click());
    await settle();
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });

  it("shows an empty state that lets a lead create the first Project", async () => {
    repo.list.mockResolvedValue(foldersSnapshot({ folders: [], unfiled: [] }));
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    expect(container.textContent).toContain("No Projects yet");
    await act(async () => button(container, "Create the first Project")!.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("New Project");
  });

  it("opens a Project: QA Studio, create-in-Project, move, and its requirements and QA", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({ "dp-1": 2 });
    const container = await renderExplorer();
    await act(async () => manage(container, "testfinals")!.click());

    expect(container.querySelector(".pf-detail__title")?.textContent).toBe("testfinals");
    expect(link(container, "Verify in QA Studio")?.getAttribute("href")).toBe("/projects/proj-fe#qa");
    // A Product owner fills nothing: Developers add the repositories.
    expect(link(container, "Add repository")).toBeUndefined();
    // The Project's requirements and QA run, for this Project and this role.
    const workspace = container.querySelector('[data-testid="qa-workspace"]');
    expect(workspace?.getAttribute("data-project")).toBe("dp-1");
    expect(workspace?.getAttribute("data-role")).toBe("lead");
    expect(container.textContent).toContain("Requirements and QA");
    expect(container.querySelector(".pf-attach")).toBeNull();

    const moves = [...container.querySelectorAll("button")].filter((el) => el.textContent === "Move");
    expect(moves).toHaveLength(2);
    await act(async () => moves[0].click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Move testfinals-frontend");
    expect(dialog.textContent).toContain("wallet");
    expect(dialog.textContent).not.toContain("testfinals0");

    await act(async () => button(container, "All Projects")!.click());
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });

  it("offers create-in-Project on an empty Project", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    await act(async () => button(container, "wallet")!.click());
    expect(container.querySelector(".pf-empty-folder")?.textContent).toContain("No repositories in this Project yet.");
    // Requirements belong to the Project, so they can be written before any repository exists.
    expect(container.querySelector('[data-testid="qa-workspace"]')?.getAttribute("data-project")).toBe("dp-2");
    expect(button(container, "Move")).toBeUndefined();
  });

  it("deletes a Project from the danger zone and returns to the list with a notice", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    repo.deleteProject.mockResolvedValue({
      deliveryProjectId: "dp-1",
      name: "testfinals",
      deletedRepositories: [
        { repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: false },
        { repositoryId: "repo-be", name: "testfinals-be", projectId: "proj-be", githubRepoDeleted: false },
      ],
    });
    const container = await renderExplorer();
    await act(async () => manage(container, "testfinals")!.click());

    await act(async () => button(container, "Delete Project")!.click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Delete testfinals?");
    expect(dialog.textContent).toContain("Also delete the GitHub repositories");

    const submit = [...dialog.querySelectorAll("button")].find((el) => el.textContent === "Delete Project")!;
    expect(submit.hasAttribute("disabled")).toBe(true);

    const input = dialog.querySelector<HTMLInputElement>(".hier-input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "testfinals");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(submit.hasAttribute("disabled")).toBe(false);

    await act(async () => submit.click());
    await settle();

    expect(repo.deleteProject).toHaveBeenCalledWith("dp-1", {
      confirmName: "testfinals",
      deleteGithubRepos: false,
      deleteProviderResources: false,
      deleteSonarProjects: false,
    });
    // The dialog leaves through a framer-motion exit animation, so it stays
    // mounted for a few frames after the delete resolves.
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull());
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
    expect(container.textContent).toContain("Deleted testfinals and 2 repositories.");
  });

  it("opens a Project on its frontend's page, with Manage beside the card for the detail", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    const [testfinals, wallet] = [...container.querySelectorAll("li.pf-card")];

    const open = testfinals.querySelector<HTMLAnchorElement>("a.pf-card__open");
    expect(open?.getAttribute("href")).toBe("/projects/proj-fe");
    expect(open?.textContent).toContain("testfinals");

    // Manage is a sibling of the card's link, never nested inside it.
    const manageButton = manage(container, "testfinals")!;
    expect(manageButton.textContent).toBe("Manage");
    expect(manageButton.closest("a")).toBeNull();
    expect(manageButton.closest(".pf-card__head")).toBe(open?.parentElement);

    // A Project with nothing linked has no page: its card opens the detail.
    expect(wallet.querySelector("a.pf-card__open")).toBeNull();
    expect(wallet.querySelector("button.pf-card__open")).not.toBeNull();
    expect(manage(container, "wallet")).not.toBeNull();

    await act(async () => manageButton.click());
    expect(container.querySelector(".pf-detail__title")?.textContent).toBe("testfinals");
  });

  it("opens on the first linked repository when the frontend is not linked", async () => {
    const wire = foldersWire();
    const [frontend, backend] = wire.folders[0].repositories;
    wire.folders[0].repositories = [{ ...frontend, project: null }, backend];
    repo.list.mockResolvedValue(normaliseProjectFolders(wire, GROUP_ID));
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer();
    expect(container.querySelector("a.pf-card__open")?.getAttribute("href")).toBe("/projects/proj-be");
  });

  it("opens the deep-linked Project's detail on arrival", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer(true, "dp-1");
    expect(container.querySelector(".pf-detail__title")?.textContent).toBe("testfinals");
    await act(async () => button(container, "All Projects")!.click());
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });

  it("shows the list when the deep-linked Project is not in this team", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.requirementCounts.mockResolvedValue({});
    const container = await renderExplorer(true, "dp-elsewhere");
    expect(container.querySelector(".pf-detail__title")).toBeNull();
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });
});
