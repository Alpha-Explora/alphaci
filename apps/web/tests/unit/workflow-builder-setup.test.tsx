import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkflowBuilder } from "../../src/components/product/workflow-builder";
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
} from "../../src/lib/api/client";
import type { ProjectOptionsResponse } from "../../src/lib/api/contracts";

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
          for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout", "layoutId"]) {
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

// The onboarding tour hook (rendered inside WorkflowBuilder) reads useSearchParams.
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock("../../src/lib/api/client", () => ({
  createGithubRepo: jest.fn(),
  createProject: jest.fn(),
  generateWorkflow: jest.fn(),
  getCapabilities: jest.fn(),
  getCategories: jest.fn(),
  getGithubInstallationAccounts: jest.fn(),
  getGithubAppInstallUrl: jest.fn(),
  getLinkedGithubRepos: jest.fn(),
  getMyUsage: jest.fn(),
  getProjectOptions: jest.fn(),
  getProjects: jest.fn(),
  getTemplates: jest.fn(),
  getWorkflowHistory: jest.fn(),
  listProviderConnections: jest.fn(),
}));

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
    name: "AlphaCI Access Gate",
    path: ".github/workflows/00-flowci-access.yml",
    gated: true,
  },
  {
    stage: "quality" as const,
    name: "AlphaCI Quality",
    path: ".github/workflows/10-flowci-quality.yml",
    gated: true,
  },
  {
    stage: "package" as const,
    name: "AlphaCI Package",
    path: ".github/workflows/20-flowci-package.yml",
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
    mockedGetCapabilities.mockResolvedValue({
      envProvisioning: {
        enabled: true,
        providers: ["render", "vercel"],
        environments: ["test", "uat", "production"],
        modes: ["flowci_managed", "byo"],
      },
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
      branchesCreated: ["test", "uat", "main"],
    });
    mockedCreateProject.mockResolvedValue({
      id: "project-1",
      repoFullName: "tone/demo-next-app",
      repoUrl: "https://github.com/tone/demo-next-app",
      status: "provisioned",
      workflowPath: ".github/workflows/00-flowci-access.yml",
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

  async function renderBuilder() {
    await act(async () => {
      root.render(<WorkflowBuilder login="tone" plan="pro" />);
    });

    await waitForCondition(() => container.textContent?.includes("Next.js App") ?? false);
    await waitForCondition(
      () => container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']") !== null,
    );
  }

  it("creates a new project through the backend project endpoint", async () => {
    await renderBuilder();

    const repoName = container.querySelector<HTMLInputElement>("#repo-name");
    expect(repoName).not.toBeNull();
    changeValue(repoName!, "demo-next-app");

    const projectType = container.querySelector<HTMLSelectElement>("#project-type-select");
    expect(projectType).not.toBeNull();
    changeValue(projectType!, "nextjs-app");

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
      }),
    );
    expect(mockedCreateGithubRepo).not.toHaveBeenCalled();
    expect(mockedGenerateWorkflow).not.toHaveBeenCalled();
    expect(container.textContent).toContain("tone/demo-next-app");
    expect(container.textContent).toContain("00-flowci-access.yml");
    expect(container.textContent).toContain("AlphaCI Access Gate");
    expect(container.textContent).toContain("10-flowci-quality.yml");
    expect(container.textContent).toContain("20-flowci-package.yml");
    expect(container.textContent).toContain("3 gated workflow stages");
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

    expect(container.textContent).toContain("Project quota: Limit reached. Upgrade to continue.");
    expect(container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.disabled).toBe(true);
  });

  it("shows a create project error when createProject rejects", async () => {
    mockedCreateProject.mockRejectedValueOnce({
      details: {
        message:
          'Repository already exists or name is invalid: {"message":"Repository creation failed.","errors":[{"resource":"Repository","code":"custom","field":"name","message":"name already exists on this account"}],"documentation_url":"https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user","status":"422"}',
      },
    });

    await renderBuilder();

    const repoName = container.querySelector<HTMLInputElement>("#repo-name");
    expect(repoName).not.toBeNull();
    changeValue(repoName!, "demo-next-app");

    const projectType = container.querySelector<HTMLSelectElement>("#project-type-select");
    expect(projectType).not.toBeNull();
    changeValue(projectType!, "nextjs-app");

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

  it("keeps hosting provisioning out of project creation", async () => {
    mockedCreateProject.mockResolvedValueOnce({
      id: "project-1",
      repoFullName: "tone/orders-api",
      repoUrl: "https://github.com/tone/orders-api",
      status: "provisioned",
      workflowPath: ".github/workflows/00-flowci-access.yml",
      workflowFiles: stagedWorkflowFiles,
      githubCommitSha: "commit-sha",
      githubCommitUrl: "https://github.com/tone/orders-api/commit/commit-sha",
      projectTypeId: "nestjs-api",
      workflowRecipeId: "backend-api-ci",
    });

    await renderBuilder();

    const repoName = container.querySelector<HTMLInputElement>("#repo-name");
    expect(repoName).not.toBeNull();
    changeValue(repoName!, "orders-api");

    const projectType = container.querySelector<HTMLSelectElement>("#project-type-select");
    expect(projectType).not.toBeNull();
    changeValue(projectType!, "nestjs-api");

    expect(container.textContent).not.toContain("Deployment provisioning");
    expect(
      container.querySelector<HTMLInputElement>(
        "input[aria-label='Provision deployment target']",
      ),
    ).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(() => container.textContent?.includes("tone/orders-api") ?? false);

    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.not.objectContaining({
        deploymentProvisioning: expect.anything(),
      }),
    );
    expect(container.textContent).toContain("Current Projects");
  });

  it("keeps Create GitHub Repository disabled when repo name is empty", async () => {
    await renderBuilder();

    const button = container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']");
    expect(button).not.toBeNull();
    // repo name is empty by default — button should be disabled
    expect(button).toBeDisabled();
    expect(mockedCreateGithubRepo).not.toHaveBeenCalled();
  });
});
