import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectEnvPanel } from "../../src/components/product/project-env-panel";
import { WorkflowCurrentTab } from "../../src/components/product/workflow-current-tab";
import { useCapabilities } from "../../src/hooks/use-capabilities";
import { useProjectEnvProvisioning } from "../../src/hooks/use-project-env-provisioning";
import type { ProvisionedProject } from "../../src/lib/api/contracts";

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
          for (const key of [
            "initial",
            "animate",
            "exit",
            "transition",
            "whileHover",
            "whileTap",
            "variants",
            "layout",
            "layoutId",
          ]) {
            delete domProps[key];
          }
          return React.createElement("div", domProps, children);
        },
    },
  );

  return {
    AnimatePresence: passthrough,
    motion,
  };
});

jest.mock("../../src/hooks/use-capabilities", () => ({
  useCapabilities: jest.fn(),
}));

jest.mock("../../src/hooks/use-project-env-provisioning", () => ({
  useProjectEnvProvisioning: jest.fn(),
}));

const mockedUseCapabilities = useCapabilities as jest.MockedFunction<typeof useCapabilities>;
const mockedUseProjectEnvProvisioning = useProjectEnvProvisioning as jest.MockedFunction<
  typeof useProjectEnvProvisioning
>;

const provisionedProject: ProvisionedProject = {
  id: "project-1",
  repoFullName: "tone/orders-api",
  templateId: "nestjs-api",
  serviceName: "orders-api",
  workflowPath: ".github/workflows/00-flowci-access.yml",
  status: "provisioned",
  githubCommitSha: "abc123",
  githubCommitUrl: null,
  failureReason: null,
};

function render(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return { container, root };
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

function mockCapabilities(enabled: boolean) {
  mockedUseCapabilities.mockReturnValue({
    capabilities: {
      envProvisioning: {
        enabled,
        providers: enabled ? ["render", "vercel"] : [],
        environments: enabled ? ["test", "uat", "production"] : [],
        modes: enabled ? ["byo", "flowci_managed"] : [],
      },
    },
    envProvisioningEnabled: enabled,
    loadCapabilities: jest.fn(),
    loading: false,
  });
}

function mockEnvHook(overrides: Partial<ReturnType<typeof useProjectEnvProvisioning>> = {}) {
  mockedUseProjectEnvProvisioning.mockReturnValue({
    addTarget: jest.fn(),
    load: jest.fn(),
    loading: false,
    metadata: [],
    providerConnections: [],
    provision: jest.fn(),
    saving: false,
    targets: [],
    ...overrides,
  });
}

describe("Project env provisioning UI", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("shows Environment Variables action only for provisioned projects when enabled", () => {
    mockCapabilities(true);
    mockEnvHook();

    const failedProject = { ...provisionedProject, id: "project-2", status: "failed" as const };
    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject, failedProject]}
      />,
    );
    root = rendered.root;

    expect(rendered.container.textContent?.match(/Environment Variables/g) ?? []).toHaveLength(1);
  });

  it("hides Environment Variables action when capability is disabled", () => {
    mockCapabilities(false);
    mockEnvHook();

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    expect(rendered.container.textContent).not.toContain("Environment Variables");
  });

  it("registers BYO existing targets from saved provider connections", async () => {
    const addTarget = jest.fn().mockResolvedValue({
      id: "target-1",
      providerProjectName: "orders-api-render",
      provider: "render",
    });
    mockEnvHook({
      addTarget,
      providerConnections: [
        {
          id: "connection-1",
          provider: "render",
          label: "Render main",
          tokenLastFour: "cret",
          status: "active",
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    const modeSelect = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Target action"]')!;
    const ownershipSelect = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Ownership mode"]')!;

    changeValue(modeSelect, "register_existing");
    changeValue(ownershipSelect, "byo");
    const providerProjectId = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Provider project ID"]')!;
    const providerProjectName = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Provider project name"]')!;
    changeValue(providerProjectId, "srv-123");
    changeValue(providerProjectName, "orders-api-render");
    await act(async () => {
      rendered.container.querySelector<HTMLButtonElement>('button[data-testid="save-target"]')!.click();
    });

    expect(addTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "register_existing",
        ownershipMode: "byo",
        providerConnectionId: "connection-1",
        providerProjectId: "srv-123",
        providerProjectName: "orders-api-render",
      }),
    );
  });

  it("clears submitted values and shows metadata without secret values", async () => {
    const provision = jest.fn().mockResolvedValue({
      provisioned: [{ key: "DATABASE_URL", status: "provisioned" }],
      failed: [],
    });
    mockEnvHook({
      provision,
      targets: [
        {
          id: "target-1",
          projectId: "project-1",
          slot: "backend",
          ownershipMode: "flowci_managed",
          provider: "render",
          providerConnectionId: null,
          providerProjectId: "srv-1",
          providerProjectName: "orders-api-render",
          repoFullName: "tone/orders-api",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm run build",
          startCommand: "npm run start:prod",
          environmentMap: {},
          status: "active",
        },
      ],
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-1",
          environment: "test",
          key: "DATABASE_URL",
          provider: "render",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "provisioned",
          errorSummary: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;
    const keyInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="DATABASE_URL"]')!;
    const valueInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Value"]')!;

    changeValue(keyInput, "DATABASE_URL");
    changeValue(valueInput, "postgres://secret");
    await act(async () => {
      rendered.container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });

    expect(provision).toHaveBeenCalledWith({
      deploymentTargetId: "target-1",
      environment: "test",
      vars: [{ key: "DATABASE_URL", value: "postgres://secret" }],
    });
    expect(valueInput.value).toBe("");
    expect(rendered.container.textContent).toContain("DATABASE_URL");
    expect(rendered.container.textContent).not.toContain("postgres://secret");
  });

  it("shows failed key error summaries without showing values", () => {
    mockEnvHook({
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-1",
          environment: "test",
          key: "API_KEY",
          provider: "vercel",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "failed",
          errorSummary: "Provider rejected key",
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    expect(rendered.container.textContent).toContain("API_KEY");
    expect(rendered.container.textContent).toContain("Provider rejected key");
    expect(rendered.container.textContent).not.toContain("secret");
  });
});
