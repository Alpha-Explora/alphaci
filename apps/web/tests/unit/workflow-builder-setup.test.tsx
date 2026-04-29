import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { WorkflowBuilder } from "../../src/components/product/workflow-builder";
import {
  getCategories,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getProjects,
  getTemplates,
  getWorkflowHistory,
  setupProject,
} from "../../src/lib/api/client";

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
  getCategories: jest.fn(),
  getGithubAppInstallUrl: jest.fn(),
  getLinkedGithubRepos: jest.fn(),
  getProjects: jest.fn(),
  getTemplates: jest.fn(),
  getWorkflowHistory: jest.fn(),
  setupProject: jest.fn(),
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
const mockedGetWorkflowHistory = getWorkflowHistory as jest.MockedFunction<
  typeof getWorkflowHistory
>;
const mockedSetupProject = setupProject as jest.MockedFunction<typeof setupProject>;

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
    element.value = value;
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
    mockedGetLinkedGithubRepos.mockResolvedValue({
      repos: [{ installationId: 12345, repoFullName: "tone/example-app" }],
    });
    mockedSetupProject.mockResolvedValue({
      id: "project-1",
      repoFullName: "tone/example-app",
      status: "provisioned",
      workflowPath: ".github/workflows/example.yml",
      githubCommitSha: "commit-sha",
      githubCommitUrl: "https://github.com/tone/example-app/commit/commit-sha",
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

    await waitForCondition(() => container.textContent?.includes("React CI") ?? false);
    await waitForCondition(() => container.textContent?.includes("tone/example-app") ?? false);
  }

  it("sets up the selected linked repo and shows the commit result", async () => {
    await renderBuilder();

    const repoSelect = container.querySelector<HTMLSelectElement>("#linked-repo-select");
    expect(repoSelect).not.toBeNull();
    changeValue(repoSelect!, "tone/example-app");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(
      () => container.textContent?.includes(".github/workflows/example.yml") ?? false,
    );

    expect(mockedSetupProject).toHaveBeenCalledWith(
      expect.objectContaining({
        repoFullName: "tone/example-app",
        templateId: "frontend-react",
        nodeVersion: "24",
        coverageThreshold: 80,
      }),
    );
    expect(container.textContent).toContain("commit-sha");
  });

  it("shows a setup error when the backend rejects project setup", async () => {
    mockedSetupProject.mockRejectedValueOnce({
      details: { message: "Repository is not linked to this account" },
    });

    await renderBuilder();

    const repoSelect = container.querySelector<HTMLSelectElement>("#linked-repo-select");
    expect(repoSelect).not.toBeNull();
    changeValue(repoSelect!, "tone/example-app");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='setup-project-button']")?.click();
      await Promise.resolve();
    });

    await waitForCondition(() => container.textContent?.includes("Setup failed") ?? false);

    expect(container.textContent).toContain("Repository is not linked to this account");
  });
});
