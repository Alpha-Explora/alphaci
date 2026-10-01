import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useSearchParams } from "next/navigation";

import { useWorkflowStudioViewModel } from "../../../../../../src/features/workflows/studio/view-models/use-workflow-studio-view-model";
import { createProject } from "../../../../../../src/features/projects";
import { discoverExistingRepo, generateWorkflow } from "../../../../../../src/features/workflows";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: () => "/workflows",
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

jest.mock("../../../../../../src/features/projects", () => ({
  createProject: jest.fn(),
  setupProject: jest.fn(),
}));

jest.mock("../../../../../../src/features/workflows", () => ({
  discoverExistingRepo: jest.fn(),
  generateWorkflow: jest.fn(),
}));

jest.mock("../../../../../../src/features/workflows/studio/data/catalog-api", () => ({
  getCategories: jest.fn().mockResolvedValue({ categories: [] }),
  getTemplates: jest.fn().mockResolvedValue({ templates: [] }),
}));

jest.mock("../../../../../../src/features/workflows/studio/data/workflows-api", () => ({
  getWorkflowHistory: jest.fn().mockResolvedValue({ items: [] }),
}));

jest.mock("../../../../../../src/features/projects", () => ({
  createProject: jest.fn(),
  setupProject: jest.fn(),
  getProjects: jest.fn().mockResolvedValue({ items: [] }),
}));

jest.mock("../../../../../../src/features/workflows/studio/data/existing-repos-api", () => ({
  getExistingRepos: jest.fn().mockResolvedValue({ items: [] }),
}));

jest.mock("../../../../../../src/features/workflows/studio/data/github-api", () => ({
  getGithubAppInstallUrl: jest.fn().mockResolvedValue({ url: null, appSlug: null }),
  getGithubInstallationAccounts: jest.fn().mockResolvedValue({ accounts: [] }),
  getLinkedGithubRepos: jest.fn().mockResolvedValue({ repos: [] }),
  linkGithubInstallation: jest.fn(),
}));

jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: jest.fn(() => ({
    status: "ready",
    error: null,
    capabilities: {},
    deploymentOwnershipMode: "flowci_managed",
    envProvisioningEnabled: true,
  })),
}));

import { createProject as mockCreateProject } from "../../../../../../src/features/projects";

const mockedCreateProject = mockCreateProject as jest.MockedFunction<typeof createProject>;

describe("useWorkflowStudioViewModel", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    jest.clearAllMocks();
  });

  async function renderVm(props?: { guest?: boolean; session?: null }) {
    let snapshot: ReturnType<typeof useWorkflowStudioViewModel> | null = null;
    function Probe() {
      /* A probe component exists to hand the hook's return value back to the
       * test — the one shape this rule cannot model, since the write IS the
       * assertion and there is no effect to move it into. */
      // eslint-disable-next-line react-hooks/globals
      snapshot = useWorkflowStudioViewModel({
        guest: props?.guest ?? false,
        session: props?.session ?? null,
      });
      return null;
    }
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root!.render(<Probe />);
    });
    // Flush the initial data loads (catalog, history, projects) so their state
    // updates settle inside act before assertions run.
    await act(async () => {
      await Promise.resolve();
    });
    return () => snapshot;
  }

  function renderVmSync(props?: { guest?: boolean; session?: null }) {
    let snapshot: ReturnType<typeof useWorkflowStudioViewModel> | null = null;
    function Probe() {
      // See renderVm above — same probe pattern, same reason.
      // eslint-disable-next-line react-hooks/globals
      snapshot = useWorkflowStudioViewModel({
        guest: props?.guest ?? false,
        session: props?.session ?? null,
      });
      return null;
    }
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root!.render(<Probe />);
    });
    return () => snapshot;
  }

  it("starts on the projects view and opens the create view", async () => {
    const get = await renderVm();
    expect(get()!.activeView).toBe("current");
    act(() => get()!.openIndividualSetup());
    expect(get()!.activeView).toBe("setup");
    // No Developer here (no session), so there is no Project to choose.
    expect(get()!.projectChoice).toBeNull();
  });

  it("deep-links to the create view from ?tab=setup", async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams("tab=setup"));
    const get = await renderVm();
    expect(get()!.activeView).toBe("setup");
  });

  it("goes back to the projects view and strips ?tab, keeping the other params", async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams("tab=setup&group=workspace-2"),
    );
    const get = await renderVm();
    act(() => get()!.showProjects());
    expect(get()!.activeView).toBe("current");
    expect(mockReplace).toHaveBeenCalledWith("/workflows?group=workspace-2", {
      scroll: false,
    });
  });

  it("leaves the URL alone going back when there is no ?tab", async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    const get = await renderVm();
    act(() => get()!.openIndividualSetup());
    act(() => get()!.showProjects());
    expect(get()!.activeView).toBe("current");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("surfaces a validation message when project creation payload is incomplete", async () => {
    const get = await renderVm();
    await act(async () => {
      await get()!.handleCreateProject();
    });
    expect(get()!.statusMessage).toBeTruthy();
    expect(mockedCreateProject).not.toHaveBeenCalled();
  });

  it("blocks discovery when no repository is chosen", async () => {
    const get = await renderVm();
    await act(async () => {
      await get()!.handleDiscoverExistingRepo();
    });
    expect(get()!.statusMessage).toContain("Choose a linked repository");
    expect(discoverExistingRepo).not.toHaveBeenCalled();
  });

  it("blocks workflow generation without a service name", async () => {
    const get = await renderVm();
    await act(async () => {
      await get()!.handleGenerateWorkflow();
    });
    expect(get()!.statusMessage).toContain("Enter a service name");
    expect(generateWorkflow).not.toHaveBeenCalled();
  });

  it("omits baseBranch on discovery when none is typed", async () => {
    (discoverExistingRepo as jest.Mock).mockResolvedValue({
      repoFullName: "tone/app",
      baseBranch: "dev",
      detectedProjectTypeId: null,
      recommendedWorkflowRecipeId: "x",
    });
    const get = await renderVm();
    act(() => get()!.setExistingRepoFullName("tone/app"));
    await act(async () => {
      await get()!.handleDiscoverExistingRepo();
    });
    expect(discoverExistingRepo).toHaveBeenCalledWith({ repoFullName: "tone/app" });
  });

  it("sends baseBranch when one is typed", async () => {
    (discoverExistingRepo as jest.Mock).mockResolvedValue({
      repoFullName: "tone/app",
      baseBranch: "uat",
      detectedProjectTypeId: null,
      recommendedWorkflowRecipeId: "x",
    });
    const get = await renderVm();
    act(() => get()!.setExistingRepoFullName("tone/app"));
    act(() => get()!.setExistingRepoBaseBranch(" uat "));
    await act(async () => {
      await get()!.handleDiscoverExistingRepo();
    });
    expect(discoverExistingRepo).toHaveBeenCalledWith({
      repoFullName: "tone/app",
      baseBranch: "uat",
    });
  });

  it("maps a role refusal on discovery to its sentence", async () => {
    const { ApiError } = jest.requireActual("../../../../../../src/shared/api/request");
    (discoverExistingRepo as jest.Mock).mockRejectedValue(
      new ApiError("Request failed with status 403", 403, {
        code: "REPO_NOT_ACCESSIBLE",
        message: "x",
      }),
    );
    const get = await renderVm();
    act(() => get()!.setExistingRepoFullName("tone/app"));
    await act(async () => {
      await get()!.handleDiscoverExistingRepo();
    });
    expect(get()!.statusMessage).toContain("cannot access that repository");
  });
});
