import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { HostingTab } from "../../../../../../src/features/projects/detail/views/hosting-tab";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { useProjectEnvProvisioning } from "../../../../../../src/features/projects/detail/view-models/use-project-env-provisioning-view-model";
import type {
  AppRole,
  DeploymentTarget,
  EnvVarMetadata,
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
  ProjectDeploymentsResponse,
  ProvisionedProject,
} from "../../../../../../src/shared/api/contracts";
import { FakeEventSource } from "../../deployment-logs/log-fixtures";

const mockPreviews: { current: { branches: ProjectBranchPreview[]; providerError: string | null } | null } = { current: null };
const mockReloadPreviews = jest.fn();

jest.mock("@/features/projects/previews", () => ({
  useBranchPreviewsViewModel: () => ({
    previews: mockPreviews.current
      ? { enabled: true, liveProvidersEnabled: true, ...mockPreviews.current }
      : null,
    status: mockPreviews.current ? "ready" : "loading",
    error: null,
    reload: mockReloadPreviews,
  }),
}));

const domainsProps: Array<Record<string, unknown>> = [];

jest.mock("@/features/projects/domains", () => ({
  ProjectDomainsPanel: (props: { canManage: boolean } & Record<string, unknown>) => {
    domainsProps.push(props);
    return <p data-testid="domains-stub">domains {props.canManage ? "manage" : "read"}</p>;
  },
}));

jest.mock("../../../../../../src/features/projects/detail/view-models/use-project-env-provisioning-view-model", () => ({
  useProjectEnvProvisioning: jest.fn(),
}));

jest.mock("../../../../../../src/features/projects/detail/data/projects-api", () => ({
  ...jest.requireActual("../../../../../../src/features/projects/detail/data/projects-api"),
  getDeploymentTargetActions: jest.fn(() => new Promise(() => undefined)),
}));

jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({ deploymentOwnershipMode: "flowci_managed" }),
}));

const mockEnv = useProjectEnvProvisioning as jest.MockedFunction<typeof useProjectEnvProvisioning>;

const PROJECT = {
  id: "proj-1",
  repoFullName: "acme/web",
  serviceName: "web",
  projectTypeId: "nextjs",
  status: "provisioned",
} as unknown as ProvisionedProject;

const TARGET: DeploymentTarget = {
  id: "t-web",
  projectId: "proj-1",
  slot: "frontend",
  ownershipMode: "flowci_managed",
  provider: "vercel",
  providerConnectionId: null,
  providerProjectId: "prj_1",
  providerProjectName: "acme-web",
  repoFullName: "acme/web",
  branchName: "main",
  rootDirectory: "apps/web",
  buildCommand: "npm run build",
  startCommand: null,
  environmentMap: {},
  status: "active",
  publicUrl: "https://acme-web.vercel.app",
};

function preview(branch: string, overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch,
    isProduction: branch === "main",
    deploymentId: "d",
    targetId: "t-web",
    targetName: "acme-web",
    provider: "vercel",
    status: "ready",
    commitSha: null,
    commitMessage: null,
    pullRequestNumber: null,
    previewUrl: `https://acme-web-${branch.replace("/", "-")}.vercel.app`,
    inspectorUrl: null,
    createdAt: "2026-10-12T10:00:00Z",
    readyAt: null,
    embeddable: null,
    embedBlockedReason: null,
    ...overrides,
  };
}

function variable(key: string, overrides: Partial<EnvVarMetadata> = {}): EnvVarMetadata {
  return {
    id: `${key}-${overrides.gitBranch ?? "prod"}`,
    projectId: "proj-1",
    deploymentTargetId: "t-web",
    lane: "production",
    gitBranch: null,
    key,
    provider: "vercel",
    valueStored: false,
    lastProvisionedAt: "2026-10-11T10:00:00Z",
    lastProvisionedBy: "lim",
    status: "provisioned",
    errorSummary: null,
    ...overrides,
  };
}

function deploy(id: string, branch: string): ProjectDeploymentHistoryItem {
  return {
    id,
    targetId: "t-web",
    targetName: "acme-web",
    provider: "vercel",
    environment: null,
    branch,
    commitSha: "abcdef1234",
    commitMessage: `deploy ${id}`,
    status: "ready",
    createdAt: "2026-10-12T10:00:00Z",
    readyAt: null,
    deploymentUrl: null,
    pullRequestNumber: null,
    inspectorUrl: null,
    dashboardUrl: "https://vercel.com/acme/acme-web",
    consoleUrl: "https://vercel.com/acme/acme-web/deployments",
  };
}

const METADATA = [
  variable("API_URL"),
  variable("SENTRY_DSN"),
  variable("API_URL", { lane: "preview", gitBranch: "uat" }),
  variable("BROKEN", { status: "failed", errorSummary: "Vercel rejected the value" }),
];

const openPullRequest = jest.fn();
const reloadDeployments = jest.fn();

function vmFor(
  appRole: AppRole | undefined,
  overrides: Partial<ProjectDetailTabsViewModel> = {},
): ProjectDetailTabsViewModel {
  return {
    appRole,
    visibleTabs: ["overview", "pulls", "hosting"],
    deploymentTargets: [TARGET],
    envMetadata: METADATA,
    envProvisioningEnabled: true,
    previewDeploymentsEnabled: true,
    deploymentHistoryEnabled: true,
    projectTargetManagementEnabled: true,
    overview: { capabilities: { deploymentHistory: true } },
    deployments: {
      enabled: true,
      mode: "live",
      liveProvidersEnabled: true,
      deployments: [deploy("m1", "main"), deploy("f1", "feat/a")],
      providerError: null,
    } satisfies ProjectDeploymentsResponse,
    deploymentsError: null,
    reloadDeployments,
    logFocus: null,
    hostingFocus: null,
    openPullRequest,
    handleTargetChanged: jest.fn(),
    handleTargetCreated: jest.fn(),
    handleTargetDetached: jest.fn(),
    ...overrides,
  } as unknown as ProjectDetailTabsViewModel;
}

function mockEnvHook(metadata: EnvVarMetadata[] = METADATA, targets: DeploymentTarget[] = [TARGET]) {
  mockEnv.mockReturnValue({
    addTarget: jest.fn(),
    load: jest.fn(),
    loading: false,
    metadata,
    providerConnections: [],
    provision: jest.fn(),
    removeMetadata: jest.fn(),
    saving: false,
    targets,
    usageItems: [],
    validateEnvText: jest.fn(),
  });
}

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  domainsProps.length = 0;
  FakeEventSource.install();
  mockPreviews.current = {
    branches: [
      preview("main"),
      preview("uat", { status: "not_deployed", previewUrl: null, createdAt: null }),
      preview("feat/a", { pullRequestNumber: 12 }),
      preview("feat/b", { status: "building" }),
    ],
    providerError: null,
  };
  mockEnvHook();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  jest.clearAllMocks();
});

function render(vm: ProjectDetailTabsViewModel, project: ProvisionedProject = PROJECT) {
  act(() => {
    root!.render(<HostingTab project={project} vm={vm} />);
  });
}

function tabs(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
}

function tab(name: string): HTMLButtonElement {
  const found = tabs().find((item) => item.textContent?.startsWith(name));
  if (!found) throw new Error(`no ${name} tab`);
  return found;
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label);
}

function variablesCard(): HTMLElement | null {
  return container.querySelector(".hosting-vars");
}

describe("Hosting tab: header and the one provider notice", () => {
  it("shows the provider notice once, and no empty-history line beside it", () => {
    mockPreviews.current = { branches: [preview("main")], providerError: "vercel timed out" };
    render(
      vmFor("member", {
        deployments: { enabled: true, mode: "unavailable", liveProvidersEnabled: true, deployments: [], providerError: "vercel: 503" },
      }),
    );
    const text = container.textContent ?? "";
    expect(text.split("Vercel didn't answer, so deploy history may be incomplete.")).toHaveLength(2);
    expect(container.querySelectorAll(".hosting-notice")).toHaveLength(1);
    expect(text).not.toContain("vercel: 503");
    expect(text).not.toContain("vercel timed out");
    expect(text).not.toMatch(/No deploy/);
    expect(text).not.toContain("No deployment history tracked yet");
    // No empty "Recent deploys" heading under the notice.
    expect(container.querySelector(".hosting-section__title")?.textContent).not.toBe("Recent deploys");

    act(() => button("Retry")?.click());
    expect(reloadDeployments).toHaveBeenCalledTimes(1);
    expect(mockReloadPreviews).toHaveBeenCalledTimes(1);
  });

  it("does not render branch previews, a page-wide history list or GitHub links", () => {
    render(vmFor("member"));
    expect(container.textContent).not.toContain("Branch previews");
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
  });
});

describe("Hosting tab: environment switcher", () => {
  it("offers Production, UAT and Previews (n) as tabs with a state line each", () => {
    render(vmFor("member"));
    expect(container.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe("Environments");
    expect(tabs().map((item) => item.textContent)).toEqual([
      "Productionmain · live",
      "UATuat · not deployed",
      "Previews (2)2 branches",
    ]);
    expect(tab("Production").getAttribute("aria-selected")).toBe("true");
    expect(tabs().map((item) => item.tabIndex)).toEqual([0, -1, -1]);
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute("aria-labelledby")).toBe(tab("Production").id);
  });

  it("moves with the arrow keys (roving tabindex) and selects as it goes", () => {
    render(vmFor("member"));
    act(() => {
      tab("Production").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tab("UAT").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("UAT"));
    expect(tabs().map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
    act(() => {
      tab("UAT").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    expect(tab("Previews").getAttribute("aria-selected")).toBe("true");
    act(() => {
      tab("Previews").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tab("Production").getAttribute("aria-selected")).toBe("true");
  });

  it("hides UAT and Previews when the repository has neither", () => {
    mockPreviews.current = { branches: [preview("main")], providerError: null };
    mockEnvHook([variable("API_URL")]);
    render(vmFor("member", { deployments: null }));
    expect(tabs().map((item) => item.textContent?.split(/main/)[0])).toEqual(["Production"]);
  });
});

describe("Hosting tab: Production", () => {
  it("shows the address with Copy and Open site, recent deploys and custom domains", () => {
    render(vmFor("member"));
    const card = container.querySelector(".hosting-deploy")!;
    expect(card.querySelector(".hosting-address__url")?.textContent).toBe("https://acme-web-main.vercel.app");
    expect(button("Copy")).toBeDefined();
    expect(Array.from(card.querySelectorAll("a")).find((a) => a.textContent === "Open site")?.getAttribute("href")).toBe(
      "https://acme-web-main.vercel.app",
    );
    expect(card.querySelector('[aria-label="Recent deploys"]')?.textContent).toContain("deploy m1");
    expect(card.querySelector('[aria-label="Recent deploys"]')?.textContent).not.toContain("deploy f1");
    expect(container.querySelector('[data-testid="domains-stub"]')?.textContent).toBe("domains manage");
    // The list first, the add form behind "+ Add domain"; the header says who can change them.
    expect(domainsProps.at(-1)).toMatchObject({ collapseAddForm: true, showReadOnlyNote: false });
  });

  it("makes the main actions primary and the rest bordered secondary buttons", () => {
    render(vmFor("member"));
    const card = container.querySelector(".hosting-deploy")!;
    const openSite = Array.from(card.querySelectorAll("a")).find((a) => a.textContent === "Open site");
    expect(openSite?.className).toBe("hosting-btn hosting-btn--primary");
    expect(button("Copy")?.className).toBe("hosting-btn");
    expect(button("Add")?.className).toBe("hosting-btn hosting-btn--primary");
    expect(button("Bulk edit")?.className).toBe("hosting-btn");
    expect(button("Logs")?.className).toBe("hosting-btn");
    expect(button("Sync")?.className).toBe("hosting-btn");
  });

  it("draws a failed deploy's dot in the danger colour", () => {
    const failed = { ...deploy("x1", "main"), status: "failed" as const };
    const errored = { ...deploy("x2", "main"), status: "error" as unknown as "failed" };
    render(
      vmFor("member", {
        deployments: { enabled: true, mode: "live", liveProvidersEnabled: true, deployments: [failed, errored], providerError: null },
      }),
    );
    const dots = Array.from(container.querySelectorAll('[aria-label="Recent deploys"] .hosting-dot'));
    expect(dots.map((dot) => dot.className)).toEqual(["hosting-dot hosting-dot--danger", "hosting-dot hosting-dot--danger"]);
  });

  it("opens the full list behind All deploys", () => {
    render(vmFor("member"));
    const all = button("All deploys (2)")!;
    expect(all.getAttribute("aria-expanded")).toBe("false");
    act(() => all.click());
    expect(container.querySelector('[aria-label="All deploys"]')?.textContent).toContain("deploy f1");
  });

  it("lists the production lane's variables with who set them, failures in danger, and the write-only note", () => {
    render(vmFor("member"));
    const card = variablesCard()!;
    expect(card.textContent).toContain("Production · branch main · 3 variables");
    expect(card.querySelector('[aria-label="Variables"]')?.textContent).toContain("API_URL");
    expect(card.textContent).toMatch(/set \S+ ago by lim/);
    expect(card.querySelector(".hosting-row__failed")?.textContent).toBe("Vercel rejected the value");
    expect(card.textContent).toContain("Values are write-only: ALPHACI sends them to Vercel and never shows them again.");
    expect(card.querySelector(".hosting-notice")).toBeNull();
  });

  it("opens the add form scoped to production when Add is pressed", () => {
    render(vmFor("member"));
    act(() => button("Add")?.click());
    const form = variablesCard()!.querySelector("form");
    expect(form?.textContent).toContain("Production · branch main");
    expect(form?.textContent).not.toContain("Branch target");
  });

  it("opens the paste-a-.env dialog from Bulk edit", () => {
    render(vmFor("member"));
    act(() => button("Bulk edit")?.click());
    expect(container.querySelector('[role="dialog"][aria-label="Paste a .env file"]')).not.toBeNull();
  });
});

describe("Hosting tab: UAT", () => {
  it("says one sentence where nothing is deployed, and runs the lane check", () => {
    render(vmFor("member", {
      deployments: { enabled: true, mode: "live", liveProvidersEnabled: true, deployments: [], providerError: null },
    }));
    act(() => tab("UAT").click());
    const deployCard = container.querySelector(".hosting-deploy")!;
    expect(deployCard.textContent).toContain("Nothing is deployed here yet. The first merge into uat publishes it.");
    expect(deployCard.textContent).not.toContain("Recent deploys");
    expect(deployCard.querySelector('[data-testid="domains-stub"]')).toBeNull();

    const card = variablesCard()!;
    expect(card.textContent).toContain("Preview · branch uat · 1 variable");
    const check = card.querySelector('.hosting-notice[role="status"]');
    expect(check?.textContent).toContain("2 variables set in Production are missing here");
    expect(check?.textContent).toContain("SENTRY_DSN");
    // The failed production key is still a key production has.
    expect(check?.textContent).toContain("BROKEN");
  });

  it("prefills the add form with the missing keys, values empty", () => {
    mockEnvHook([variable("API_URL"), variable("SENTRY_DSN"), variable("API_URL", { lane: "preview", gitBranch: "uat" })]);
    render(vmFor("member"));
    act(() => tab("UAT").click());
    act(() => button("Add the missing variables")?.click());
    const keys = Array.from(container.querySelectorAll<HTMLInputElement>('input[aria-label^="Variable key"]')).map((input) => input.value);
    const values = Array.from(container.querySelectorAll<HTMLInputElement>('input[aria-label^="Variable value"]')).map((input) => input.value);
    expect(keys).toEqual(["SENTRY_DSN"]);
    expect(values).toEqual([""]);
    expect(container.querySelector("form")?.textContent).toContain("Preview · branch uat");
  });
});

describe("Hosting tab: Previews", () => {
  it("lists the active preview branches with their pull request and state", () => {
    render(vmFor("member"));
    act(() => tab("Previews").click());
    const list = container.querySelector('[aria-label="Preview branches"]')!;
    expect(list.textContent).toContain("feat/a");
    expect(list.textContent).toContain("building");
    act(() => (Array.from(list.querySelectorAll("button")).find((item) => item.textContent === "#12") as HTMLButtonElement).click());
    expect(openPullRequest).toHaveBeenCalledWith(12);
  });

  it("picks which preview branch's variables to show", () => {
    mockEnvHook([variable("API_URL"), variable("FLAG", { lane: "preview", gitBranch: "feat/b" })]);
    render(vmFor("member"));
    act(() => tab("Previews").click());
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Preview branch"]')!;
    expect(select.value).toBe("feat/a");
    expect(variablesCard()!.textContent).toContain("Preview · branch feat/a · 0 variables");
    act(() => {
      select.value = "feat/b";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(variablesCard()!.textContent).toContain("Preview · branch feat/b · 1 variable");
    expect(variablesCard()!.textContent).toContain("FLAG");
  });

  it("shows a PR number as text for a role without the Pull requests tab", () => {
    render(vmFor(undefined, { visibleTabs: ["overview", "hosting"] }));
    act(() => tab("Previews").click());
    const list = container.querySelector('[aria-label="Preview branches"]')!;
    expect(list.querySelector("button")).toBeNull();
    expect(list.textContent).toContain("#12");
  });
});

describe("Hosting tab: roles", () => {
  it.each([undefined, "lead", "qa"] as const)("gives %s no Variables column, and the deployment card the full width", (role) => {
    render(vmFor(role));
    expect(variablesCard()).toBeNull();
    expect(container.querySelector(".hosting-columns--single")).not.toBeNull();
    expect(mockEnv).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="domains-stub"]')?.textContent).toBe("domains read");
    if (role !== "lead" && role !== "qa") return;
    // Said once, in the service header.
    const note = "Developers and admins can change hosting services and custom domains.";
    expect((container.textContent ?? "").split(note)).toHaveLength(2);
  });

  it("shows a Developer read-only variables while env provisioning is off", () => {
    render(vmFor("member", { envProvisioningEnabled: false }));
    expect(mockEnv).not.toHaveBeenCalled();
    const card = variablesCard()!;
    expect(card.textContent).toContain("API_URL");
    expect(button("Add")).toBeUndefined();
  });

  it("brings the Variables card into view for an old #environment link", () => {
    render(vmFor("member", { hostingFocus: "variables" }));
    expect(document.activeElement?.id).toBe("hosting-vars-heading");
    expect(tab("Production").getAttribute("aria-selected")).toBe("true");
  });

  it("opens the service the Overview's Full logs asked for, with its logs open", () => {
    const api = { ...TARGET, id: "t-api", provider: "render" as const, slot: "backend" as const, providerProjectName: "acme-api" };
    render(vmFor("member", { deploymentTargets: [TARGET, api], logFocus: { targetId: "t-api", window: null } }));
    expect(container.querySelector(".hosting-service h3")?.textContent).toBe("acme-api");
    expect(container.querySelector('.hosting-services [aria-pressed="true"]')?.textContent).toContain("acme-api");
    expect(container.querySelector(".deploy-logs-console")).not.toBeNull();
  });
});

describe("Hosting tab: empty state", () => {
  it("explains what hosting gives the repository and offers the create flow", () => {
    mockEnvHook([], []);
    render(vmFor("member", { deploymentTargets: [] }));
    const card = container.querySelector(".hosting-empty")!;
    expect(card.querySelector("h3")?.textContent).toBe("Host this repository");
    expect(card.textContent).toContain("publishes to Production");
    expect(card.textContent).toContain("gets its own address");
    expect(card.querySelector(".env-provisioning-panel")).not.toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("labels every field of the create flow and ends it with the primary button", () => {
    mockEnvHook([], []);
    render(vmFor("member", { deploymentTargets: [] }));
    const grid = container.querySelector(".hosting-empty .env-target-grid")!;
    const labels = Array.from(grid.querySelectorAll("label > span:first-child")).map((span) => span.textContent);
    expect(labels).toEqual(["Setup", "Service name", "Root directory", "Build command", "Branch"]);
    for (const label of Array.from(grid.querySelectorAll("label"))) {
      expect(label.querySelector("input, select")).not.toBeNull();
    }
    const save = grid.querySelector('[data-testid="save-target"]')!;
    expect(save.textContent).toBe("Create target");
    expect(save.className).toContain("primary-button");
    expect(grid.lastElementChild).toBe(save);
  });

  it("keeps the lead-only note for a role that cannot add hosting", () => {
    render(vmFor("lead", { deploymentTargets: [] }));
    expect(container.querySelector(".hosting-empty")?.textContent).toContain(
      "Developers and admins can change hosting services and custom domains.",
    );
    expect(container.querySelector(".env-provisioning-panel")).toBeNull();
  });
});
