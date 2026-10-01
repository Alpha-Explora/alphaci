import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkflowBuilder } from "../../src/features/workflows/studio/views/workflow-builder";
import { WorkspaceProvider } from "../../src/features/workspace/selection/views/workspace-selection-context";
import {
  createProject,
  createGithubRepo,
  generateWorkflow,
  getCapabilities,
  getCategories,
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getMyUsage,
  getProjectOptions,
  getProjects,
  getTemplates,
  getWorkflowHistory,
  listProviderConnections,
  getMyWorkspaces,
} from "../support/api-client";
import type { ProjectOptionsResponse } from "../../src/shared/api/contracts";
import { ApiError } from "../../src/shared/api/request";

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react");
  const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const motion = new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
          const domProps = { ...props };
          for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "whileInView", "viewport", "variants", "layout", "layoutId"]) {
            delete domProps[key];
          }

          return React.createElement("div", domProps, children);
        },
    },
  );

  return {
    AnimatePresence: passthrough,
    MotionConfig: passthrough,
    motion,
    useReducedMotion: () => false,
  };
});

// The view-models read the query string (?tab=setup, ?group=) and write the
// chosen group back with router.replace. `mockSearch` is the page's query.
let mockSearch = "";
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => "/workflows",
  useRouter: () => ({
    push: () => undefined,
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock("../../src/features/projects/detail/data/projects-api", () => ({
  createProject: jest.fn(),
  setupProject: jest.fn(),
  getProjects: jest.fn(),
}));
jest.mock("../../src/features/workflows/studio/data/existing-repos-api", () => ({
  discoverExistingRepo: jest.fn(),
}));
jest.mock("../../src/features/workflows/studio/data/workflows-api", () => ({
  generateWorkflow: jest.fn(),
  getWorkflowHistory: jest.fn(),
}));
jest.mock("../../src/features/workflows/studio/data/catalog-api", () => ({
  getCategories: jest.fn(),
  getProjectOptions: jest.fn(),
  getTemplates: jest.fn(),
}));
jest.mock("../../src/features/workflows/studio/data/github-api", () => ({
  createGithubRepo: jest.fn(),
  getGithubInstallationAccounts: jest.fn(),
  getGithubAppInstallUrl: jest.fn(),
  getLinkedGithubRepos: jest.fn(),
}));
jest.mock("../../src/features/workflows/studio/data/env-provisioning-api", () => ({
  listProviderConnections: jest.fn(),
}));
jest.mock("../../src/features/capabilities/current/data/capabilities-api", () => ({
  getCapabilities: jest.fn(),
}));
jest.mock("../../src/features/projects/detail/data/usage-api", () => ({
  getMyUsage: jest.fn(),
}));
jest.mock("../../src/features/groups/data/hierarchy-api", () => ({
  getGroups: jest.fn().mockResolvedValue([]),
  getDeliveryProject: jest.fn(),
}));

// Every project belongs to a team, so the Setup tab has to name one. Default to
// a single team: that is the unambiguous case, and it keeps every pre-existing
// test in this file on the path where nothing has to be chosen.
jest.mock("../../src/features/workspace/selection/data/workspaces-api", () => ({
  getMyWorkspaces: jest.fn(),
}));

const mockedGetGroups = (
  jest.requireMock("../../src/features/groups/data/hierarchy-api") as {
    getGroups: jest.Mock;
  }
).getGroups;
const mockedGetDeliveryProject = (
  jest.requireMock("../../src/features/groups/data/hierarchy-api") as {
    getDeliveryProject: jest.Mock;
  }
).getDeliveryProject;
const mockedSetupProject = (
  jest.requireMock("../../src/features/projects/detail/data/projects-api") as {
    setupProject: jest.Mock;
  }
).setupProject;
const mockedCreateProject = createProject as jest.MockedFunction<typeof createProject>;
const mockedCreateGithubRepo = createGithubRepo as jest.MockedFunction<typeof createGithubRepo>;
const mockedGenerateWorkflow = generateWorkflow as jest.MockedFunction<typeof generateWorkflow>;
const mockedGetCapabilities = getCapabilities as jest.MockedFunction<typeof getCapabilities>;
const mockedGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockedGetGithubInstallationAccounts = getGithubInstallationAccounts as jest.MockedFunction<
  typeof getGithubInstallationAccounts
>;
const mockedGetGithubAppInstallUrl = getGithubAppInstallUrl as jest.MockedFunction<
  typeof getGithubAppInstallUrl
>;
const mockedGetLinkedGithubRepos = getLinkedGithubRepos as jest.MockedFunction<
  typeof getLinkedGithubRepos
>;
const mockedGetMyUsage = getMyUsage as jest.MockedFunction<typeof getMyUsage>;
const mockedGetMyWorkspaces = getMyWorkspaces as jest.MockedFunction<
  typeof getMyWorkspaces
>;
const mockedGetProjectOptions = getProjectOptions as jest.MockedFunction<typeof getProjectOptions>;
const mockedGetProjects = getProjects as jest.MockedFunction<typeof getProjects>;
const mockedGetTemplates = getTemplates as jest.MockedFunction<typeof getTemplates>;
const mockedGetWorkflowHistory = getWorkflowHistory as jest.MockedFunction<
  typeof getWorkflowHistory
>;
const mockedListProviderConnections = listProviderConnections as jest.MockedFunction<
  typeof listProviderConnections
>;

const template = {
  id: "frontend-react",
  name: "React CI",
  description: "Run React checks.",
  iconName: "react",
  categories: ["frontend"],
  filePatterns: ["package.json"],
  stack: "react" as const,
  propertiesPath: "workflow-templates/frontend-react.properties.yml",
  workflowPath: "workflow-templates/frontend-react.yml",
};

const projectOptions = {
  nodeVersions: [
    { value: "20", label: "Node.js 20 LTS" },
    { value: "24", label: "Node.js 24 Current" },
  ],
  repoShapes: [
    {
      id: "single-app",
      label: "Single App",
      enabled: true,
      description: "One repository contains one app or service.",
    },
    {
      id: "monorepo",
      label: "Monorepo",
      enabled: false,
      description: "Reserved for later.",
    },
  ],
  projectTypes: [
    {
      id: "nextjs-app",
      label: "Next.js App",
      kind: "frontend",
      runtime: "node",
      language: "typescript",
      framework: "nextjs",
      starterPath: "starter-templates/nextjs-app",
      repoShapes: ["single-app"],
      defaultRecipe: "frontend-standard-ci",
      allowedRecipes: ["frontend-standard-ci"],
      defaultOptions: {
        lint: true,
        unit: true,
        build: true,
        coverage: true,
        security: true,
        docker: false,
      },
    },
    {
      id: "nestjs-api",
      label: "NestJS API",
      kind: "backend",
      runtime: "node",
      language: "typescript",
      framework: "nestjs",
      starterPath: "starter-templates/nestjs-api",
      repoShapes: ["single-app"],
      defaultRecipe: "backend-api-ci",
      allowedRecipes: ["backend-api-ci"],
      defaultOptions: {
        lint: true,
        unit: true,
        build: false,
        coverage: true,
        security: true,
        docker: false,
      },
    },
  ],
  recipes: [
    {
      id: "frontend-standard-ci",
      label: "Frontend Standard CI",
      description: "Validate and build frontend apps.",
      supportedProjectTypes: ["nextjs-app"],
      templateByProjectType: { "nextjs-app": "fe-nextjs" },
      mandatoryJobs: ["validate-access"],
      supportedOptions: {
        lint: true,
        unit: true,
        build: true,
        coverage: true,
        security: true,
        docker: false,
      },
      optionJobs: {
        lint: "lint",
        unit: "unit-tests",
        build: "build",
        coverage: "unit-tests",
        security: "security",
      },
    },
    {
      id: "backend-api-ci",
      label: "Backend API CI",
      description: "Validate and test backend APIs.",
      supportedProjectTypes: ["nestjs-api"],
      templateByProjectType: { "nestjs-api": "be-nestjs" },
      mandatoryJobs: ["validate-access"],
      supportedOptions: {
        lint: true,
        unit: true,
        build: false,
        coverage: true,
        security: true,
        docker: true,
      },
      optionJobs: {
        lint: "lint",
        unit: "unit-tests",
        coverage: "unit-tests",
        security: "security",
        docker: "docker",
      },
    },
  ],
};

const stagedWorkflowFiles = [
  {
    stage: "access" as const,
    name: "ALPHACI Access Gate",
    path: ".github/workflows/00-alphaci-access.yml",
    gated: true,
  },
  {
    stage: "quality" as const,
    name: "ALPHACI Quality",
    path: ".github/workflows/10-alphaci-quality.yml",
    gated: true,
  },
  {
    stage: "package" as const,
    name: "ALPHACI Package",
    path: ".github/workflows/20-alphaci-package.yml",
    gated: true,
  },
];

async function flushMicrotasks(cycles = 1) {
  for (let index = 0; index < cycles; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function waitForCondition(condition: () => boolean, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) {
      return;
    }

    await flushMicrotasks();
  }

  throw new Error("Condition not met in time.");
}

function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      "value",
    );
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("WorkflowBuilder project setup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockSearch = "";
    mockedGetGroups.mockResolvedValue([]);
    mockedGetCapabilities.mockResolvedValue({
      envProvisioning: {
        enabled: true,
        providers: ["render", "vercel"],
        environments: ["test", "uat", "production"],
        modes: ["flowci_managed", "byo"],
      },
    });
    mockedGetMyWorkspaces.mockResolvedValue({
      enabled: true,
      items: [
        { id: "workspace-1", name: "Platform", kind: "team", role: "admin" },
      ],
    });
    mockedGetCategories.mockResolvedValue({ categories: [] });
    mockedGetTemplates.mockResolvedValue({ templates: [template] });
    mockedGetWorkflowHistory.mockResolvedValue({ items: [] });
    mockedGetProjects.mockResolvedValue({ items: [] });
    mockedListProviderConnections.mockResolvedValue([]);
    mockedGetGithubAppInstallUrl.mockResolvedValue({
      installUrl: "https://github.com/apps/cicd-example/installations/new",
      appSlug: "cicd-example",
    });
    mockedGetGithubInstallationAccounts.mockResolvedValue({
      accounts: [
        {
          installationId: 12345,
          accountLogin: "tone",
          accountId: 999,
          repositorySelection: "all",
        },
      ],
    });
    mockedGetLinkedGithubRepos.mockResolvedValue({
      repos: [{ installationId: 12345, repoFullName: "tone/example-app" }],
    });
    mockedGetMyUsage.mockResolvedValue({
      enabled: true,
      plan: "free",
      items: [
        { code: "projects", current: 0, limit: 5, upgradeRequired: false },
        { code: "env_keys", current: 0, limit: 25, upgradeRequired: false },
      ],
    });
    mockedGetProjectOptions.mockResolvedValue(projectOptions as unknown as ProjectOptionsResponse);
    mockedCreateGithubRepo.mockResolvedValue({
      repoUrl: "https://github.com/tone/demo-next-app",
      cloneUrl: "https://github.com/tone/demo-next-app.git",
      defaultBranch: "main",
      branchesCreated: ["main", "uat", "develop"],
    });
    mockedCreateProject.mockResolvedValue({
      id: "project-1",
      repoFullName: "tone/demo-next-app",
      repoUrl: "https://github.com/tone/demo-next-app",
      status: "provisioned",
      workflowPath: ".github/workflows/00-alphaci-access.yml",
      workflowFiles: stagedWorkflowFiles,
      githubCommitSha: "commit-sha",
      githubCommitUrl: "https://github.com/tone/demo-next-app/commit/commit-sha",
      projectTypeId: "nextjs-app",
      workflowRecipeId: "frontend-standard-ci",
    });
    mockedGenerateWorkflow.mockResolvedValue({
      yaml: "name: CI\non: push",
      metadata: {
        templateId: "frontend-react",
        templateName: "React CI",
        stack: "react",
        generatedAt: "2026-06-02T00:00:00.000Z",
        sha256: "abc123",
        byteSize: 512,
        lineCount: 40,
        substitutionsApplied: [],
        enhancementsApplied: [],
        sourcePropertiesFile: "workflow-templates/frontend-react.properties.yml",
        sourceWorkflowFile: "workflow-templates/frontend-react.yml",
        outputFileName: "ci.yml",
      },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  function leadSession(appRole: "admin" | "lead" | "qa" | "member") {
    return { appRole } as unknown as NonNullable<
      React.ComponentProps<typeof WorkflowBuilder>["session"]
    >;
  }

  async function renderBuilder(appRole: "admin" | "lead" | "qa" | "member" = "lead") {
    await act(async () => {
      root.render(
        <WorkflowBuilder
          login="tone"
          plan="pro"
          session={leadSession(appRole)}
        />,
      );
    });

    // The projects view is the default — open the create view the way a
    // person does, with the heading row's "Create project" button.
    await clickCreateProjectButton();

    await waitForCondition(() => container.textContent?.includes("Next.js App") ?? false);
  }

  function createProjectButton(): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(
      "[data-testid='create-project-button']",
    );
  }

  async function clickCreateProjectButton() {
    await waitForCondition(() => createProjectButton() !== null);
    await act(async () => {
      createProjectButton()?.click();
    });
  }

  function findButton(startsWith: string): HTMLButtonElement | null {
    return (
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.trim().startsWith(startsWith),
      ) ?? null
    );
  }

  async function clickContinue() {
    await act(async () => {
      findButton("Continue")?.click();
      await Promise.resolve();
    });
  }

  /**
   * Walks Blueprint -> Repository -> Automation -> Delivery -> Review.
   *
   * Setup became a FIVE-STEP WIZARD that renders one step at a time, so the
   * create button exists only on the last step and each field lives on the step
   * that owns it. These tests used to render and immediately reach for both,
   * which is why all five timed out waiting for a button four Continues away.
   */
  async function advanceToStep(
    stopAt: number,
    values: { projectTypeId?: string; repoName?: string; projectName?: string | null } = {},
  ) {
    if (values.projectTypeId) {
      const select =
        container.querySelector<HTMLSelectElement>("#project-type-select");
      if (select) changeValue(select, values.projectTypeId);
    }
    if (stopAt === 0) return;
    await clickContinue();

    // The Project name is required; a link into an existing Project shows a
    // read-only line instead, so there is no input to fill then.
    const projectNameInput = container.querySelector<HTMLInputElement>("#project-name");
    if (projectNameInput && values.projectName !== null) {
      changeValue(projectNameInput, values.projectName ?? "Checkout platform");
    }
    if (values.repoName) {
      const input = container.querySelector<HTMLInputElement>("#repo-name");
      if (input) changeValue(input, values.repoName);
    }
    for (let step = 1; step < stopAt; step += 1) {
      await clickContinue();
    }
  }

  async function advanceToReview(
    values: { projectTypeId?: string; repoName?: string; projectName?: string | null } = {},
  ) {
    await advanceToStep(4, values);
    await waitForCondition(
      () =>
        container.querySelector<HTMLButtonElement>(
          "[data-testid='setup-project-button']",
        ) !== null,
    );
  }

  it("creates a new project through the backend project endpoint", async () => {
    await renderBuilder();

    await advanceToReview({
      projectTypeId: "nextjs-app",
      repoName: "demo-next-app",
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(
      () => container.textContent?.includes("tone/demo-next-app") ?? false,
    );

    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: "demo-next-app",
        visibility: "private",
        repoShape: "single-app",
        projectTypeId: "nextjs-app",
        workflowRecipeId: "frontend-standard-ci",
        serviceName: "demo-next-app",
        outputFileName: "ci.yml",
        projectName: "Checkout platform",
      }),
    );
    expect(mockedCreateGithubRepo).not.toHaveBeenCalled();
    expect(mockedGenerateWorkflow).not.toHaveBeenCalled();
    expect(container.textContent).toContain("tone/demo-next-app");
    expect(container.textContent).toContain("00-alphaci-access.yml");
    expect(container.textContent).toContain("ALPHACI Access Gate");
    expect(container.textContent).toContain("10-alphaci-quality.yml");
    expect(container.textContent).toContain("20-alphaci-package.yml");
    expect(container.textContent).toContain("3 gated workflow stages");
  });

  /* A project always belongs to a team. With one team there is nothing to
   * choose, so the create carries it without asking. */
  it("sends the caller's only team with the created project", async () => {
    await renderBuilder();

    await advanceToReview({
      projectTypeId: "nextjs-app",
      repoName: "demo-next-app",
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")
        ?.click();
      await Promise.resolve();
    });

    await waitForCondition(
      () => container.textContent?.includes("tone/demo-next-app") ?? false,
    );

    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-1" }),
    );
  });

  /* With several teams the choice is the caller's, not a sort order's. Creating
   * used to send nothing here and let the server take the caller's oldest
   * workspace — reliably the personal one, invisible to every teammate. */
  it("blocks creation until a team is chosen when the caller has several", async () => {
    mockedGetMyWorkspaces.mockResolvedValue({
      enabled: true,
      items: [
        { id: "workspace-1", name: "Platform", kind: "team", role: "admin" },
        { id: "workspace-2", name: "Payments", kind: "team", role: "member" },
      ],
    });
    await renderBuilder();

    await advanceToReview({
      projectTypeId: "nextjs-app",
      repoName: "demo-next-app",
    });

    const createButton = container.querySelector<HTMLButtonElement>(
      "[data-testid='setup-project-button']",
    );
    expect(createButton?.disabled).toBe(true);

    const teamSelect = container.querySelector<HTMLSelectElement>(
      "[data-testid='setup-workspace-select']",
    );
    expect(teamSelect).not.toBeNull();
    await act(async () => {
      changeValue(teamSelect as HTMLSelectElement, "workspace-2");
      await Promise.resolve();
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")
        ?.click();
      await Promise.resolve();
    });

    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-2" }),
    );
  });

  it("shows project quota and disables repository creation when the limit is reached", async () => {
    mockedGetMyUsage.mockResolvedValueOnce({
      enabled: true,
      plan: "free",
      items: [
        { code: "projects", current: 5, limit: 5, upgradeRequired: true },
        { code: "env_keys", current: 0, limit: 25, upgradeRequired: false },
      ],
    });

    await renderBuilder();

    // The quota notice sits on the DELIVERY step (3), not on Blueprint where
    // this used to look for it and not on Review either.
    await advanceToStep(3, {
      projectTypeId: "nextjs-app",
      repoName: "demo-next-app",
    });
    expect(container.textContent).toContain("Project quota:");

    // And the create button on Review stays disabled once the limit is hit.
    await clickContinue();
    expect(
      container.querySelector<HTMLButtonElement>(
        "[data-testid='setup-project-button']",
      )?.disabled,
    ).toBe(true);
  });

  it("shows a create project error when createProject rejects", async () => {
    mockedCreateProject.mockRejectedValueOnce({
      details: {
        message:
          'Repository already exists or name is invalid: {"message":"Repository creation failed.","errors":[{"resource":"Repository","code":"custom","field":"name","message":"name already exists on this account"}],"documentation_url":"https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user","status":"422"}',
      },
    });

    await renderBuilder();

    await advanceToReview({
      projectTypeId: "nextjs-app",
      repoName: "demo-next-app",
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(() => container.textContent?.includes("Project creation failed") ?? false);

    expect(container.textContent).toContain(
      "A repository with this name already exists on this GitHub account. Choose another repository name and try again.",
    );
    expect(container.textContent).not.toContain("documentation_url");
    expect(mockedCreateGithubRepo).not.toHaveBeenCalled();
  });

  it("includes hosting provisioning in project creation when enabled", async () => {
    mockedCreateProject.mockResolvedValueOnce({
      id: "project-1",
      repoFullName: "tone/orders-api",
      repoUrl: "https://github.com/tone/orders-api",
      status: "provisioned",
      workflowPath: ".github/workflows/00-alphaci-access.yml",
      workflowFiles: stagedWorkflowFiles,
      githubCommitSha: "commit-sha",
      githubCommitUrl: "https://github.com/tone/orders-api/commit/commit-sha",
      projectTypeId: "nestjs-api",
      workflowRecipeId: "backend-api-ci",
    });

    await renderBuilder();

    // Hosting is configured on the DELIVERY step (3); Review only summarises it.
    await advanceToStep(3, {
      projectTypeId: "nextjs-app",
      repoName: "orders-api",
    });

    expect(container.textContent).toContain("Deployment provisioning");
    const provisioningToggle = container.querySelector<HTMLInputElement>(
      "input[aria-label='Provision deployment target']",
    );
    expect(provisioningToggle).not.toBeNull();

    act(() => {
      provisioningToggle!.click();
    });

    await clickContinue();
    await waitForCondition(
      () =>
        container.querySelector<HTMLButtonElement>(
          "[data-testid='setup-project-button']",
        ) !== null,
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(() => container.textContent?.includes("tone/orders-api") ?? false);

    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentProvisioning: expect.objectContaining({
          enabled: true,
          targets: [
            expect.objectContaining({
              provider: "vercel",
              slot: "frontend",
              projectName: "orders-api",
              branchName: "uat",
            }),
          ],
        }),
      }),
    );
    // Back on the projects view, with the create result banner on top.
    expect(container.textContent).toContain("Project Created Successfully");
    expect(createProjectButton()).not.toBeNull();
  });

  /*
   * The guard MOVED EARLIER. This used to assert a disabled create button on a
   * single long form; the wizard now refuses to leave the Repository step
   * without a name, so the create button is never reached at all. Asserting
   * Continue is blocked is the same protection one step sooner — and it is a
   * stronger check, because it fails before anything downstream is filled in.
   */
  it("will not leave the Repository step while the repo name is empty", async () => {
    await renderBuilder();

    const select =
      container.querySelector<HTMLSelectElement>("#project-type-select");
    if (select) changeValue(select, "nextjs-app");
    await clickContinue();

    // On Repository now, with the name deliberately left blank.
    expect(container.querySelector("#repo-name")).not.toBeNull();
    expect(findButton("Continue")).toBeDisabled();

    await clickContinue();

    // Still on Repository — Review was never reached, so nothing was created.
    expect(container.querySelector("#repo-name")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='setup-project-button']"),
    ).toBeNull();
    expect(mockedCreateGithubRepo).not.toHaveBeenCalled();
    expect(mockedCreateProject).not.toHaveBeenCalled();
  });

  it.each(["member", "qa"] as const)(
    "offers %s no Create project button on the projects view",
    async (role) => {
      await act(async () => {
        root.render(
          <WorkflowBuilder login="tone" plan="pro" session={leadSession(role)} />,
        );
      });
      await waitForCondition(
        () => container.textContent?.includes("No groups or projects yet.") ?? false,
      );
      expect(createProjectButton()).toBeNull();
      expect(container.textContent).not.toContain("Create project");
    },
  );

  it.each(["member", "qa"] as const)(
    "replaces the create and onboard controls with a note for %s",
    async (role) => {
      // No button to click for these roles, so arrive by the deep link.
      mockSearch = "tab=setup";
      await act(async () => {
        root.render(
          <WorkflowBuilder login="tone" plan="pro" session={leadSession(role)} />,
        );
      });
      await waitForCondition(
        () =>
          container.textContent?.includes(
            "A Team lead or admin can create repositories",
          ) ?? false,
      );
      expect(container.querySelector("#project-type-select")).toBeNull();
      expect(findButton("Existing repository")).toBeNull();
    },
  );

  it.each(["lead", "admin"] as const)(
    "shows the create wizard for %s",
    async (role) => {
      await renderBuilder(role);
      expect(container.querySelector("#project-type-select")).not.toBeNull();
      expect(container.textContent).not.toContain(
        "A Team lead or admin can create repositories",
      );
    },
  );

  /* About ten places link to /workflows?tab=setup, some with &group=<id>
   * (home, the `n` shortcut, /teams, group pages). The tab bar is gone, so
   * the link is now the only way those arrive on the create view. */
  it("opens the create view from ?tab=setup&group= with that team preselected", async () => {
    mockedGetMyWorkspaces.mockResolvedValue({
      enabled: true,
      items: [
        { id: "workspace-1", name: "Platform", kind: "team", role: "admin" },
        { id: "workspace-2", name: "Payments", kind: "team", role: "member" },
      ],
    });
    mockSearch = "tab=setup&group=workspace-2";
    await act(async () => {
      root.render(
        <WorkflowBuilder login="tone" plan="pro" session={leadSession("lead")} />,
      );
    });

    await waitForCondition(() => container.textContent?.includes("Next.js App") ?? false);
    expect(container.querySelector("h1")?.textContent).toBe("Create project");
    expect(createProjectButton()).toBeNull();

    await advanceToReview({ projectTypeId: "nextjs-app", repoName: "demo-next-app" });
    expect(
      container.querySelector<HTMLSelectElement>("[data-testid='setup-workspace-select']")
        ?.value,
    ).toBe("workspace-2");
  });

  it("returns to the projects view from Back to projects and drops ?tab", async () => {
    mockSearch = "tab=setup";
    await act(async () => {
      root.render(
        <WorkflowBuilder login="tone" plan="pro" session={leadSession("lead")} />,
      );
    });
    await waitForCondition(() => findButton("Back to projects") !== null);

    await act(async () => {
      findButton("Back to projects")?.click();
    });

    await waitForCondition(() => createProjectButton() !== null);
    expect(container.querySelector("#project-type-select")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/workflows", { scroll: false });
  });

  /* The heading's Create project carries the group on screen into the form,
   * so the person does not pick the same team twice. */
  /* The projects view has no team picker: it shows the HEADER's team, which a
   * ?group= link seeds (WorkflowStudioView hands it to WorkspaceProvider).
   * "Create project" then preselects that same team. */
  it("preselects the header's team, shown on the projects view, in the create form", async () => {
    mockedGetMyWorkspaces.mockResolvedValue({
      enabled: true,
      items: [
        { id: "workspace-1", name: "Platform", kind: "team", role: "admin" },
        { id: "workspace-2", name: "Payments", kind: "team", role: "member" },
      ],
    });
    mockedGetGroups.mockResolvedValue([
      { id: "workspace-1", name: "Platform", description: null, status: "active" },
      { id: "workspace-2", name: "Payments", description: null, status: "active" },
    ]);
    await act(async () => {
      root.render(
        <WorkspaceProvider initialWorkspaceId="workspace-2">
          <WorkflowBuilder login="tone" plan="pro" session={leadSession("admin")} />
        </WorkspaceProvider>,
      );
    });
    await waitForCondition(
      () => container.querySelector("h1")?.textContent?.startsWith("Projects") ?? false,
    );
    expect(container.querySelector("[aria-haspopup='listbox']")).toBeNull();

    await clickCreateProjectButton();
    await waitForCondition(() => container.textContent?.includes("Next.js App") ?? false);
    await advanceToReview({ projectTypeId: "nextjs-app", repoName: "demo-next-app" });

    expect(
      container.querySelector<HTMLSelectElement>("[data-testid='setup-workspace-select']")
        ?.value,
    ).toBe("workspace-2");
  });

  describe("Project name", () => {
    async function openRepositoryStep() {
      await renderBuilder();
      const select = container.querySelector<HTMLSelectElement>("#project-type-select");
      if (select) changeValue(select, "nextjs-app");
      await clickContinue();
    }

    async function clickCreate() {
      await act(async () => {
        container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
        await Promise.resolve();
      });
    }

    // The suite's framer-motion mock hands out a new component per render, so
    // the step remounts on every state change: always re-query, never hold a node.
    function projectNameInput(): HTMLInputElement {
      return container.querySelector<HTMLInputElement>("#project-name")!;
    }

    function repoNameInput(): HTMLInputElement {
      return container.querySelector<HTMLInputElement>("#repo-name")!;
    }

    function reviewValue(label: string): string | null | undefined {
      const rows = Array.from(container.querySelectorAll(".repo-wizard-review__grid > div"));
      const row = rows.find((candidate) => candidate.querySelector("dt")?.textContent === label);
      return row?.querySelector("dd")?.textContent;
    }

    it("asks for it first on the Repository step, independent of the repository name", async () => {
      await openRepositoryStep();

      expect(projectNameInput()).not.toBeNull();
      expect(projectNameInput().required).toBe(true);
      expect(container.textContent).toContain(
        "The name your team sees on Teams → Projects. It can differ from the repository names.",
      );
      // Above the repository name in the document.
      expect(
        projectNameInput().compareDocumentPosition(repoNameInput()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // Typing a repository name neither fills nor unblocks the Project name.
      changeValue(repoNameInput(), "demo-next-app");
      expect(projectNameInput().value).toBe("");
      expect(findButton("Continue")).toBeDisabled();

      changeValue(projectNameInput(), "Checkout platform");
      expect(findButton("Continue")).not.toBeDisabled();
      // ...and editing the repository name later never overwrites it.
      changeValue(repoNameInput(), "other-repo");
      expect(projectNameInput().value).toBe("Checkout platform");
    });

    it("keeps Continue disabled for a blank or over-long name and says why", async () => {
      await openRepositoryStep();
      changeValue(repoNameInput(), "demo-next-app");

      changeValue(projectNameInput(), "   ");
      expect(findButton("Continue")).toBeDisabled();

      changeValue(projectNameInput(), "x".repeat(81));
      expect(findButton("Continue")).toBeDisabled();
      expect(
        container.querySelector("[data-testid='setup-project-name-error']")?.textContent,
      ).toContain("80 characters or fewer");
      expect(projectNameInput().getAttribute("aria-invalid")).toBe("true");

      changeValue(projectNameInput(), "x".repeat(80));
      expect(findButton("Continue")).not.toBeDisabled();
    });

    it("shows it on Review and sends it trimmed", async () => {
      await renderBuilder();
      await advanceToReview({
        projectTypeId: "nextjs-app",
        repoName: "demo-next-app",
        projectName: "  Checkout platform  ",
      });

      expect(reviewValue("Project")).toBe("Checkout platform");

      await clickCreate();
      expect(mockedCreateProject).toHaveBeenCalledTimes(1);
      const sent = mockedCreateProject.mock.calls[0][0];
      expect(sent.projectName).toBe("Checkout platform");
      expect(sent).not.toHaveProperty("deliveryProjectId");
    });

    it("maps a 409 PROJECT_NAME_TAKEN to the field and returns to the Repository step", async () => {
      mockedCreateProject.mockRejectedValueOnce(
        new ApiError("Request failed with status 409", 409, {
          statusCode: 409,
          code: "PROJECT_NAME_TAKEN",
          message: "A project named Checkout platform already exists.",
        }),
      );
      await renderBuilder();
      await advanceToReview({ projectTypeId: "nextjs-app", repoName: "demo-next-app" });
      await clickCreate();

      await waitForCondition(() => container.querySelector("#project-name") !== null);
      const error = container.querySelector("[data-testid='setup-project-name-error']");
      expect(error?.textContent).toBe(
        "A Project with this name already exists in this team. Choose another name.",
      );
      expect(container.querySelector("#project-name")?.getAttribute("aria-invalid")).toBe("true");
      // Back on the Repository step, and it cannot be continued with the same name.
      expect(container.querySelector("#repo-name")).not.toBeNull();
      expect(container.querySelector("[data-testid='setup-project-button']")).toBeNull();
      expect(findButton("Continue")).toBeDisabled();

      // Another name clears the refusal and unblocks the step.
      changeValue(projectNameInput(), "Checkout platform 2");
      expect(container.querySelector("[data-testid='setup-project-name-error']")).toBeNull();
      expect(findButton("Continue")).not.toBeDisabled();
    });

    describe("on the Existing repository path", () => {
      async function openExistingMode() {
        await renderBuilder();
        await act(async () => {
          findButton("Existing repository")?.click();
        });
        await waitForCondition(() => container.querySelector("#existing-repo-select") !== null);
      }

      it("asks for the name, blocks Set up CI/CD until it is valid, and sends it", async () => {
        mockedSetupProject.mockResolvedValue({
          id: "project-9",
          repoFullName: "tone/example-app",
          repoUrl: "https://github.com/tone/example-app",
          workflowPath: ".github/workflows/ci.yml",
        });
        await openExistingMode();
        expect(projectNameInput()).not.toBeNull();

        changeValue(
          container.querySelector<HTMLSelectElement>("#existing-repo-select")!,
          "tone/example-app",
        );
        expect(findButton("Set up CI/CD")).toBeDisabled();

        changeValue(projectNameInput(), "  Loyalty app ");
        expect(findButton("Set up CI/CD")).not.toBeDisabled();

        await act(async () => {
          findButton("Set up CI/CD")?.click();
          await Promise.resolve();
        });
        expect(mockedSetupProject).toHaveBeenCalledWith(
          expect.objectContaining({ repoFullName: "tone/example-app", projectName: "Loyalty app" }),
        );
      });

      it("shows a name already taken on the field", async () => {
        mockedSetupProject.mockRejectedValueOnce(
          new ApiError("Request failed with status 409", 409, { code: "PROJECT_NAME_TAKEN" }),
        );
        await openExistingMode();
        changeValue(
          container.querySelector<HTMLSelectElement>("#existing-repo-select")!,
          "tone/example-app",
        );
        changeValue(projectNameInput(), "Loyalty app");
        await act(async () => {
          findButton("Set up CI/CD")?.click();
          await Promise.resolve();
        });
        await waitForCondition(
          () => container.querySelector("[data-testid='setup-project-name-error']") !== null,
        );
        expect(container.querySelector("[data-testid='setup-project-name-error']")?.textContent).toBe(
          "A Project with this name already exists in this team. Choose another name.",
        );
      });
    });

    describe("when the repository joins an existing Project", () => {
      const DP = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";

      async function openLinkedWizard() {
        mockSearch = `tab=setup&group=workspace-1&project=${DP}`;
        mockedGetDeliveryProject.mockResolvedValue({
          id: DP,
          name: "loyalty",
          groupId: "workspace-1",
          status: "active",
        });
        await act(async () => {
          root.render(<WorkflowBuilder login="tone" plan="pro" session={leadSession("lead")} />);
        });
        await waitForCondition(() => container.textContent?.includes("Next.js App") ?? false);
        const select = container.querySelector<HTMLSelectElement>("#project-type-select");
        if (select) changeValue(select, "nextjs-app");
        await waitForCondition(
          () => container.querySelector("[data-testid='setup-target-project']") !== null,
        );
      }

      it("replaces the field with a read-only line and sends no projectName", async () => {
        await openLinkedWizard();
        await clickContinue();

        expect(container.querySelector("#project-name")).toBeNull();
        expect(
          container.querySelector("[data-testid='setup-adding-to-project']")?.textContent,
        ).toBe("Adding to Project: loyalty");

        // Only the repository name stands between the user and Continue.
        changeValue(repoNameInput(), "demo-next-app");
        expect(findButton("Continue")).not.toBeDisabled();
        for (let step = 1; step < 4; step += 1) await clickContinue();
        await waitForCondition(
          () => container.querySelector("[data-testid='setup-project-button']") !== null,
        );
        expect(reviewValue("Project")).toBe("loyalty");

        await clickCreate();
        const sent = mockedCreateProject.mock.calls[0][0];
        expect(sent.deliveryProjectId).toBe(DP);
        expect(sent).not.toHaveProperty("projectName");
      });
    });
  });
});
