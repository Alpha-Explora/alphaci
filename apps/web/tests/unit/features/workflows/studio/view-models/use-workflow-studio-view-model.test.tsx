import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useSearchParams } from "next/navigation";

import { useWorkflowStudioViewModel } from "../../../../../../src/features/workflows/studio/view-models/use-workflow-studio-view-model";
import { createProject } from "../../../../../../src/features/projects";
import { discoverExistingRepo, generateWorkflow } from "../../../../../../src/features/workflows";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => new URLSearchParams()),
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

  it("starts on the current tab and switches via handleStudioTabChange", async () => {
    const get = await renderVm();
    expect(get()!.activeTab).toBe("current");
    act(() => get()!.handleStudioTabChange("setup"));
    expect(get()!.activeTab).toBe("setup");
  });

  it("deep-links to the setup tab from ?tab=setup", async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams("tab=setup"));
    const get = await renderVm();
    expect(get()!.activeTab).toBe("setup");
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
});
