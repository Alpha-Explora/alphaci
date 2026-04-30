import { act, useEffect, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  getCategories,
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getProjectOptions,
  getProjects,
  getTemplates,
  getWorkflowHistory,
  linkGithubInstallation,
} from "../../src/lib/api/client";
import type { CatalogTemplate, ProjectOptionsResponse } from "../../src/lib/api/contracts";
import { useCreateProjectForm } from "../../src/hooks/use-create-project-form";
import { useGithubInstallations } from "../../src/hooks/use-github-installations";
import { useProjectSetupForm } from "../../src/hooks/use-project-setup-form";
import { useProjectOptionsCatalog } from "../../src/hooks/use-project-options-catalog";
import { useProvisionedProjects } from "../../src/hooks/use-provisioned-projects";
import { useWorkflowCatalog } from "../../src/hooks/use-workflow-catalog";
import { useWorkflowHistory } from "../../src/hooks/use-workflow-history";

jest.mock("../../src/lib/api/client", () => ({
  getCategories: jest.fn(),
  getGithubInstallationAccounts: jest.fn(),
  getGithubAppInstallUrl: jest.fn(),
  getLinkedGithubRepos: jest.fn(),
  getProjectOptions: jest.fn(),
  getProjects: jest.fn(),
  getTemplates: jest.fn(),
  getWorkflowHistory: jest.fn(),
  linkGithubInstallation: jest.fn(),
}));

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
const mockedGetWorkflowHistory = getWorkflowHistory as jest.MockedFunction<typeof getWorkflowHistory>;
const mockedLinkGithubInstallation = linkGithubInstallation as jest.MockedFunction<
  typeof linkGithubInstallation
>;

const template: CatalogTemplate = {
  id: "frontend-react",
  name: "React CI",
  description: "Run React checks.",
  iconName: "react",
  categories: ["frontend"],
  filePatterns: ["package.json"],
  stack: "react",
  propertiesPath: "workflow-templates/frontend-react.properties.json",
  workflowPath: "workflow-templates/frontend-react.yml",
};

const projectOptions: ProjectOptionsResponse = {
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
      reservedRepoShapes: ["monorepo"],
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

function createHookRoot() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("workflow hooks", () => {
  let hookRoot: { container: HTMLDivElement; root: Root; cleanup: () => Promise<void> };

  beforeEach(() => {
    hookRoot = createHookRoot();
    mockedGetCategories.mockResolvedValue({ categories: [{ name: "frontend", count: 1 }] });
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
    mockedGetProjectOptions.mockResolvedValue(projectOptions);
    mockedLinkGithubInstallation.mockResolvedValue({ reposLinked: 1, repositorySelection: "all" });
  });

  afterEach(async () => {
    await hookRoot.cleanup();
    jest.clearAllMocks();
  });

  it("builds setup payloads and reports form validation errors", async () => {
    let current: ReturnType<typeof useProjectSetupForm> | null = null;

    function Probe() {
      const value = useProjectSetupForm();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    expect(current?.nodeVersion).toBe("24");
    expect(current?.coverageThreshold).toBe("80");
    expect(current?.buildPayload(null, "tone/example-app")).toEqual({
      ok: false,
      message: "Please select a template first.",
    });
    expect(current?.buildPayload(template, "")).toEqual({
      ok: false,
      message: "Select a linked GitHub App repo first.",
    });

    act(() => current?.applyRepoSelection("tone/example-app"));
    await flushMicrotasks();
    expect(current?.serviceName).toBe("example-app");

    act(() => current?.setCoverageThreshold("101"));
    await flushMicrotasks();
    expect(current?.buildPayload(template, "tone/example-app")).toEqual({
      ok: false,
      message: "Coverage threshold must be between 0 and 100.",
    });

    act(() => {
      current?.setCoverageThreshold("80");
      current?.toggleEnhancement("disableK6");
    });
    await flushMicrotasks();

    expect(current?.buildPayload(template, "tone/example-app")).toEqual({
      ok: true,
      payload: expect.objectContaining({
        coverageThreshold: 80,
        enhancements: ["disableK6"],
        nodeVersion: "24",
        repoFullName: "tone/example-app",
        serviceName: "example-app",
        templateId: "frontend-react",
      }),
    });
  });

  it("loads catalog data and applies local filters", async () => {
    let current: ReturnType<typeof useWorkflowCatalog> | null = null;

    function Probe() {
      const value = useWorkflowCatalog();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.selectedTemplate?.id === "frontend-react");

    expect(current?.availableCategories).toEqual([{ name: "frontend", count: 1 }]);
    expect(current?.filteredTemplates).toHaveLength(1);

    act(() => current?.setSearchQuery("missing"));
    await flushMicrotasks();
    expect(current?.filteredTemplates).toHaveLength(0);

    act(() => {
      current?.setSearchQuery("");
      current?.setSelectedStack("react");
      current?.setSelectedCategory("frontend");
    });
    await flushMicrotasks();
    expect(current?.filteredTemplates).toHaveLength(1);

    act(() => current?.setSelectedStack("nodejs"));
    await flushMicrotasks();
    expect(current?.filteredTemplates).toHaveLength(0);
  });

  it("loads project options, defaults to the first enabled shape, and filters recipes by project type", async () => {
    let current: ReturnType<typeof useProjectOptionsCatalog> | null = null;

    function Probe() {
      const value = useProjectOptionsCatalog();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.selectedProjectType?.id === "nextjs-app");

    expect(current?.enabledRepoShapes.map((shape) => shape.id)).toEqual(["single-app"]);
    expect(current?.selectedRepoShapeId).toBe("single-app");
    expect(current?.recipesForSelectedProject.map((recipe) => recipe.id)).toEqual(["frontend-standard-ci"]);
    expect(current?.tests).toMatchObject({
      lint: true,
      unit: true,
      build: true,
      coverage: true,
      security: true,
      docker: false,
    });

    act(() => current?.toggleTestOption("security"));
    await flushMicrotasks();
    expect(current?.tests.security).toBe(false);

    act(() => current?.toggleTestOption("docker"));
    await flushMicrotasks();
    expect(current?.tests.docker).toBe(false);

    act(() => current?.setSelectedProjectTypeId("nestjs-api"));
    await flushMicrotasks();

    expect(current?.selectedWorkflowRecipeId).toBe("backend-api-ci");
    expect(current?.recipesForSelectedProject.map((recipe) => recipe.id)).toEqual(["backend-api-ci"]);
    expect(current?.tests).toMatchObject({
      lint: true,
      unit: true,
      build: false,
      coverage: true,
      security: true,
      docker: false,
    });

    act(() => current?.setSelectedRepoShapeId("monorepo"));
    await flushMicrotasks();
    expect(current?.selectedRepoShapeId).toBe("single-app");
  });

  it("reports project option catalog load failures", async () => {
    let current: ReturnType<typeof useProjectOptionsCatalog> | null = null;
    mockedGetProjectOptions.mockRejectedValueOnce(new Error("catalog unavailable"));

    function Probe() {
      const value = useProjectOptionsCatalog();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.projectOptionsError !== null);
    expect(current?.projectOptionsError).toBe("Unable to load create project options right now.");
    expect(current?.enabledRepoShapes).toEqual([]);
    expect(current?.selectedRepoShapeId).toBe("");
  });

  it("builds create project payloads and requires an all-repositories installation", async () => {
    let current: ReturnType<typeof useCreateProjectForm> | null = null;

    function Probe() {
      const value = useCreateProjectForm();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    expect(current?.nodeVersion).toBe("24");
    expect(current?.coverageThreshold).toBe("80");
    expect(current?.visibility).toBe("private");
    expect(current?.outputFileName).toBe("ci.yml");

    expect(
      current?.buildPayload({
        hasAllRepositoriesInstallation: false,
        repoShapeId: "single-app",
        projectTypeId: "nextjs-app",
        workflowRecipeId: "frontend-standard-ci",
        tests: { lint: true },
      }),
    ).toEqual({
      ok: false,
      message: "Link a GitHub App installation with all repositories access before creating a project.",
    });

    act(() => current?.setRepoName("Example App"));
    await flushMicrotasks();
    expect(current?.serviceName).toBe("example-app");

    const result = current?.buildPayload({
      hasAllRepositoriesInstallation: true,
      repoShapeId: "single-app",
      projectTypeId: "nextjs-app",
      workflowRecipeId: "frontend-standard-ci",
      tests: {
        lint: true,
        unit: true,
        build: true,
        coverage: true,
        security: true,
        docker: false,
      },
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        repoName: "example-app",
        visibility: "private",
        repoShape: "single-app",
        projectTypeId: "nextjs-app",
        workflowRecipeId: "frontend-standard-ci",
        serviceName: "example-app",
        servicePath: ".",
        nodeVersion: "24",
        coverageThreshold: 80,
        tests: {
          lint: true,
          unit: true,
          build: true,
          coverage: true,
          security: true,
          docker: false,
        },
        outputFileName: "ci.yml",
      },
    });
  });

  it("reports create project form validation branches", async () => {
    let current: ReturnType<typeof useCreateProjectForm> | null = null;
    const baseInput = {
      hasAllRepositoriesInstallation: true,
      repoShapeId: "single-app",
      projectTypeId: "nextjs-app",
      workflowRecipeId: "frontend-standard-ci",
      tests: {
        lint: true,
        unit: true,
        build: true,
        coverage: true,
        security: true,
        docker: false,
      },
    };

    function Probe() {
      const value = useCreateProjectForm();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    expect(current?.buildPayload(baseInput)).toEqual({
      ok: false,
      message: "Repository name is required.",
    });

    act(() => current?.setRepoName("Example App"));
    await flushMicrotasks();

    expect(current?.buildPayload({ ...baseInput, repoShapeId: "" })).toEqual({
      ok: false,
      message: "Choose a repository shape.",
    });
    expect(current?.buildPayload({ ...baseInput, projectTypeId: "" })).toEqual({
      ok: false,
      message: "Choose a project type.",
    });
    expect(current?.buildPayload({ ...baseInput, workflowRecipeId: "" })).toEqual({
      ok: false,
      message: "Choose a workflow recipe.",
    });

    act(() => {
      current?.setServiceName("API Service");
      current?.setCoverageThreshold("101");
    });
    await flushMicrotasks();
    expect(current?.buildPayload(baseInput)).toEqual({
      ok: false,
      message: "Coverage threshold must be between 0 and 100.",
    });

    act(() => {
      current?.setCoverageThreshold("80");
      current?.setOutputFileName("folder/ci.yml");
    });
    await flushMicrotasks();
    expect(current?.buildPayload(baseInput)).toEqual({
      ok: false,
      message: "Workflow file name must be a .yml or .yaml basename.",
    });

    act(() => {
      current?.setOutputFileName("custom.yaml");
      current?.setNodeVersion("");
      current?.setServicePath("");
      current?.setVisibility("public");
    });
    await flushMicrotasks();

    expect(current?.buildPayload(baseInput)).toEqual({
      ok: true,
      payload: expect.objectContaining({
        nodeVersion: "24",
        outputFileName: "custom.yaml",
        serviceName: "api-service",
        servicePath: ".",
        visibility: "public",
      }),
    });
  });

  it("falls back to template categories and reports catalog load failures", async () => {
    let current: ReturnType<typeof useWorkflowCatalog> | null = null;

    mockedGetCategories.mockResolvedValueOnce({ categories: [] });

    function Probe() {
      const value = useWorkflowCatalog();
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.availableCategories.length === 1);
    expect(current?.availableCategories).toEqual([{ name: "frontend", count: 1 }]);

    await hookRoot.cleanup();
    hookRoot = createHookRoot();
    mockedGetCategories.mockRejectedValueOnce(new Error("catalog unavailable"));
    mockedGetTemplates.mockRejectedValueOnce(new Error("catalog unavailable"));

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.catalogError !== null);
    expect(current?.catalogError).toBe("Unable to load workflow templates from workflow-core right now.");
  });

  it("loads GitHub App installation state and links installations", async () => {
    const statusMessages: string[] = [];
    const selectedRepos: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = (repo: string) => selectedRepos.push(repo);
    let current: ReturnType<typeof useGithubInstallations> | null = null;

    function Probe() {
      const value = useGithubInstallations(pushStatus, applyRepo);
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.linkedReposLoaded === true);
    expect(current?.installUrl).toContain("github.com/apps");
    expect(current?.linkedRepos).toEqual([{ installationId: 12345, repoFullName: "tone/example-app" }]);
    expect(current?.hasAllRepositoriesInstallation).toBe(true);
    expect(current?.allRepositoriesAccount?.accountLogin).toBe("tone");

    act(() => {
      current?.handleRepoSelect({
        target: { value: "tone/example-app" },
      } as ChangeEvent<HTMLSelectElement>);
    });
    expect(selectedRepos).toContain("tone/example-app");

    await act(async () => {
      await current?.handleLinkInstallation();
    });
    expect(statusMessages).toContain("Enter a valid GitHub App installation id.");

    act(() => current?.setInstallationId("12345"));
    await flushMicrotasks();

    await act(async () => {
      await current?.handleLinkInstallation();
    });

    expect(mockedLinkGithubInstallation).toHaveBeenCalledWith(12345);
    expect(statusMessages).toContain("Linked 1 GitHub repo. Installation access: all repositories.");
  });

  it("keeps create project disabled when only selected-repository installation access exists", async () => {
    let current: ReturnType<typeof useGithubInstallations> | null = null;
    const pushStatus = jest.fn();
    const applyRepo = jest.fn();
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

    function Probe() {
      const value = useGithubInstallations(pushStatus, applyRepo);
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => current?.installationAccountsLoaded === true);
    expect(current?.hasAllRepositoriesInstallation).toBe(false);
    expect(current?.installationStatusCopy).toBe(
      "GitHub App is linked for selected repositories only. Reinstall or update it with all repositories access to create new repos.",
    );
  });

  it("reports GitHub App load and link failures", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = jest.fn();
    let current: ReturnType<typeof useGithubInstallations> | null = null;

    mockedGetLinkedGithubRepos.mockRejectedValueOnce(new Error("repos unavailable"));
    mockedGetGithubAppInstallUrl.mockRejectedValueOnce(new Error("install unavailable"));
    mockedLinkGithubInstallation.mockRejectedValueOnce({
      details: { message: "Installation not found" },
    });

    function Probe() {
      const value = useGithubInstallations(pushStatus, applyRepo);
      useEffect(() => {
        current = value;
      }, [value]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => statusMessages.includes("Could not load linked GitHub App repos."));
    expect(current?.installUrl).toBeNull();

    act(() => current?.setInstallationId("12345"));
    await flushMicrotasks();

    await act(async () => {
      await current?.handleLinkInstallation();
    });

    expect(statusMessages).toContain("GitHub App installation link failed: Installation not found");
  });

  it("loads project and workflow history data", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    let projects: ReturnType<typeof useProvisionedProjects> | null = null;
    let history: ReturnType<typeof useWorkflowHistory> | null = null;

    mockedGetProjects.mockResolvedValue({
      items: [
        {
          id: "project-1",
          repoFullName: "tone/example-app",
          repoUrl: "https://github.com/tone/example-app",
          visibility: "private",
          repoShape: "single-app",
          projectTypeId: "nextjs-app",
          workflowRecipeId: "frontend-standard-ci",
          projectOptions: { lint: true, unit: true, build: true },
          templateId: "frontend-react",
          serviceName: "example-app",
          workflowPath: ".github/workflows/example.yml",
          status: "provisioned",
          githubCommitSha: "commit-sha",
          githubCommitUrl: null,
          failureReason: null,
        },
      ],
    });
    mockedGetWorkflowHistory.mockResolvedValue({
      items: [
        {
          id: "history-1",
          createdAt: "2026-04-30T00:00:00.000Z",
          templateId: "frontend-react",
          templateName: "React CI",
          stack: "react",
          serviceName: "example-app",
          outputFileName: "example.yml",
          sourceWorkflowFile: "workflow-templates/frontend-react.yml",
          sourcePropertiesFile: "workflow-templates/frontend-react.properties.json",
          lineCount: 10,
          yaml: "name: CI\n",
        },
      ],
    });

    function Probe() {
      const projectState = useProvisionedProjects(pushStatus);
      const historyState = useWorkflowHistory(pushStatus);
      useEffect(() => {
        projects = projectState;
        history = historyState;
      }, [historyState, projectState]);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => projects?.projects.length === 1 && history?.history.length === 1);
    expect(statusMessages).toEqual([]);

    act(() => {
      projects?.prependCreateResult(
        {
          id: "project-2",
          repoFullName: "tone/next-app",
          repoUrl: "https://github.com/tone/next-app",
          status: "provisioned",
          workflowPath: ".github/workflows/next.yml",
          githubCommitSha: "commit-2",
          githubCommitUrl: null,
          projectTypeId: "nextjs-app",
          workflowRecipeId: "frontend-standard-ci",
        },
        {
          repoName: "next-app",
          visibility: "private",
          repoShape: "single-app",
          projectTypeId: "nextjs-app",
          workflowRecipeId: "frontend-standard-ci",
          serviceName: "next-app",
          servicePath: ".",
          nodeVersion: "24",
          coverageThreshold: 80,
          tests: { lint: true, unit: true, build: true },
          outputFileName: "next.yml",
        },
      );
    });
    await flushMicrotasks();

    expect(projects?.projects[0]).toMatchObject({
      id: "project-2",
      serviceName: "next-app",
    });
  });

  it("reports project and workflow history load failures", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);

    mockedGetProjects.mockRejectedValueOnce(new Error("projects unavailable"));
    mockedGetWorkflowHistory.mockRejectedValueOnce(new Error("history unavailable"));

    function Probe() {
      useProvisionedProjects(pushStatus);
      useWorkflowHistory(pushStatus);
      return null;
    }

    await act(async () => {
      hookRoot.root.render(<Probe />);
    });

    await waitForCondition(() => statusMessages.length === 2);
    expect(statusMessages).toEqual(
      expect.arrayContaining([
        "Provisioned project history is temporarily unavailable.",
        "Workflow history is temporarily unavailable.",
      ]),
    );
  });
});
