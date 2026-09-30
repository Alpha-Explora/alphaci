import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectFoldersRepository } from "../../../../../../src/features/teams/project-folders/data/project-folders-repository";
import { ProjectExplorerHost } from "../../../../../../src/features/teams/project-folders/views/project-explorer";
import { normaliseProjectFolders } from "../../../../../../src/features/teams/project-folders/model/project-folder-rules";
import { apiError, folderChecklist, foldersSnapshot, foldersWire, GROUP_ID } from "../folder-fixtures";

jest.mock("../../../../../../src/features/teams/project-folders/data/project-folders-repository", () => ({
  projectFoldersRepository: {
    list: jest.fn(),
    create: jest.fn(),
    moveRepository: jest.fn(),
    archive: jest.fn(),
    listChecklists: jest.fn(),
    updateChecklistShares: jest.fn(),
    deleteProject: jest.fn(),
  },
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

async function renderExplorer(
  qaChecklistsEnabled = true,
  initialFolderId: string | null = null,
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
      >
        {(explorer) => {
          lastCount = explorer.count;
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

describe("ProjectExplorer", () => {
  it("lists Projects with role chips, checklist counts and the unfiled group", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([folderChecklist()]);
    const container = await renderExplorer();
    expect(lastCount).toBe(2);
    const cards = container.querySelectorAll("li.pf-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("testfinals");
    expect(cards[0].textContent).toContain("2 repositories");
    expect(cards[0].textContent).toContain("1 checklist");
    const chips = [...cards[0].querySelectorAll("a.pf-chip")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["Frontendtestfinals-fe", "Backendtestfinals-be"]);
    expect(chips[0].getAttribute("href")).toBe("/projects/proj-fe");
    expect(chips[0].getAttribute("data-role")).toBe("frontend");
    expect(cards[1].textContent).toContain("No repositories yet.");
    expect(container.querySelector(".pf-unfiled")?.textContent).toContain("blaine");
    expect(button(container, "New Project")).toBeDefined();
    expect(link(container, "Create repository")?.getAttribute("href")).toBe("/workflows?tab=setup&group=ws-1");
  });

  it("hides lead actions and checklist counts from a Developer without the capability", async () => {
    mockSession.appRole = "member";
    repo.list.mockResolvedValue(foldersSnapshot({ canManage: false }));
    const container = await renderExplorer(false);
    expect(button(container, "New Project")).toBeUndefined();
    expect(link(container, "Create repository")).toBeUndefined();
    expect(container.textContent).not.toContain("checklist");
    expect(repo.listChecklists).not.toHaveBeenCalled();

    await act(async () => manage(container, "testfinals")!.click());
    expect(container.textContent).not.toContain("Verify in QA Studio");
    expect(button(container, "Move")).toBeUndefined();
    expect(container.textContent).not.toContain("Checklists");
  });

  it("shows loading, then the error state with a retry", async () => {
    repo.list.mockRejectedValueOnce(apiError(404)).mockResolvedValueOnce(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([]);
    const container = await renderExplorer();
    expect(container.textContent).toContain("Projects did not load");
    expect(container.textContent).toContain("This team's Projects are not available.");
    await act(async () => button(container, "Try again")!.click());
    await settle();
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });

  it("shows an empty state that lets a lead create the first Project", async () => {
    repo.list.mockResolvedValue(foldersSnapshot({ folders: [], unfiled: [] }));
    repo.listChecklists.mockResolvedValue([]);
    const container = await renderExplorer();
    expect(container.textContent).toContain("No Projects yet");
    await act(async () => button(container, "Create the first Project")!.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("New Project");
  });

  it("opens a Project: QA Studio, create-in-Project, move and checklists", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([
      folderChecklist(),
      folderChecklist({ id: "cl-2", name: "Accessibility pass", sharedProjectIds: [] }),
    ]);
    repo.updateChecklistShares.mockResolvedValue(folderChecklist({ id: "cl-2", name: "Accessibility pass" }));
    const container = await renderExplorer();
    await act(async () => manage(container, "testfinals")!.click());

    expect(container.querySelector(".pf-detail__title")?.textContent).toBe("testfinals");
    expect(link(container, "Verify in QA Studio")?.getAttribute("href")).toBe("/projects/proj-fe#qa");
    expect(link(container, "Create repository in this Project")?.getAttribute("href")).toBe(
      "/workflows?tab=setup&group=ws-1&project=dp-1",
    );
    expect(container.querySelector(".pf-checklists")?.textContent).toContain("Release smoke test");
    expect(container.querySelector(".pf-checklists")?.textContent).toContain("All repositories");

    const select = container.querySelector<HTMLSelectElement>(".pf-attach select")!;
    await act(async () => {
      select.value = "cl-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => button(container, "Attach to this Project")!.click());
    await settle();
    expect(repo.updateChecklistShares).toHaveBeenCalledWith("cl-2", { add: ["proj-fe", "proj-be"] });
    expect(container.querySelector(".pf-checklists")?.textContent).toContain("Accessibility pass");

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
    repo.listChecklists.mockResolvedValue([]);
    const container = await renderExplorer();
    await act(async () => button(container, "wallet")!.click());
    expect(container.querySelector(".pf-empty-folder")?.textContent).toContain("No repositories in this Project yet.");
    expect(container.textContent).toContain("Add a repository first.");
    expect(button(container, "Move")).toBeUndefined();
  });

  it("deletes a Project from the danger zone and returns to the list with a notice", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([]);
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
    repo.listChecklists.mockResolvedValue([]);
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
    repo.listChecklists.mockResolvedValue([]);
    const container = await renderExplorer();
    expect(container.querySelector("a.pf-card__open")?.getAttribute("href")).toBe("/projects/proj-be");
  });

  it("opens the deep-linked Project's detail on arrival", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([]);
    const container = await renderExplorer(true, "dp-1");
    expect(container.querySelector(".pf-detail__title")?.textContent).toBe("testfinals");
    await act(async () => button(container, "All Projects")!.click());
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });

  it("shows the list when the deep-linked Project is not in this team", async () => {
    repo.list.mockResolvedValue(foldersSnapshot());
    repo.listChecklists.mockResolvedValue([]);
    const container = await renderExplorer(true, "dp-elsewhere");
    expect(container.querySelector(".pf-detail__title")).toBeNull();
    expect(container.querySelectorAll("li.pf-card")).toHaveLength(2);
  });
});
