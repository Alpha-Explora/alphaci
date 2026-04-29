import { act, useEffect, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  getCategories,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getProjects,
  getTemplates,
  getWorkflowHistory,
  linkGithubInstallation,
} from "../../src/lib/api/client";
import type { CatalogTemplate } from "../../src/lib/api/contracts";
import { useGithubInstallations } from "../../src/hooks/use-github-installations";
import { useProjectSetupForm } from "../../src/hooks/use-project-setup-form";
import { useProvisionedProjects } from "../../src/hooks/use-provisioned-projects";
import { useWorkflowCatalog } from "../../src/hooks/use-workflow-catalog";
import { useWorkflowHistory } from "../../src/hooks/use-workflow-history";

jest.mock("../../src/lib/api/client", () => ({
  getCategories: jest.fn(),
  getGithubAppInstallUrl: jest.fn(),
  getLinkedGithubRepos: jest.fn(),
  getProjects: jest.fn(),
  getTemplates: jest.fn(),
  getWorkflowHistory: jest.fn(),
  linkGithubInstallation: jest.fn(),
}));

const mockedGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockedGetGithubAppInstallUrl = getGithubAppInstallUrl as jest.MockedFunction<
  typeof getGithubAppInstallUrl
>;
const mockedGetLinkedGithubRepos = getLinkedGithubRepos as jest.MockedFunction<
  typeof getLinkedGithubRepos
>;
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
    mockedGetLinkedGithubRepos.mockResolvedValue({
      repos: [{ installationId: 12345, repoFullName: "tone/example-app" }],
    });
    mockedLinkGithubInstallation.mockResolvedValue({ reposLinked: 1 });
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
    expect(statusMessages).toContain("Linked 1 GitHub repo.");
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
      projects?.prependSetupResult(
        {
          id: "project-2",
          repoFullName: "tone/next-app",
          status: "provisioned",
          workflowPath: ".github/workflows/next.yml",
          githubCommitSha: "commit-2",
          githubCommitUrl: null,
        },
        {
          repoFullName: "tone/next-app",
          templateId: "frontend-react",
          serviceName: "next-app",
          coverageThreshold: 80,
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
