import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CreateRepositoryDialog } from "../../../../../../src/features/groups/delivery-project/views/create-repository-dialog";
import { createRepository } from "../../../../../../src/features/groups/data/hierarchy-api";
import { getProjectOptions } from "../../../../../../src/features/workflows/studio/data/catalog-api";
import { ApiError } from "../../../../../../src/shared/api/request";
import type { ProjectOptionsResponse } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/groups/data/hierarchy-api", () => ({
  ...jest.requireActual("../../../../../../src/features/groups/data/hierarchy-api"),
  createRepository: jest.fn(),
}));
jest.mock("../../../../../../src/features/workflows/studio/data/catalog-api", () => ({
  ...jest.requireActual("../../../../../../src/features/workflows/studio/data/catalog-api"),
  getProjectOptions: jest.fn(),
}));

const catalog: ProjectOptionsResponse = {
  repoShapes: [
    { id: "standalone", label: "Single application", enabled: true },
    { id: "multi", label: "Backend + frontend (two repos)", enabled: true },
    { id: "mono", label: "Monorepo", enabled: false },
  ],
  projectTypes: [
    {
      id: "nextjs",
      label: "Next.js",
      language: "TypeScript",
      framework: "Next.js",
      repoShapes: ["standalone", "multi"],
      defaultRecipe: "standard",
      allowedRecipes: ["standard"],
      defaultOptions: { lint: true, unit: true, build: true },
    },
    {
      id: "nestjs",
      label: "NestJS",
      language: "TypeScript",
      framework: "NestJS",
      repoShapes: ["standalone", "multi"],
      defaultRecipe: "standard",
      allowedRecipes: ["standard"],
      defaultOptions: { lint: true, unit: true, build: true },
    },
  ],
  recipes: [
    {
      id: "standard",
      label: "Standard",
      supportedProjectTypes: ["nextjs", "nestjs"],
      templateByProjectType: {},
      supportedOptions: { lint: true, unit: true, build: true },
      optionJobs: {},
    },
  ],
  nodeVersions: [
    { value: "22", label: "Node 22" },
    { value: "24", label: "Node 24" },
  ],
  enforcedOrg: "acme",
};

function createdResponse(outcome: string, failures: Array<{ slot: string; provider: string; reason: string }> = []) {
  return {
    id: "r1",
    deliveryProjectId: "dp1",
    name: "checkout-web",
    status: "active",
    visibility: "private",
    provisionedProjectId: "proj-9",
    repoFullName: "acme/checkout-web",
    htmlUrl: "https://github.com/acme/checkout-web",
    assignmentCount: 0,
    createdAt: "2026-10-08T00:00:00Z",
    updatedAt: "2026-10-08T00:00:00Z",
    provisioning: {
      projectId: "proj-9",
      repoFullName: "acme/checkout-web",
      repoUrl: "https://github.com/acme/checkout-web",
      workflowPath: ".github/workflows/ci.yml",
      branchesCreated: ["main", "uat"],
      hosting: { outcome, failures },
    },
  };
}

async function poll(check: () => boolean, attempts = 80): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

function setValue(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

function submitButton(): HTMLButtonElement {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent === "Add repository",
  )!;
}

async function submit() {
  await act(async () => {
    submitButton().click();
  });
}

function sentBody() {
  return (createRepository as jest.Mock).mock.calls[0]?.[1];
}

describe("CreateRepositoryDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getProjectOptions as jest.Mock).mockResolvedValue(catalog);
    (createRepository as jest.Mock).mockResolvedValue(createdResponse("provisioned"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function open() {
    act(() => {
      root.render(
        <CreateRepositoryDialog open deliveryProjectId="dp1" onClose={jest.fn()} onCreated={onCreated} />,
      );
    });
    await poll(() => document.querySelector("#repo-stack option[value='nextjs']") !== null);
  }

  it("renders nothing while closed and reads no catalog", () => {
    act(() => {
      root.render(
        <CreateRepositoryDialog open={false} deliveryProjectId="dp1" onClose={jest.fn()} onCreated={onCreated} />,
      );
    });
    expect(container.innerHTML).toBe("");
    expect(getProjectOptions).not.toHaveBeenCalled();
  });

  it("requires a stack: none is preselected and Add stays disabled until one is chosen", async () => {
    await open();
    setValue("#repo-name", "checkout-web");
    expect(document.querySelector<HTMLSelectElement>("#repo-stack")!.value).toBe("");
    expect(submitButton().disabled).toBe(true);
    setValue("#repo-stack", "nextjs");
    expect(submitButton().disabled).toBe(false);
  });

  it("sends projectTypeId and leaves hosting to the managed defaults", async () => {
    await open();
    setValue("#repo-name", "Checkout Web");
    setValue("#repo-stack", "nextjs");
    expect(document.body.textContent).toContain("This stack deploys to Vercel.");
    await submit();
    expect(createRepository).toHaveBeenCalledWith("dp1", expect.objectContaining({
      name: "checkout-web",
      projectTypeId: "nextjs",
      workflowRecipeId: "standard",
      visibility: "private",
      repoShape: "standalone",
    }));
    expect(sentBody()).not.toHaveProperty("deploymentProvisioning");
  });

  it("names Render for a backend stack and hides the shape picker (one single-repo shape)", async () => {
    await open();
    setValue("#repo-stack", "nestjs");
    expect(document.body.textContent).toContain("This stack deploys to Render.");
    expect(document.querySelector("#repo-shape")).toBeNull();
  });

  it("turns hosting off explicitly", async () => {
    await open();
    setValue("#repo-name", "checkout-web");
    setValue("#repo-stack", "nextjs");
    const off = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="repo-hosting"]'))[1]!;
    act(() => off.click());
    await submit();
    expect(sentBody().deploymentProvisioning).toEqual({ enabled: false, targets: [] });
  });

  it("sends the wizard form's target when Advanced hosting fields are edited", async () => {
    await open();
    setValue("#repo-name", "checkout-web");
    setValue("#repo-stack", "nextjs");
    setValue("#repo-root-dir", "web");
    await submit();
    const hosting = sentBody().deploymentProvisioning;
    expect(hosting.enabled).toBe(true);
    expect(hosting.targets).toHaveLength(1);
    expect(hosting.targets[0]).toMatchObject({
      slot: "frontend",
      provider: "vercel",
      ownershipMode: "flowci_managed",
      rootDirectory: "web",
      projectName: "checkout-web",
    });
  });

  it("shows a provisioned outcome with an in-app link and hands the row back", async () => {
    await open();
    setValue("#repo-name", "checkout-web");
    setValue("#repo-stack", "nextjs");
    await submit();
    await poll(() => document.body.textContent?.includes("its hosting is set up") ?? false);
    const created = onCreated.mock.calls[0]?.[0];
    expect(created.id).toBe("r1");
    expect(created).not.toHaveProperty("provisioning");
    const link = document.querySelector<HTMLAnchorElement>(".create-repo a")!;
    expect(link.textContent).toBe("Open repository");
    expect(link.getAttribute("href")).toBe("/projects/proj-9");
    expect(document.querySelector('a[href*="github.com"]')).toBeNull();
  });

  it.each([
    ["partial", "Repository created; hosting couldn't be fully set up:"],
    ["failed", "Repository created; hosting couldn't be set up:"],
  ])("shows a %s hosting outcome with its reasons and the Hosting tab", async (outcome, sentence) => {
    (createRepository as jest.Mock).mockResolvedValue(
      createdResponse(outcome, [{ slot: "frontend", provider: "vercel", reason: "Project name taken" }]),
    );
    await open();
    setValue("#repo-name", "checkout-web");
    setValue("#repo-stack", "nextjs");
    await submit();
    await poll(() => document.body.textContent?.includes(sentence) ?? false);
    expect(document.body.textContent).toContain("Vercel: Project name taken");
    const link = document.querySelector<HTMLAnchorElement>(".create-repo a")!;
    expect(link.textContent).toBe("Open the Hosting tab");
    expect(link.getAttribute("href")).toBe("/projects/proj-9#hosting");
  });

  it("shows a skipped outcome", async () => {
    (createRepository as jest.Mock).mockResolvedValue(createdResponse("skipped"));
    await open();
    setValue("#repo-name", "checkout-web");
    setValue("#repo-stack", "nextjs");
    await submit();
    await poll(() => document.body.textContent?.includes("No hosting was set up for it.") ?? false);
  });

  it("maps a 400 DEPLOYMENT_PROVISIONING_INVALID and stays on the form", async () => {
    (createRepository as jest.Mock).mockRejectedValue(
      new ApiError("Bad Request", 400, { code: "DEPLOYMENT_PROVISIONING_INVALID", message: ["x"] }),
    );
    await open();
    setValue("#repo-name", "checkout-web");
    setValue("#repo-stack", "nextjs");
    await submit();
    await poll(() => document.body.textContent?.includes("The hosting settings weren't accepted") ?? false);
    expect(document.querySelector("#repo-name")).not.toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
