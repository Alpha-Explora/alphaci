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
import { navigateToExternalUrl } from "../../src/lib/navigation";
import type { CatalogTemplate, ProjectOptionsResponse } from "../../src/lib/api/contracts";
import { useCreateProjectForm } from "../../src/hooks/use-create-project-form";
import { useGithubInstallations } from "../../src/hooks/use-github-installations";
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

jest.mock("../../src/lib/navigation", () => ({
  navigateToExternalUrl: jest.fn(),
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
const mockedNavigateToExternalUrl = navigateToExternalUrl as jest.MockedFunction<
  typeof navigateToExternalUrl
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
  enforcedOrg: "Alpha-Explora",
  nodeVersions: [
    { value: "20", label: "Node 20 LTS (Iron)" },
    { value: "22", label: "Node 22 LTS (Jod)" },
    { value: "24", label: "Node 24 (Latest)" },
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
    mockedGetProjectOptions.mockResolvedValue(projectOptions);
    mockedLinkGithubInstallation.mockResolvedValue({ reposLinked: 1, repositorySelection: "all" });
  });

  afterEach(async () => {
    await hookRoot.cleanup();
    jest.clearAllMocks();
  });

  it("loads catalog data and applies local filters", async () => {
    let current = null as ReturnType<typeof useWorkflowCatalog> | null;

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
    let current = null as ReturnType<typeof useProjectOptionsCatalog> | null;

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
    expect(current?.frontendProjectTypes.map((projectType) => projectType.id)).toEqual(["nextjs-app"]);
    expect(current?.backendProjectTypes.map((projectType) => projectType.id)).toEqual(["nestjs-api"]);
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
    let current = null as ReturnType<typeof useProjectOptionsCatalog> | null;
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
    let current = null as ReturnType<typeof useCreateProjectForm> | null;

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

    act(() => current?.setRepoName("Example App"));
    await flushMicrotasks();
    expect(current?.serviceName).toBe("example-app");

    const result = current?.buildPayload({
      isMicroservicesShape: false, isMultiRepoShape: false,
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

    const organizationResult = current?.buildPayload({
      isMicroservicesShape: false,
      isMultiRepoShape: false,
      repoShapeId: "single-app",
      projectTypeId: "nextjs-app",
      workflowRecipeId: "frontend-standard-ci",
      ownerType: "organization",
      installationId: 12345,
      tests: {
        lint: true,
        unit: true,
        build: true,
        coverage: true,
        security: true,
        docker: false,
      },
    });
    expect(organizationResult).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          ownerType: "organization",
          installationId: 12345,
        }),
      }),
    );
  });

  it("keeps separators typed into the repository name and trims them on submit", async () => {
    let current = null as ReturnType<typeof useCreateProjectForm> | null;
    const baseInput = {
      isMicroservicesShape: false, isMultiRepoShape: false,
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

    // The field is a controlled input, so every keystroke re-enters the
    // sanitizer with the previously sanitized value. A separator has to survive
    // being the last character, otherwise it can never reach the middle either.
    for (const character of "my-next_app.v2") {
      const next = `${current?.repoName ?? ""}${character}`;
      act(() => current?.setRepoName(next));
      await flushMicrotasks();
    }
    expect(current?.repoName).toBe("my-next_app.v2");

    // Characters GitHub does not accept are still dropped, spaces still fold
    // into hyphens.
    act(() => current?.setRepoName("Bad name/with?chars"));
    await flushMicrotasks();
    expect(current?.repoName).toBe("bad-namewithchars");

    // Edge separators survive typing but are trimmed off the submitted payload.
    act(() => current?.setRepoName("-my-app-"));
    await flushMicrotasks();
    expect(current?.repoName).toBe("-my-app-");
    expect(current?.buildPayload(baseInput)).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ repoName: "my-app" }),
      }),
    );
  });

  it("reports create project form validation branches", async () => {
    let current = null as ReturnType<typeof useCreateProjectForm> | null;
    const baseInput = {
      isMicroservicesShape: false, isMultiRepoShape: false,
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

  it("builds microservices create project payloads", async () => {
    let current = null as ReturnType<typeof useCreateProjectForm> | null;

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

    act(() => {
      current?.setRepoName("Example Platform");
      current?.setBackendProjectTypeId("nestjs");
      current?.setBackendWorkflowRecipeId("backend-api-ci");
      current?.setFrontendProjectTypeId("nextjs");
      current?.setFrontendWorkflowRecipeId("frontend-standard-ci");
      current?.setBackendServiceName("Orders API");
      current?.setBackendServicePath("");
      current?.setFrontendServiceName("Portal Web");
      current?.setFrontendServicePath("");
    });
    await flushMicrotasks();

    expect(
      current?.buildPayload({
        isMicroservicesShape: true, isMultiRepoShape: true,
        repoShapeId: "microservices",
        projectTypeId: "",
        workflowRecipeId: "",
        tests: {
          lint: true,
          unit: true,
          build: true,
          coverage: true,
          security: true,
          docker: true,
        },
      }),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        repoName: "example-platform",
        repoShape: "microservices",
        projectTypeId: "nestjs",
        workflowRecipeId: "backend-api-ci",
        serviceName: "orders-api",
        servicePath: "backend/",
        microservicesConfig: {
          backend: {
            projectTypeId: "nestjs",
            workflowRecipeId: "backend-api-ci",
            serviceName: "orders-api",
            servicePath: "backend/",
          },
          frontend: {
            projectTypeId: "nextjs",
            workflowRecipeId: "frontend-standard-ci",
            serviceName: "portal-web",
            servicePath: "frontend/",
          },
        },
      }),
    });
  });

  it("builds multi-repo create project payloads", async () => {
    let current = null as ReturnType<typeof useCreateProjectForm> | null;

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

    act(() => {
      current?.setRepoName("Example Platform");
      current?.setBackendProjectTypeId("nestjs");
      current?.setBackendWorkflowRecipeId("backend-api-ci");
      current?.setFrontendProjectTypeId("nextjs");
      current?.setFrontendWorkflowRecipeId("frontend-standard-ci");
      current?.setBackendServicePath("");
      current?.setFrontendServicePath("");
    });
    await flushMicrotasks();

    expect(
      current?.buildPayload({
        isMicroservicesShape: false, isMultiRepoShape: true,
        repoShapeId: "multi-repo",
        projectTypeId: "",
        workflowRecipeId: "",
        tests: {
          lint: true,
          unit: true,
          build: true,
          coverage: true,
          security: true,
          docker: true,
        },
        deploymentProvisioning: {
          enabled: true,
          targets: [],
        },
      }),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        repoName: "example-platform",
        repoShape: "multi-repo",
        serviceName: "example-platform-backend",
        servicePath: "backend/",
        deploymentProvisioning: {
          enabled: true,
          targets: [],
        },
        multiRepoConfig: {
          backend: {
            projectTypeId: "nestjs",
            workflowRecipeId: "backend-api-ci",
            serviceName: "example-platform-backend",
            servicePath: "backend/",
          },
          frontend: {
            projectTypeId: "nextjs",
            workflowRecipeId: "frontend-standard-ci",
            serviceName: "example-platform-frontend",
            servicePath: "frontend/",
          },
        },
      }),
    });
  });

  it("falls back to template categories and reports catalog load failures", async () => {
    let current = null as ReturnType<typeof useWorkflowCatalog> | null;

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
    expect(current?.catalogError).toBe("Unable to load workflow templates from cicd-workflow right now.");
  });

  it("loads GitHub App installation state and links installations", async () => {
    const statusMessages: string[] = [];
    const selectedRepos: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = (repo: string) => selectedRepos.push(repo);
    let current = null as ReturnType<typeof useGithubInstallations> | null;

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
    expect(current?.appSlug).toBe("cicd-example");

    window.history.pushState({}, "", "/workflows");
    mockedGetGithubAppInstallUrl.mockResolvedValueOnce({
      installUrl: "https://github.com/apps/alphaci-test/installations/new",
      appSlug: "alphaci-test",
    });

    await act(async () => {
      await current?.handleInstallApp();
    });

    expect(mockedGetGithubAppInstallUrl).toHaveBeenCalledTimes(2);
    expect(mockedNavigateToExternalUrl).toHaveBeenCalledWith(
      "https://github.com/apps/alphaci-test/installations/new?state=%2Fworkflows",
    );
    expect(current?.appSlug).toBe("alphaci-test");
    window.history.pushState({}, "", "/");

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
    let current = null as ReturnType<typeof useGithubInstallations> | null;
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

  it("auto-links a GitHub App installation from the URL callback param", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = jest.fn();
    let current = null as ReturnType<typeof useGithubInstallations> | null;
    const replaceSpy = jest.spyOn(window.history, "replaceState");

    window.history.pushState(
      {},
      "",
      "/workflows?installation_id=99999&setup_action=install&state=%2Fworkflows",
    );

    function Probe() {
      const value = useGithubInstallations(pushStatus, applyRepo);
      useEffect(() => { current = value; }, [value]);
      return null;
    }

    await act(async () => { hookRoot.root.render(<Probe />); });
    await waitForCondition(() => statusMessages.some((m) => m.includes("Linked")));

    expect(mockedLinkGithubInstallation).toHaveBeenCalledWith(99999);
    expect(statusMessages).toContain("Linked 1 GitHub repo. Installation access: all repositories.");
    expect(replaceSpy).toHaveBeenCalledWith(null, "", "/workflows");

    replaceSpy.mockRestore();
    window.history.pushState({}, "", "/");
    expect(current).not.toBeNull();
  });

  it("derives the GitHub App slug from older install-url responses", async () => {
    let current = null as ReturnType<typeof useGithubInstallations> | null;
    const pushStatus = jest.fn();
    const applyRepo = jest.fn();

    mockedGetGithubAppInstallUrl.mockResolvedValueOnce({
      installUrl: "https://github.com/apps/alphaci-test/installations/new",
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

    await flushMicrotasks(8);
    expect(current?.appSlug).toBe("alphaci-test");
    expect(current?.installUrl).toBe("https://github.com/apps/alphaci-test/installations/new");
  });

  it("can retry GitHub App install after the initial preload fails", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    window.history.pushState({}, "", "/workflows?tab=setup");
    let current = null as ReturnType<typeof useGithubInstallations> | null;
    const applyRepo = jest.fn();

    mockedGetGithubAppInstallUrl
      .mockRejectedValueOnce(new Error("cold start"))
      .mockResolvedValueOnce({
        installUrl: "https://github.com/apps/alphaci-test/installations/new",
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

    await flushMicrotasks(8);
    expect(current?.installUrl).toBeNull();

    await act(async () => {
      await current?.handleInstallApp();
    });

    expect(mockedGetGithubAppInstallUrl).toHaveBeenCalledTimes(2);
    expect(mockedNavigateToExternalUrl).toHaveBeenCalledWith(
      "https://github.com/apps/alphaci-test/installations/new?state=%2Fworkflows%3Ftab%3Dsetup",
    );
    expect(current?.installUrl).toBe("https://github.com/apps/alphaci-test/installations/new");
    expect(current?.appSlug).toBe("alphaci-test");
    expect(statusMessages).toEqual([""]);

    window.history.pushState({}, "", "/");
  });

  it("rejects an invalid installation_id from the URL callback param", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = jest.fn();
    const replaceSpy = jest.spyOn(window.history, "replaceState");

    window.history.pushState({}, "", "/workflows?installation_id=not-a-number");

    function Probe() {
      useGithubInstallations(pushStatus, applyRepo);
      return null;
    }

    await act(async () => { hookRoot.root.render(<Probe />); });
    await flushMicrotasks(5);

    expect(statusMessages).toContain("GitHub App callback contained an invalid installation ID.");
    expect(mockedLinkGithubInstallation).not.toHaveBeenCalled();

    replaceSpy.mockRestore();
    window.history.pushState({}, "", "/");
  });

  it("handles silent failure when loading installation accounts after auto-link", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = jest.fn();
    const replaceSpy = jest.spyOn(window.history, "replaceState");

    mockedGetGithubInstallationAccounts
      .mockResolvedValueOnce({ accounts: [] })
      .mockRejectedValueOnce(new Error("accounts reload failed"));

    window.history.pushState({}, "", "/workflows?installation_id=77777");

    function Probe() {
      useGithubInstallations(pushStatus, applyRepo);
      return null;
    }

    await act(async () => { hookRoot.root.render(<Probe />); });
    await waitForCondition(() => statusMessages.some((m) => m.includes("Linked")));

    expect(statusMessages.every((m) => !m.includes("installation accounts"))).toBe(true);

    replaceSpy.mockRestore();
    window.history.pushState({}, "", "/");
  });

  it("reports GitHub App load and link failures", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    const applyRepo = jest.fn();
    let current = null as ReturnType<typeof useGithubInstallations> | null;

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
    let projects = null as ReturnType<typeof useProvisionedProjects> | null;
    let history = null as ReturnType<typeof useWorkflowHistory> | null;

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

    act(() => {
      projects?.prependCreateResult(
        {
          id: "project-3",
          repoFullName: "tone/api",
          repoUrl: "https://github.com/tone/api",
          status: "provisioned",
          workflowPath: ".github/workflows/api.yml",
          githubCommitSha: "commit-3",
          githubCommitUrl: null,
          projectTypeId: "nestjs-api",
          workflowRecipeId: "backend-api-ci",
        },
        {
          repoName: "api",
          visibility: "private",
          projectTypeId: "nestjs-api",
          workflowRecipeId: "backend-api-ci",
          serviceName: "api",
          servicePath: ".",
          nodeVersion: "24",
          coverageThreshold: 80,
          outputFileName: "api.yml",
        },
      );
    });
    await flushMicrotasks();

    expect(projects?.projects[0]).toMatchObject({
      id: "project-3",
      repoShape: "single-app",
      projectOptions: {},
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

  it("keeps silent project and workflow reload failures quiet", async () => {
    const statusMessages: string[] = [];
    const pushStatus = (message: string) => statusMessages.push(message);
    let projects = null as ReturnType<typeof useProvisionedProjects> | null;
    let history = null as ReturnType<typeof useWorkflowHistory> | null;

    mockedGetProjects.mockResolvedValueOnce({ items: [] });
    mockedGetWorkflowHistory.mockResolvedValueOnce({ items: [] });

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

    await waitForCondition(() => projects !== null && history !== null);
    mockedGetProjects.mockRejectedValueOnce(new Error("projects unavailable"));
    mockedGetWorkflowHistory.mockRejectedValueOnce(new Error("history unavailable"));

    await act(async () => {
      await projects?.loadProjects(true);
      await history?.loadHistory(true);
    });

    expect(statusMessages).toEqual([]);
    expect(projects?.loadingProjects).toBe(false);
    expect(history?.loadingHistory).toBe(false);
  });
});
