import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkflowBuilder } from "../../src/components/product/workflow-builder";
import {
  createProject,
  getCategories,
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getProjectOptions,
  getProjects,
  getTemplates,
  getWorkflowHistory,
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
          for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout"]) {
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

jest.mock("../../src/lib/api/client", () => ({
  createProject: jest.fn(),
  getCategories: jest.fn(),
  getGithubInstallationAccounts: jest.fn(),
  getGithubAppInstallUrl: jest.fn(),
  getLinkedGithubRepos: jest.fn(),
  getProjectOptions: jest.fn(),
  getProjects: jest.fn(),
  getTemplates: jest.fn(),
  getWorkflowHistory: jest.fn(),
}));

const mockedCreateProject = createProject as jest.MockedFunction<typeof createProject>;
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
const mockedGetProjectOptions = getProjectOptions as jest.MockedFunction<typeof getProjectOptions>;
const mockedGetProjects = getProjects as jest.MockedFunction<typeof getProjects>;
const mockedGetTemplates = getTemplates as jest.MockedFunction<typeof getTemplates>;
const mockedGetWorkflowHistory = getWorkflowHistory as jest.MockedFunction<
  typeof getWorkflowHistory
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
    mockedGetCategories.mockResolvedValue({ categories: [] });
    mockedGetTemplates.mockResolvedValue({ templates: [template] });
    mockedGetWorkflowHistory.mockResolvedValue({ items: [] });
    mockedGetProjects.mockResolvedValue({ items: [] });
    mockedGetGithubAppInstallUrl.mockResolvedValue({
      installUrl: "https://github.com/apps/cicd-example/installations/new",
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
    mockedGetProjectOptions.mockResolvedValue(projectOptions as unknown as ProjectOptionsResponse);
    mockedCreateProject.mockResolvedValue({
      id: "project-1",
      repoFullName: "tone/example-app",
      repoUrl: "https://github.com/tone/example-app",
      status: "provisioned",
      workflowPath: ".github/workflows/ci.yml",
      githubCommitSha: "commit-sha",
      githubCommitUrl: "https://github.com/tone/example-app/commit/commit-sha",
      projectTypeId: "nextjs-app",
      workflowRecipeId: "frontend-standard-ci",
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

  async function renderBuilder(accessText = "All repositories access confirmed") {
    await act(async () => {
      root.render(<WorkflowBuilder login="tone" plan="pro" />);
    });

    await waitForCondition(() => container.textContent?.includes("Next.js App") ?? false);
    await waitForCondition(() => container.textContent?.includes(accessText) ?? false);
  }

  it("creates a new project and shows repo, workflow, commit, and Actions links", async () => {
    await renderBuilder();

    const repoName = container.querySelector<HTMLInputElement>("#repo-name");
    expect(repoName).not.toBeNull();
    changeValue(repoName!, "demo next app");

    const projectType = container.querySelector<HTMLSelectElement>("#project-type-select");
    expect(projectType).not.toBeNull();
    changeValue(projectType!, "nextjs-app");

    const securityToggle = container.querySelector<HTMLInputElement>("#test-security");
    expect(securityToggle).not.toBeNull();
    act(() => {
      securityToggle!.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(
      () => container.textContent?.includes(".github/workflows/ci.yml") ?? false,
    );

    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: "demo-next-app",
        visibility: "private",
        repoShape: "single-app",
        projectTypeId: "nextjs-app",
        workflowRecipeId: "frontend-standard-ci",
        serviceName: "demo-next-app",
        nodeVersion: "24",
        coverageThreshold: 80,
        tests: expect.objectContaining({
          lint: true,
          unit: true,
          build: true,
          coverage: true,
          security: false,
          docker: false,
        }),
      }),
    );
    expect(container.textContent).toContain("https://github.com/tone/example-app");
    expect(container.textContent).toContain("commit-sha");
    expect(container.querySelector<HTMLAnchorElement>("a[href='https://github.com/tone/example-app/actions']")).not.toBeNull();
  });

  it("shows a create project error when the backend rejects project creation", async () => {
    mockedCreateProject.mockRejectedValueOnce({
      details: { message: "GitHub App installation must be enabled for all repositories" },
    });

    await renderBuilder();

    const repoName = container.querySelector<HTMLInputElement>("#repo-name");
    expect(repoName).not.toBeNull();
    changeValue(repoName!, "demo next app");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(() => container.textContent?.includes("Create Project failed") ?? false);

    expect(container.textContent).toContain("GitHub App installation must be enabled for all repositories");
  });

  it("keeps Create Project disabled without an all-repositories GitHub App installation", async () => {
    mockedGetGithubInstallationAccounts.mockResolvedValueOnce({
      accounts: [
        {
          installationId: 12345,
          accountLogin: "tone",
          accountId: 999,
          repositorySelection: "selected",
        },
      ],
    });

    await renderBuilder("selected repositories only");

    const button = container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']");
    expect(button).not.toBeNull();
    expect(button).toBeDisabled();
    expect(container.textContent).toContain("selected repositories only");
    expect(mockedCreateProject).not.toHaveBeenCalled();
  });
});
